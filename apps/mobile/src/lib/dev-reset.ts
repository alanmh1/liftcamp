import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORAGE_PREFIX } from '@liftcamp/shared';
import { DevSettings } from 'react-native';

import { supabase } from '../../lib/supabase';

/**
 * Development only: leave the current account and start the app as a
 * brand new anonymous user, the way a fresh install would.
 *
 * Nothing is deleted. The old account's rows stay where they are; an
 * email account can be signed back into with its code, and an anonymous
 * one is simply left behind (Profile warns before this runs).
 *
 * Order matters. Sign out first, so the session key goes through the
 * client rather than being pulled from under it. Then every `liftcamp:`
 * key, whatever the set is by then (today the onboarded flag and the
 * theme). Then a fresh anonymous session, so the app comes back signed
 * in. Then the bundle reloads: module-level caches (the exercise library,
 * the auto-resume set, anything a screen memoised) live in JS memory and
 * a reload is the one thing that clears all of them.
 */
export async function startFreshAsNewUser(): Promise<void> {
  await supabase.auth.signOut();
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(APP_STORAGE_PREFIX));
  if (keys.length > 0) await AsyncStorage.multiRemove(keys);
  await supabase.auth.signInAnonymously();
  DevSettings.reload();
}
