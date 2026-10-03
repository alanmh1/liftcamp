import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  entitlementActive,
  entitlementAfterRead,
  entitlementOnUser,
  parseEntitlementCache,
  testerProKey,
  type EntitlementRow,
  type EntitlementState,
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
 * Fails closed. Signed out, a guest, or a successful read that finds no
 * row all mean no grant, and so does a failed read with nothing cached.
 * A failed read (no signal, a timeout) keeps the row this device cached
 * for the same user, so a tester keeps Pro in a gym with no signal; a
 * revoke reaches the phone on the next read that lands. Expiry is checked
 * on every render, so a cached grant past its expiry closes offline too.
 * Sign-out and any change of user drop the previous user's cache, so one
 * account's grant never shows for another.
 *
 * Nothing waits on it. The device's cached row answers at once (an
 * AsyncStorage read, never supabase-js) while the server read is on its
 * way. It reads again when the user changes (sign-in, sign-out, a guest
 * linking an account) and when the app comes to the foreground. No
 * polling.
 */

let state: EntitlementState = { userId: null, row: null };
const listeners = new Set<() => void>();

function set(next: EntitlementState) {
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

/** Shows the cached row for `userId`, then the server's answer, if that is still the user. */
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

  const row = entitlementAfterRead(read, cached);
  set({ userId, row });
  if (read.ok) {
    if (row) void AsyncStorage.setItem(key, JSON.stringify(row)).catch(() => {});
    else void AsyncStorage.removeItem(key).catch(() => {});
  }
}

/** Points the store at the signed-in user (rules in `entitlementOnUser`), then reads their row. */
function follow(userId: string | null, isGuest: boolean) {
  const { state: next, dropCacheFor } = entitlementOnUser(state, { userId, isGuest });
  set(next);
  if (dropCacheFor) void AsyncStorage.removeItem(testerProKey(dropCacheFor)).catch(() => {});
  if (next.userId) void load(next.userId);
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
