import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageKeysToClear, type DeleteAccountRequest, type DeleteAccountResponse } from '@liftcamp/shared';
import { FunctionsHttpError, type User } from '@supabase/supabase-js';

import { invalidateScanCache } from '@/data/scan-cache';
import { appleSignInAvailable, reauthorizeWithApple } from '@/lib/native-sign-in';
import { supabase } from '../../lib/supabase';

/**
 * In-app account deletion, from the button in Settings.
 *
 * The server does the deleting: the `delete-account` Edge Function checks
 * the caller's token, revokes the Apple token when there is one, deletes
 * the rows keyed by email, and deletes the auth user, which cascades to
 * every table the user owns. This module gets the Apple code first, calls
 * the function, and afterwards clears what the device still holds.
 */

export type DeleteOutcome =
  | { ok: true; apple: DeleteAccountResponse['apple'] }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; error: string };

const GENERIC_ERROR = 'Your account was not deleted. Check your connection and try again.';

/** Whether the account has an Apple identity, and so needs an Apple code. */
export function hasAppleIdentity(user: Pick<User, 'identities'> | undefined): boolean {
  return !!user?.identities?.some((i) => i.provider === 'apple');
}

/**
 * Asks the server to delete the signed-in account. An Apple account signs
 * in with Apple once more for a fresh authorization code; cancelling that
 * cancels the deletion. Where Apple sign-in is not available (Android), the
 * account is deleted without the code and the server logs that the Apple
 * token was not revoked.
 */
export async function deleteAccount(user: Pick<User, 'identities'>): Promise<DeleteOutcome> {
  const body: DeleteAccountRequest = {};
  if (hasAppleIdentity(user) && (await appleSignInAvailable())) {
    const apple = await reauthorizeWithApple();
    if (!apple.ok) {
      if (apple.cancelled) return { ok: false, cancelled: true };
      return { ok: false, cancelled: false, error: `Apple could not confirm it is you. ${apple.error}` };
    }
    body.appleAuthorizationCode = apple.code;
  }

  const { data, error } = await supabase.functions.invoke<DeleteAccountResponse>('delete-account', { body });
  if (error) {
    if (__DEV__) {
      const detail = error instanceof FunctionsHttpError ? await error.context.text().catch(() => '') : '';
      console.log(`[delete-account] ${error.message} ${detail}`);
    }
    return { ok: false, cancelled: false, error: GENERIC_ERROR };
  }
  if (!data?.deleted) return { ok: false, cancelled: false, error: GENERIC_ERROR };
  return { ok: true, apple: data.apple };
}

/**
 * Clears the device after the server has deleted the account. Run inside
 * the onboarding provider's `startOver`, so the root holds on its spinner
 * throughout and lands on onboarding once this returns.
 *
 * - Sign out with scope `local`: the user no longer exists, so there is
 *   no server session to end. This removes the stored session and moves
 *   the auth state to signed out.
 * - Every `liftcamp:` key except the theme, so the next launch is a fresh
 *   install's.
 * - The PR scan and bodyweight caches. They are keyed by user, so a new
 *   account could not read them anyway; this is tidiness. The exercise
 *   library and system routines are the same for everyone and stay.
 */
export async function clearDeviceAfterDeletion(): Promise<void> {
  await supabase.auth.signOut({ scope: 'local' });
  const keys = storageKeysToClear(await AsyncStorage.getAllKeys());
  if (keys.length > 0) await AsyncStorage.multiRemove(keys);
  invalidateScanCache();
}
