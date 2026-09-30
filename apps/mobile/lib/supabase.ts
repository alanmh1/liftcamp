import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLiftCampClient, supabaseStorageKey } from '@liftcamp/shared';
import { AppState } from 'react-native';

import { trackedFetch } from '@/lib/network';

/**
 * The app's single Supabase client.
 *
 * AsyncStorage rather than SecureStore: SecureStore caps an item at 2048 bytes
 * and a Supabase session can exceed that. Every request notes a missing
 * response for `networkFailedSince` (src/lib/network.ts).
 */
export const supabase = createLiftCampClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  AsyncStorage,
  { fetch: trackedFetch },
);

/**
 * Where supabase-js keeps the session in AsyncStorage. The auth provider
 * reads it directly at launch, so the app renders from the stored session
 * without waiting on the network (see components/auth-provider.tsx).
 */
export const SESSION_STORAGE_KEY = supabaseStorageKey(process.env.EXPO_PUBLIC_SUPABASE_URL!);

// Refresh tokens only while the app is foregrounded. Without this, a session
// left in the background expires and the next request fails. React Native
// does not start the refresh timer on its own and a cold launch fires no
// 'change' event, so it starts here too. Each start runs a refresh check at
// once, which is what swaps in a fresh token for one that expired offline
// when the app comes back to the foreground with signal; while foregrounded
// the 30 s timer retries until the refresh gets through.
if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
