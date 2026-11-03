import { classifyAppleReauth, type AppleReauth } from '@liftcamp/shared';
import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { isAuthApiError } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { settleUsername } from '@/data/home';
import { sendNow } from '@/data/write-queue';
import { mergeIntoExisting, throwawayClient, type MergeResult } from '@/lib/guest-merge';
import { recordNewUser } from '@/lib/new-user';
import { supabase } from '../../lib/supabase';

/**
 * Native Google and Apple sign-in, both landing on
 * `supabase.auth.signInWithIdToken`.
 *
 * `mode` decides what happens with the token:
 * - `signIn`: a fresh session for whoever the identity belongs to.
 * - `link`: attach the identity to the current anonymous user, so the guest's
 *   workouts stay with them. If that identity already belongs to another
 *   account, Supabase refuses with `identity_already_exists`; we then sign in
 *   to that account on a throwaway client and move the guest's data into it
 *   (lib/guest-merge.ts) before the app switches to it. `merge` on the
 *   outcome says whether that worked.
 */
export type SignInMode = 'signIn' | 'link';

export type SignInOutcome =
  | {
      ok: true;
      linked: boolean;
      existingAccount: boolean;
      merge?: MergeResult;
      /**
       * Set by "Try a workout first": a new guest, who still has onboarding
       * ahead. A host that finishes onboarding on a sign-in (the onboarding
       * sheet) must not do so for this one.
       */
      guest?: true;
    }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; error: string };

type Provider = 'apple' | 'google';

const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

/**
 * The client ID this platform needs before Google sign-in can work. iOS
 * signs in with the iOS client. Android returns an ID token only when
 * given the web client ID, and the token's audience is then the web
 * client, which Supabase already accepts (it is first in the provider's
 * Client IDs). Android's own OAuth client is never sent: Google matches
 * the app by package name and signing certificate SHA-1.
 */
const GOOGLE_CLIENT_ID = Platform.OS === 'android' ? GOOGLE_WEB_CLIENT_ID : GOOGLE_IOS_CLIENT_ID;

// Configure once at load, with the one client this platform needs and
// never both: webClientId on Android, iosClientId on iOS, as before.
if (GOOGLE_CLIENT_ID) {
  GoogleSignin.configure(
    Platform.OS === 'android' ? { webClientId: GOOGLE_CLIENT_ID } : { iosClientId: GOOGLE_CLIENT_ID },
  );
}

/** A raw nonce for Apple, and its SHA-256 which is what Apple wants to see. */
async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  return { raw, hashed };
}

async function currentUserIsAnonymous(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session?.user.is_anonymous;
}

/**
 * Hands an ID token to Supabase according to the mode. Shared by both
 * providers so the link-or-sign-in decision lives in one place.
 */
async function completeWithIdToken(
  provider: Provider,
  token: string,
  nonce: string | undefined,
  mode: SignInMode,
): Promise<SignInOutcome> {
  if (mode === 'link') {
    // Link mode promises to keep the current account. If the session is not
    // anonymous there is nothing to attach to, and falling through to a plain
    // sign-in would create or switch accounts from a screen that said it
    // would not. Refuse instead.
    if (!(await currentUserIsAnonymous())) {
      logBranch(provider, 'refused: session is not anonymous');
      return {
        ok: false,
        cancelled: false,
        error: 'This account is already signed in. Sign out first to switch accounts.',
      };
    }

    const { error } = await supabase.auth.linkIdentity({ provider, token, nonce });
    if (!error) {
      logBranch(provider, 'linked');
      return { ok: true, linked: true, existingAccount: false };
    }

    // The one case that falls back: the identity already belongs to someone.
    const taken = isAuthApiError(error) && error.code === 'identity_already_exists';
    if (!taken) {
      logBranch(provider, `link failed: ${error.code ?? error.message}`);
      return { ok: false, cancelled: false, error: error.message };
    }

    // Send what the guest has queued while this is still the guest's
    // session. Anything still unsent is handed to the account after the
    // merge.
    await sendNow();

    // The token is still valid for a plain sign-in: Supabase verifies its
    // signature and nonce, and neither is consumed by the failed link. On a
    // throwaway client, so the app stays on the guest until the merge lands.
    const { data, error: signInError } = await throwawayClient().auth.signInWithIdToken({ provider, token, nonce });
    if (signInError || !data.session) {
      return { ok: false, cancelled: false, error: signInError?.message ?? 'Sign-in returned no session.' };
    }
    logBranch(provider, 'existing');
    const merge = await mergeIntoExisting(data.session);
    return { ok: true, linked: false, existingAccount: true, merge };
  }

  const { data, error } = await supabase.auth.signInWithIdToken({ provider, token, nonce });
  if (error) return { ok: false, cancelled: false, error: error.message };
  logBranch(provider, 'fresh');
  // No data option on an ID token sign-in: a new account gets its env tag
  // (and in a dev build its dev_user row) here.
  await recordNewUser(data.user);
  return { ok: true, linked: false, existingAccount: false };
}

