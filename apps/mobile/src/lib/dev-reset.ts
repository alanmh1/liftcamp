import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORAGE_PREFIX } from '@liftcamp/shared';
import { DevSettings } from 'react-native';

import { endAllActivities } from '@/lib/live-activity';
import { cancelAllRestAlerts } from '@/lib/rest-alert';
import { supabase } from '../../lib/supabase';

/**
 * Development only: leave the current account and start the app as a
 * brand new anonymous user, the way a fresh install would.
 *
 * Nothing is deleted. The old account's rows stay where they are; an
 * email account can be signed back into with its code, and an anonymous
 * one is simply left behind (Profile warns before this runs).
 *
 * Order matters. Every `liftcamp:` key first, whatever the set is by then
 * (today the onboarded flags, the guest flag and the theme): with the
 * guest flag still set, the sign-out would read as a lost guest session
 * and AuthProvider would sign in a guest of its own. Then sign out, so the
 * session key goes through the client rather than being pulled from under
 * it. Then a fresh anonymous session, so the app comes back signed in. Then the bundle reloads: module-level caches (the exercise library,
 * the write queue's state, anything a screen memoised) live in JS memory and
 * a reload is the one thing that clears all of them.
 */
export async function startFreshAsNewUser(): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(APP_STORAGE_PREFIX));
  if (keys.length > 0) await AsyncStorage.multiRemove(keys);
  await Promise.all([cancelAllRestAlerts(), endAllActivities()]);
  await supabase.auth.signOut();
  await supabase.auth.signInAnonymously();
  DevSettings.reload();
}
