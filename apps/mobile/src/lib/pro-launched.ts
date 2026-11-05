import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORAGE_PREFIX } from '@liftcamp/shared';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { supabase } from '../../lib/supabase';

/**
 * Whether Pro is on sale for the signed-in user: `pro_launched()`, the
 * global pro_launched flag from /admin Feature flags, or a personal grant
 * (docs/revenuecat.sql). A function and not a read of app_flags, because
 * guests cannot read that table and guests can buy.
 *
 * It decides only whether the app sells. It never takes Pro away: anyone
 * who has Pro keeps it with the flag off (lib/pro.ts).
 *
 * The device-cache pattern of lib/tester-pro.ts. Fails closed: signed out,
 * or a failed read with nothing cached, is off. Reads when the user
 * changes and on foreground, so turning the flag on reaches a running app
 * the next time it opens. No polling, and nothing waits on it.
 */

function cacheKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}pro-launched:${userId}`;
}

type State = { userId: string | null; on: boolean };

let state: State = { userId: null, on: false };
const listeners = new Set<() => void>();

function set(next: State) {
  if (next.userId === state.userId && next.on === state.on) return;
  state = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function load(userId: string) {
  const key = cacheKey(userId);
  const cached = await AsyncStorage.getItem(key).catch(() => null);
  if (state.userId !== userId) return;
  if (cached === '1') set({ userId, on: true });

  let on: boolean | null = null;
  try {
    const { data, error } = await supabase.rpc('pro_launched');
    on = error ? null : data === true;
  } catch {
    on = null;
  }
  if (state.userId !== userId || on === null) return;

  set({ userId, on });
  void AsyncStorage.setItem(key, on ? '1' : '0').catch(() => {});
}

function follow(userId: string | null) {
  if (userId === state.userId) return;
  const previous = state.userId;
  set({ userId, on: false });
  if (previous) void AsyncStorage.removeItem(cacheKey(previous)).catch(() => {});
  if (userId) void load(userId);
}

AppState.addEventListener('change', (next) => {
  if (next === 'active' && state.userId) void load(state.userId);
});

/** Keeps the store on the signed-in user. Mounted once, inside AuthProvider; renders nothing. */
export function ProLaunchedSync() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  useEffect(() => {
    follow(userId);
  }, [userId]);
  return null;
}

/** Whether Pro is on sale for this user. */
export function useProLaunched(): boolean {
  return useSyncExternalStore(subscribe, () => state.on);
}
