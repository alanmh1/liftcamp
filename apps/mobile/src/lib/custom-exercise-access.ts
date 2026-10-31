import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORAGE_PREFIX, parseCustomExerciseStatus, type CustomExerciseStatus } from '@liftcamp/shared';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { supabase } from '../../lib/supabase';

/**
 * Whether the signed-in user may create custom exercises, and how many
 * they have against the free cap: `custom_exercise_status()`, which the
 * server decides from the flag, the grant, Pro and the count
 * (docs/custom-exercises.sql, section 6).
 *
 * The same device-cache pattern as tester Pro (lib/tester-pro.ts), not the
 * launch latch social uses: a Create row appearing mid-session is fine,
 * and the count changes every time the user creates or deletes, so the
 * store refreshes. The cached answer draws the row on the first frame
 * after launch; the server's answer replaces it when it lands.
 *
 * Fails closed. Signed out, a guest, or a failed read with nothing cached
 * is off. Guests never get the row: the server refuses them anyway.
 *
 * Reads when the user changes, when the app comes to the foreground, and
 * on demand after a create, edit, delete or restore
 * (refreshCustomExerciseStatus). No polling.
 */

function cacheKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}custom-exercises:${userId}`;
}

type State = { userId: string | null; status: CustomExerciseStatus | null };

let state: State = { userId: null, status: null };
const listeners = new Set<() => void>();

function set(next: State) {
  if (next.userId === state.userId && next.status === state.status) return;
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
  const cachedRaw = await AsyncStorage.getItem(key).catch(() => null);
  const cached = cachedRaw ? parseCustomExerciseStatus(JSON.parse(cachedRaw)) : null;
  if (state.userId !== userId) return;
  if (cached && !state.status) set({ userId, status: cached });

  let status: CustomExerciseStatus | null = null;
  try {
    const { data, error } = await supabase.rpc('custom_exercise_status');
    status = error ? null : parseCustomExerciseStatus(data);
  } catch {
    status = null;
  }
  if (state.userId !== userId || !status) return;

  set({ userId, status });
  void AsyncStorage.setItem(key, JSON.stringify(status)).catch(() => {});
}

function follow(userId: string | null, isGuest: boolean) {
  const next = userId && !isGuest ? userId : null;
  if (next === state.userId) return;
  const previous = state.userId;
  set({ userId: next, status: null });
  // One account's answer never shows for another.
  if (previous && previous !== next) void AsyncStorage.removeItem(cacheKey(previous)).catch(() => {});
  if (next) void load(next);
}

AppState.addEventListener('change', (next) => {
  if (next === 'active' && state.userId) void load(state.userId);
});

/** Reads again now. Called after every write to a custom exercise. */
export function refreshCustomExerciseStatus(): void {
  if (state.userId) void load(state.userId);
}

/**
 * Keeps the store on the signed-in user. Mounted once, inside
 * AuthProvider; renders nothing.
 */
export function CustomExerciseAccessSync() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const isGuest = !!session?.user.is_anonymous;
  useEffect(() => {
    follow(userId, isGuest);
  }, [userId, isGuest]);
  return null;
}

/**
 * The signed-in user's status, or null while unknown (treat as off). The
 * cached copy comes first, then the server's.
 */
export function useCustomExerciseStatus(): CustomExerciseStatus | null {
  return useSyncExternalStore(subscribe, () => state.status);
}
