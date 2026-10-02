import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLiftCampClient, parseStoredSession, supabaseStorageKey } from '@liftcamp/shared';
import type { Session } from '@supabase/supabase-js';
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

/**
 * The session as supabase-js last saved it, read straight from storage.
 * Never waits on auth-js: its getSession() and every request made through
 * the client first await its initialization, which with an expired token
 * and no signal is a refresh retried for about 20 s.
 */
export async function readStoredSession(): Promise<Session | null> {
  try {
    return parseStoredSession<Session & { refresh_token: string; user: { id: string } }>(
      await AsyncStorage.getItem(SESSION_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

/**
 * Whether a session's access token has run out, or will within `marginS`
 * seconds. Inside auth-js's own 90 s margin, any request refreshes the
 * token first, which with no signal is the long retry.
 */
export function accessTokenExpired(session: { expires_at?: number } | null, marginS = 0): boolean {
  return session?.expires_at != null && session.expires_at * 1000 <= Date.now() + marginS * 1000;
}

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
