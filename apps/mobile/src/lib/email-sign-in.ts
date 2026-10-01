import { isAuthApiError } from '@supabase/supabase-js';

import { sendNow } from '@/data/write-queue';
import { mergeIntoExisting, throwawayClient } from '@/lib/guest-merge';
import type { SignInMode, SignInOutcome } from '@/lib/native-sign-in';
import { supabase } from '../../lib/supabase';

/**
 * Email sign-in with a 6-digit code, the third option beside Apple and
 * Google. A code rather than a magic link: a link has to open on the phone
 * the app is on and survive a mail scanner's prefetch, and a code needs
 * neither.
 *
 * The two modes use different Supabase calls, which is why this is not a
 * third provider string through `native-sign-in.ts`:
 *
 * - `signIn`: `signInWithOtp` sends, `verifyOtp` with type `email` completes.
 *   A new address gets a new account; a known one signs into its account.
 * - `link`: `updateUser({ email })` sends, `verifyOtp` with type
 *   `email_change` completes, and the anonymous user becomes that email's
 *   account with their guest workouts intact. If the address already belongs
 *   to someone, `updateUser` refuses; then it is a plain `signInWithOtp` to
 *   that account, verified with type `email` on a throwaway client, and the
 *   guest's data is moved into that account before the app switches to it
 *   (lib/guest-merge.ts). Same outcome shape as the provider path's
 *   `identity_already_exists` fallback.
 *
 * Secure email change is off on the project and the code length is 6, so a
 * link sends one code to the new address and nothing to an old one, which
 * an anonymous user does not have anyway.
 */

/** Minimum gap between sends per user, matching the project's rate limit. */
export const RESEND_COOLDOWN_MS = 60_000;

/**
 * How long a code stays valid. Supabase answers a wrong code and an expired
 * one with the same error, so this is what tells the two messages apart.
 * Matches the dashboard's Email OTP expiration, which is an hour unless
 * changed under Authentication, Sign In / Providers, Email.
 */
export const CODE_LIFETIME_MS = 60 * 60_000;

/** What `verifyOtp` is told for the code a send produced. */
type VerifyType = 'email' | 'email_change';

/**
 * Which verify type each address's most recent code wants. In link mode the
 * send decides (an attach, or the fallback sign-in), and the verify has to
 * match it. Module state rather than a return value so the screen keeps the
 * two-call shape and cannot pass the wrong type back.
 */
const pendingType = new Map<string, { type: VerifyType; sentAt: number }>();

export const WRONG_CODE = 'That code is not right. Check it and try again.';
export const EXPIRED_CODE = 'That code has expired. Send a new one.';
export const RATE_LIMITED = 'Too many requests. Wait a minute and try again.';

/** Trim and lowercase. A code sent to one casing and verified against another fails. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Enough to catch a typo before a send, not a validator. */
export function looksLikeEmail(raw: string): boolean {
  const s = normalizeEmail(raw);
  const at = s.indexOf('@');
  return at > 0 && s.indexOf('.', at) > at + 1 && !s.endsWith('.') && !/\s/.test(s);
}

async function currentUserIsAnonymous(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session?.user.is_anonymous;
}

function isRateLimited(error: { code?: string; status?: number }): boolean {
  return (
    error.status === 429 ||
    error.code === 'over_email_send_rate_limit' ||
    error.code === 'over_request_rate_limit'
  );
}

/** Dev-only trace of the branch taken, same as native-sign-in.ts. */
function logBranch(branch: string) {
  if (__DEV__) console.log(`[sign-in] email: ${branch}`);
}

/**
 * Sends a code to the address. In link mode that is an email change on the
 * anonymous user, falling back to a sign-in code when the address is
 * already an account.
 */
export async function sendEmailCode(
  email: string,
  mode: SignInMode,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const address = normalizeEmail(email);

  if (mode === 'link') {
    // Link mode promises to keep the current account. Same refusal as the
    // provider path when there is no anonymous session to attach to.
    if (!(await currentUserIsAnonymous())) {
      logBranch('refused: session is not anonymous');
      return { ok: false, error: 'This account is already signed in. Sign out first to switch accounts.' };
    }

    const { error } = await supabase.auth.updateUser({ email: address });
    if (!error) {
      pendingType.set(address, { type: 'email_change', sentAt: Date.now() });
      logBranch('link: code sent, verify as email_change');
      return { ok: true };
    }
    if (isAuthApiError(error) && isRateLimited(error)) return { ok: false, error: RATE_LIMITED };

    // The one case that falls back: the address is already someone's account.
    const taken = isAuthApiError(error) && error.code === 'email_exists';
    if (!taken) {
      logBranch(`link failed: ${(isAuthApiError(error) && error.code) || error.message}`);
      return { ok: false, error: error.message };
    }
    logBranch('link: address taken, sending a sign-in code instead');
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: false },
    });
    if (otpError) {
      return { ok: false, error: isAuthApiError(otpError) && isRateLimited(otpError) ? RATE_LIMITED : otpError.message };
    }
    pendingType.set(address, { type: 'email', sentAt: Date.now() });
    return { ok: true };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: address,
    options: { shouldCreateUser: true },
  });
  if (error) {
    return { ok: false, error: isAuthApiError(error) && isRateLimited(error) ? RATE_LIMITED : error.message };
  }
  pendingType.set(address, { type: 'email', sentAt: Date.now() });
  logBranch('signIn: code sent, verify as email');
  return { ok: true };
}

/** Completes the code the last `sendEmailCode` for this address produced. */
export async function verifyEmailCode(
  email: string,
  token: string,
  mode: SignInMode,
): Promise<SignInOutcome> {
  const address = normalizeEmail(email);
  const pending = pendingType.get(address);
  // No record means the send happened before a reload. In link mode the
  // attach is the common case; in sign-in mode there is only one type.
  const type: VerifyType = mode === 'link' ? (pending?.type ?? 'email_change') : 'email';

  // The address is someone else's account. Send what the guest has queued
  // while this is still the guest's session, then verify on a throwaway
  // client so the app stays on the guest until the merge lands.
  const toExisting = mode === 'link' && type === 'email';
  if (toExisting) await sendNow();
  const client = toExisting ? throwawayClient() : supabase;

  const { data, error } = await client.auth.verifyOtp({ email: address, token: token.trim(), type });
  if (error) {
    if (isAuthApiError(error) && isRateLimited(error)) {
      return { ok: false, cancelled: false, error: RATE_LIMITED };
    }
    // Supabase reports a wrong code and an expired one identically, as
    // `otp_expired`. The send time decides which message fits.
    if (isAuthApiError(error) && error.code === 'otp_expired') {
      const expired = pending != null && Date.now() - pending.sentAt > CODE_LIFETIME_MS;
      return { ok: false, cancelled: false, error: expired ? EXPIRED_CODE : WRONG_CODE };
    }
    return { ok: false, cancelled: false, error: error.message };
  }

  pendingType.delete(address);
  if (mode === 'link') {
    if (type === 'email_change') {
      logBranch('linked');
      return { ok: true, linked: true, existingAccount: false };
    }
    if (!data.session) return { ok: false, cancelled: false, error: 'Sign-in returned no session.' };
    logBranch('existing');
    const merge = await mergeIntoExisting(data.session);
    return { ok: true, linked: false, existingAccount: true, merge };
  }
  logBranch('fresh or existing sign-in');
  return { ok: true, linked: false, existingAccount: false };
}