/**
 * Dev-only trace of which branch a sign-in took, so the next test of the
 * link flow does not need a database query to tell "linked" from
 * "existing" from "fresh". Stripped from release builds by __DEV__.
 */
function logBranch(provider: Provider, branch: string) {
  if (__DEV__) console.log(`[sign-in] ${provider}: ${branch}`);
}

/**
 * Saves a display name into user metadata when we learned one and the account
 * has none. Apple only sends the name on the very first authorization, so
 * this is the one chance to keep it.
 */
async function saveNameIfMissing(name: { given?: string | null; family?: string | null; full?: string | null }) {
  const full = name.full?.trim() || [name.given, name.family].filter(Boolean).join(' ').trim();
  if (!full) return;
  const { data } = await supabase.auth.getUser();
  // Still the guest when a merge into an existing account did not go
  // through; the name belongs to the account, not the guest.
  if (!data.user || data.user.is_anonymous) return;
  if (data.user.user_metadata?.full_name) return;
  await supabase.auth.updateUser({
    data: {
      full_name: full,
      ...(name.given ? { given_name: name.given } : {}),
      ...(name.family ? { family_name: name.family } : {}),
    },
  });
}

export async function appleSignInAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync();
}

export async function signInWithApple(mode: SignInMode): Promise<SignInOutcome> {
  const nonce = await makeNonce();
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: nonce.hashed,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return { ok: false, cancelled: true };
    return { ok: false, cancelled: false, error: (e as Error).message };
  }

  if (!credential.identityToken) {
    return { ok: false, cancelled: false, error: 'Apple returned no identity token.' };
  }

  const outcome = await completeWithIdToken('apple', credential.identityToken, nonce.raw, mode);
  if (outcome.ok) {
    if (credential.fullName) {
      await saveNameIfMissing({
        given: credential.fullName.givenName,
        family: credential.fullName.familyName,
      });
    }
    // After the name, so the username can come from it. Apple sends the
    // name only on the first authorization; with a hidden email and no
    // name the username is a lifter one, never the relay address.
    await settleUsername({ linked: outcome.linked });
  }
  return outcome;
}

/**
 * A fresh Apple authorization code for the current Apple ID, without
 * signing in. Account deletion sends it to the server, which swaps it for
 * a refresh token and revokes that. Sign-in never keeps the code, and a
 * code is good for one use within five minutes, so it is asked for at the
 * moment of deletion. No scopes: only the code is wanted.
 *
 * Never throws. What each outcome means for the delete is in
 * `classifyAppleReauth` in shared, with its tests: only Apple's own cancel
 * is silent, and a sign-in without a code still deletes.
 */
export async function reauthorizeWithApple(): Promise<AppleReauth> {
  try {
    const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
    return classifyAppleReauth({ credential });
  } catch (e) {
    return classifyAppleReauth({ error: e as { code?: unknown; message?: unknown } });
  }
}

export async function signInWithGoogle(mode: SignInMode): Promise<SignInOutcome> {
  if (!GOOGLE_CLIENT_ID) {
    return { ok: false, cancelled: false, error: 'Google sign-in is not configured for this build.' };
  }
  try {
    await GoogleSignin.hasPlayServices();
    const result = await GoogleSignin.signIn();
    if (result.type === 'cancelled') return { ok: false, cancelled: true };
    const idToken = result.data.idToken;
    if (!idToken) return { ok: false, cancelled: false, error: 'Google returned no ID token.' };

    // No nonce: the Google SDK does not let us set one, so the token carries
    // none. If Supabase rejects this over a nonce mismatch, the fix is the
    // provider's "Skip nonce checks" setting in the dashboard, not code.
    const outcome = await completeWithIdToken('google', idToken, undefined, mode);
    if (outcome.ok) {
      await saveNameIfMissing({ full: result.data.user.name });
      await settleUsername({ linked: outcome.linked });
    }
    return outcome;
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) {
      return { ok: false, cancelled: true };
    }
    return { ok: false, cancelled: false, error: (e as Error).message };
  }
}
