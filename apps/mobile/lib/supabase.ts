import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLiftCampClient } from '@liftcamp/shared';
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

// Refresh tokens only while the app is foregrounded. Without this, a session
// left in the background expires and the next request fails.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
