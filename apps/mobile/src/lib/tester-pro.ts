import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  entitlementActive,
  entitlementAfterRead,
  parseEntitlementCache,
  testerProKey,
  type EntitlementRow,
} from '@liftcamp/shared';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { supabase } from '../../lib/supabase';

/**
 * The signed-in user's tester Pro grant: their `user_entitlements` row,
 * which only an admin writes (admin_set_entitlement, from /admin on the
 * web). The rules are `entitlementActive` and friends in shared.
 *
 * Fails closed. Signed out, a guest, no row, or a failed read (no signal,
 * a server error) all mean no grant.
 *
 * Nothing waits on it. The device's cached row answers at once (an
 * AsyncStorage read, never supabase-js) while the server read is on its
 * way, and that read's answer replaces it, a failure included. It reads
 * again when the user changes (sign-in, sign-out, a guest linking an
 * account) and when the app comes to the foreground. No polling.
 */

type State = { userId: string | null; row: EntitlementRow | null };

let state: State = { userId: null, row: null };
const listeners = new Set<() => void>();

function set(next: State) {
  if (next.userId === state.userId && next.row === state.row) return;
  state = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Shows the cached row for `userId`, then reads the server's and applies it if that is still the user. */
async function load(userId: string) {
  const key = testerProKey(userId);
  const cached = parseEntitlementCache(await AsyncStorage.getItem(key).catch(() => null));
  if (state.userId !== userId) return;
  if (cached && !state.row) set({ userId, row: cached });

  let read: { ok: true; row: EntitlementRow | null } | { ok: false };
  try {
    const { data, error } = await supabase
      .from('user_entitlements')
      .select('is_pro, expires_at')
      .eq('user_id', userId)
      .maybeSingle();
    read = error ? { ok: false } : { ok: true, row: data ?? null };
  } catch {
    read = { ok: false };
  }
  if (state.userId !== userId) return;

  const row = entitlementAfterRead(read);
  set({ userId, row });
  if (read.ok) {
    if (row) void AsyncStorage.setItem(key, JSON.stringify(row)).catch(() => {});
    else void AsyncStorage.removeItem(key).catch(() => {});
  }
}

/**
 * Points the store at a user. Null (signed out) or a guest clears it and
 * drops the previous user's cached row, so the next person on the phone
 * never starts from it.
 */
function follow(userId: string | null, isGuest: boolean) {
  const previous = state.userId;
  if (!userId || isGuest) {
    set({ userId: null, row: null });
    if (previous && !userId) void AsyncStorage.removeItem(testerProKey(previous)).catch(() => {});
    return;
  }
  if (userId !== previous) set({ userId, row: null });
  void load(userId);
}

AppState.addEventListener('change', (next) => {
  if (next === 'active' && state.userId) void load(state.userId);
});

/**
 * Keeps the store on the signed-in user. Mounted once, inside AuthProvider;
 * renders nothing. Keyed on the user id and whether it is a guest, so a
 * guest linking an account reads the account's row.
 */
export function TesterProSync() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const isGuest = !!session?.user.is_anonymous;
  useEffect(() => {
    follow(userId, isGuest);
  }, [userId, isGuest]);
  return null;
}

/** Whether the signed-in user has an active tester grant right now. */
export function useTesterPro(): boolean {
  const row = useSyncExternalStore(subscribe, () => state.row);
  return entitlementActive(row, Date.now());
}
