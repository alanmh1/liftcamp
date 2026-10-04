import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  layoutAtMount,
  parseSocialCache,
  socialAfterRead,
  socialCacheKey,
  socialCacheValue,
  type TabLayout,
} from '@liftcamp/shared';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { supabase } from '../../lib/supabase';

/**
 * Whether social is on for the signed-in user: `social_access()`, which
 * the server decides from the grant, the global switch and the revoke
 * (docs/social-spec.md, Flag). The same device cache pattern as tester
 * Pro (lib/tester-pro.ts), with the rules in shared (social.ts).
 *
 * The tabs read it before they first draw, so the answer that matters at
 * launch is the device's: `liftcamp:social:<userId>`, an AsyncStorage
 * read that never waits on supabase-js. The server read follows and
 * writes the cache; the tabs take a changed answer on the next launch,
 * because hiding a native tab while the app runs remounts the navigator.
 *
 * Fails closed. Signed out, a guest, or a failed read with nothing cached
 * is off. A failed read keeps what this device cached for the same user,
 * so the tabs do not change with the signal. The cache is per user and
 * never read for anyone else, so a sign-out leaves it in place: the same
 * account signing back in keeps its tabs.
 *
 * It reads again when the user changes and when the app comes to the
 * foreground. No polling.
 */

type SocialState = {
  /** The signed-up user the store follows; null when signed out or a guest. */
  userId: string | null;
  /** The user whose device cache has been read, once it has. */
  readFor: string | null;
  /** The latest answer: the device cache, then each server read that lands. */
  on: boolean | null;
  /** True once the first user after launch is resolved, for the launch gate. */
  settled: boolean;
};

let state: SocialState = { userId: null, readFor: null, on: null, settled: false };
const listeners = new Set<() => void>();

function set(next: Partial<SocialState>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The cached answer for `userId`, then the server's, if that is still the user. */
async function load(userId: string) {
  const key = socialCacheKey(userId);
  const cached =
    state.readFor === userId
      ? state.on
      : parseSocialCache(await AsyncStorage.getItem(key).catch(() => null));
  if (state.userId !== userId) return;
  if (state.readFor !== userId) set({ readFor: userId, on: cached, settled: true });

  let read: { ok: true; on: boolean } | { ok: false };
  try {
    const { data, error } = await supabase.rpc('social_access');
    read = error || typeof data !== 'boolean' ? { ok: false } : { ok: true, on: data };
  } catch {
    read = { ok: false };
  }
  if (state.userId !== userId) return;

  const on = socialAfterRead(read, cached);
  if (on !== state.on) set({ on });
  if (read.ok) void AsyncStorage.setItem(key, socialCacheValue(on)).catch(() => {});
}

function follow(userId: string | null, isGuest: boolean) {
  const next = userId && !isGuest ? userId : null;
  if (next === state.userId && state.settled) return;
  if (!next) {
    set({ userId: null, readFor: null, on: false, settled: true });
    return;
  }
  set({ userId: next, readFor: null, on: null });
  void load(next);
}

AppState.addEventListener('change', (next) => {
  if (next === 'active' && state.userId) void load(state.userId);
});

/**
 * Keeps the store on the signed-in user. Mounted once, inside
 * AuthProvider; renders nothing. Waits for the stored session, so a launch
 * with one never settles as signed out first.
 */
export function SocialAccessSync() {
  const { session, loading } = useAuth();
  const userId = session?.user.id ?? null;
  const isGuest = !!session?.user.is_anonymous;
  useEffect(() => {
    if (!loading) follow(userId, isGuest);
  }, [userId, isGuest, loading]);
  return null;
}

/**
 * True once the launch's user has its device answer (or there is no user
 * to ask about). RootStack holds the splash for it, so the tabs know their
 * layout on the first frame. Stays true after that.
 */
export function useSocialSettled(): boolean {
  return useSyncExternalStore(subscribe, () => state.settled);
}

/**
 * The layout the tabs would draw if they mounted now, or null while the
 * user's cache is being read. The tabs layout keeps the first non-null
 * answer for as long as it is mounted.
 */
export function useLayoutAtMount(): TabLayout | null {
  const { session } = useAuth();
  const snap = useSyncExternalStore(subscribe, () => state);
  return layoutAtMount({
    userId: session?.user.id ?? null,
    isGuest: !!session?.user.is_anonymous,
    readFor: snap.readFor,
    cached: snap.on,
  });
}
