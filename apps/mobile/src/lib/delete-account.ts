import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  deleteConfirmed,
  storageKeysToClear,
  type DeleteAccountRequest,
  type DeleteAccountResponse,
} from '@liftcamp/shared';
import { FunctionsHttpError, type User } from '@supabase/supabase-js';

import { invalidateScanCache } from '@/data/scan-cache';
import { writeQueue } from '@/data/write-queue';
import { appleSignInAvailable, reauthorizeWithApple } from '@/lib/native-sign-in';
import { cancelAllRestAlerts } from '@/lib/rest-alert';
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
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; error: string };

/** The body under "Your account was not deleted" (`NOT_DELETED_TITLE`). */
const APPLE_ERROR = 'Apple could not confirm it is you. Try again.';
const SERVER_ERROR = 'Check your connection and try again.';

/** Whether the account has an Apple identity, and so needs an Apple code. */
export function hasAppleIdentity(user: Pick<User, 'identities'> | undefined): boolean {
  return !!user?.identities?.some((i) => i.provider === 'apple');
}

/**
 * Asks the server to delete the signed-in account. Never throws, and
 * never ends without an answer: `ok` only when the server confirms the
 * delete, `cancelled` only when the person closed Apple's sheet, and an
 * error for everything else, which Settings shows.
 *
 * An Apple account signs in with Apple once more for a fresh authorization
 * code, so the server can revoke the Apple token. If Apple signs in but
 * gives no code, or Apple sign-in is not available (Android), the account
 * is deleted without it and the server logs the revoke as not done.
 */
export async function deleteAccount(user: Pick<User, 'identities'>): Promise<DeleteOutcome> {
  try {
    const body: DeleteAccountRequest = {};
    if (hasAppleIdentity(user) && (await appleSignInAvailable())) {
      const apple = await reauthorizeWithApple();
      if (apple.kind === 'cancelled') return { ok: false, cancelled: true };
      if (apple.kind === 'failed') {
        if (__DEV__) console.log(`[delete-account] Apple re-auth failed: ${apple.message}`);
        return { ok: false, cancelled: false, error: APPLE_ERROR };
      }
      if (apple.kind === 'code') body.appleAuthorizationCode = apple.code;
    }

    const response = await supabase.functions.invoke<DeleteAccountResponse>('delete-account', { body });
    if (!deleteConfirmed(response)) {
      if (__DEV__) {
        const e = response.error;
        const detail = e instanceof FunctionsHttpError ? await e.context.text().catch(() => '') : '';
        console.log(`[delete-account] not confirmed: ${e?.message ?? JSON.stringify(response.data)} ${detail}`);
      }
      return { ok: false, cancelled: false, error: SERVER_ERROR };
    }
    return { ok: true };
  } catch (e) {
    if (__DEV__) console.log(`[delete-account] threw: ${(e as Error)?.message}`);
    return { ok: false, cancelled: false, error: SERVER_ERROR };
  }
}

/**
 * Clears the device after the server has deleted the account. Run inside
 * the onboarding provider's `startOver`, so the root holds on its spinner
 * throughout and lands on onboarding once this returns.
 *
 * - The write queue, pointed at no one, so nothing it holds is saved back.
 * - Every `liftcamp:` key except the theme, so the next launch is a fresh
 *   install's. First, because that includes the guest flag: signing out
 *   with it still set would read as a lost guest session and sign in a
 *   new guest (see AuthProvider).
 * - Every pending rest alert, so none fires for a deleted account.
 * - Sign out with scope `local`: the user no longer exists, so there is
 *   no server session to end. This removes the stored session and moves
 *   the auth state to signed out.
 * - The PR scan and bodyweight caches. They are keyed by user, so a new
 *   account could not read them anyway; this is tidiness. The exercise
 *   library and system routines are the same for everyone and stay.
 */
export async function clearDeviceAfterDeletion(): Promise<void> {
  // The server has already deleted every row those writes touch.
  await writeQueue.setUser(null);
  const keys = storageKeysToClear(await AsyncStorage.getAllKeys());
  if (keys.length > 0) await AsyncStorage.multiRemove(keys);
  await cancelAllRestAlerts();
  await supabase.auth.signOut({ scope: 'local' });
  invalidateScanCache();
}
