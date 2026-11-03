import { isNewUser } from '@liftcamp/shared';
import type { User } from '@supabase/supabase-js';

import { markDevUser } from '@/lib/dev-user';
import { signInMeta } from '@/lib/sign-in-meta';
import { supabase } from '../../lib/supabase';

/**
 * The one place that handles an account a sign-in just created. Every
 * sign-in that can create one calls it with the user it returned:
 * `signInAnonymously` (auth-provider, dev-reset), `verifyOtp` in sign-in
 * mode (email-sign-in) and `signInWithIdToken` (native-sign-in). Links and
 * merges keep an existing user and do not call it.
 *
 * - A user created without metadata (ID token sign-in has no data option)
 *   gets `{ env, platform }` through `updateUser`. The new-user email went
 *   out at insert, before this; for Apple and Google that is accepted.
 * - In a dev build, the user gets its `dev_user` row.
 *
 * A sign-in into an account that already existed does nothing here
 * (`isNewUser`), so signing into a real account from the Simulator does
 * not mark it. Never throws.
 */
export async function recordNewUser(user: User | null | undefined): Promise<void> {
  if (!user || !isNewUser(user)) return;
  try {
    const writes: Promise<unknown>[] = [markDevUser(user.id)];
    if (user.user_metadata?.env == null) writes.push(supabase.auth.updateUser({ data: signInMeta() }));
    await Promise.all(writes);
  } catch (e) {
    if (__DEV__) console.warn('[new-user] not recorded', e);
  }
}
