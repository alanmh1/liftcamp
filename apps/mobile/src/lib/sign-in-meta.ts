import { signInMeta as buildSignInMeta } from '@liftcamp/shared';
import { Platform } from 'react-native';

import { isDevBuild } from '@/lib/dev-build';

/**
 * User metadata sent with every sign-in that can create an account
 * (`signInAnonymously`, `signInWithOtp`). Supabase stores it in
 * `auth.users.raw_user_meta_data` when the user is created, so the
 * new-user email can skip a dev build's accounts at insert time, and iOS
 * can be told from Android. `signInWithIdToken` has no data option;
 * lib/new-user writes the same metadata right after it.
 */
export function signInMeta() {
  return buildSignInMeta(isDevBuild(), Platform.OS);
}
