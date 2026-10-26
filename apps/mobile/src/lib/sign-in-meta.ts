import { Platform } from 'react-native';

/**
 * User metadata sent with every sign-in that can create an account
 * (`signInAnonymously`, `signInWithOtp`). Supabase stores it in
 * `auth.users.raw_user_meta_data` when the user is created, so a dev
 * build's accounts can be told from real ones, and iOS from Android.
 * `signInWithIdToken` has no data option and sends nothing.
 */
export function signInMeta() {
  return { env: __DEV__ ? 'dev' : 'prod', platform: Platform.OS };
}
