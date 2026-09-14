import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { isAuthApiError } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

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
 *   to that account instead and tell the caller, so the UI can say the guest
 *   workouts were not moved. Moving rows between users needs a database
 *   function and is out of scope here.
 */
export type SignInMode = 'signIn' | 'link';

export type SignInOutcome =
  | { ok: true; linked: boolean; existingAccount: boolean }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; error: string };

type Provider = 'apple' | 'google';

const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

// Configure once at load. iOS only for now; Android would need webClientId.
if (GOOGLE_IOS_CLIENT_ID) {
  GoogleSignin.configure({ iosClientId: GOOGLE_IOS_CLIENT_ID });
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
  if (mode === 'link' && (await currentUserIsAnonymous())) {
    const { error } = await supabase.auth.linkIdentity({ provider, token, nonce });
    if (!error) return { ok: true, linked: true, existingAccount: false };

    const taken = isAuthApiError(error) && error.code === 'identity_already_exists';
    if (!taken) return { ok: false, cancelled: false, error: error.message };

    // The token is still valid for a plain sign-in: Supabase verifies its
    // signature and nonce, and neither is consumed by the failed link.
    const { error: signInError } = await supabase.auth.signInWithIdToken({ provider, token, nonce });
    if (signInError) return { ok: false, cancelled: false, error: signInError.message };
    return { ok: true, linked: false, existingAccount: true };
  }

  const { error } = await supabase.auth.signInWithIdToken({ provider, token, nonce });
  if (error) return { ok: false, cancelled: false, error: error.message };
  return { ok: true, linked: false, existingAccount: false };
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
  if (data.user?.user_metadata?.full_name) return;
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
  if (outcome.ok && credential.fullName) {
    await saveNameIfMissing({
      given: credential.fullName.givenName,
      family: credential.fullName.familyName,
    });
  }
  return outcome;
}

export async function signInWithGoogle(mode: SignInMode): Promise<SignInOutcome> {
  if (!GOOGLE_IOS_CLIENT_ID) {
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
    if (outcome.ok) await saveNameIfMissing({ full: result.data.user.name });
    return outcome;
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) {
      return { ok: false, cancelled: true };
    }
    return { ok: false, cancelled: false, error: (e as Error).message };
  }
}
