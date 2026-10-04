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
 * Two answers, kept apart on purpose:
 *
 * - The launch layout. The device cache (`liftcamp:social:<userId>`, an
 *   AsyncStorage read, never supabase-js) is read once per user per app
 *   run and latched. The tabs draw from it and nothing changes it until
 *   the app restarts: hiding a native tab while the app runs remounts the
 *   navigator. It is the only thing components subscribe to, and it
 *   notifies once, when it is first known.
 * - The server's answer. Each `social_access()` read that lands writes the
 *   cache for the next launch and nothing else. It never notifies a
 *   listener, so a read that lands mid-session re-renders nothing.
 *
 * Fails closed. Signed out, a guest, or a failed read with nothing cached
 * is off. A failed read leaves the cache as it was. The cache is per user
 * and never read for anyone else, so a sign-out leaves it in place.
 *
 * The server read runs when the user changes and when the app comes to
 * the foreground. No polling.
 */

/** The user the store follows; null when signed out or a guest. */
let userId: string | null = null;
/** True once the first user after launch is resolved, for the launch gate. */
let settled = false;
/** Each user's cached answer as this run first read it. Never overwritten. */
const launched = new Map<string, boolean | null>();
/** The latest answer for `userId`, cache then server. Notifies no one. */
let latest: boolean | null = null;

const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Latches `id`'s launch answer from the device on first sight, then asks the server. */
async function load(id: string) {
  if (!launched.has(id)) {
    const cached = parseSocialCache(await AsyncStorage.getItem(socialCacheKey(id)).catch(() => null));
    if (!launched.has(id)) {
      launched.set(id, cached);
      if (userId === id) latest = cached;
      settled = true;
      notify();
    }
  }
  if (userId !== id) return;

  let read: { ok: true; on: boolean } | { ok: false };
  try {
    const { data, error } = await supabase.rpc('social_access');
    read = error || typeof data !== 'boolean' ? { ok: false } : { ok: true, on: data };
  } catch {
    read = { ok: false };
  }
  if (userId !== id || !read.ok) return;

  // For the next launch only. No listener hears this.
  latest = socialAfterRead(read, latest);
  void AsyncStorage.setItem(socialCacheKey(id), socialCacheValue(latest)).catch(() => {});
}

function follow(id: string | null, isGuest: boolean) {
  const next = id && !isGuest ? id : null;
  if (next === userId && settled) return;
  userId = next;
  latest = next ? (launched.get(next) ?? null) : null;
  if (!next) {
    if (!settled) {
      settled = true;
      notify();
    }
    return;
  }
  void load(next);
}

AppState.addEventListener('change', (next) => {
  if (next === 'active' && userId) void load(userId);
});

/**
 * Keeps the store on the signed-in user. Mounted once, inside
 * AuthProvider; renders nothing. Waits for the stored session, so a launch
 * with one never settles as signed out first.
 */
export function SocialAccessSync() {
  const { session, loading } = useAuth();
  const id = session?.user.id ?? null;
  const isGuest = !!session?.user.is_anonymous;
  useEffect(() => {
    if (!loading) follow(id, isGuest);
  }, [id, isGuest, loading]);
  return null;
}

/**
 * True once the launch's user has its device answer (or there is no user
 * to ask about). RootStack holds the splash for it, so the tabs know their
 * layout on the first frame. Stays true after that.
 */
export function useSocialSettled(): boolean {
  return useSyncExternalStore(subscribe, () => settled);
}

/**
 * The layout this run draws for the signed-in user, or null while their
 * device cache is being read. Goes from null to a value once per user per
 * app run and never changes after that, whatever the server says.
 */
export function useLaunchLayout(): TabLayout | null {
  const { session } = useAuth();
  const id = session?.user.id ?? null;
  const isGuest = !!session?.user.is_anonymous;
  return useSyncExternalStore(subscribe, () =>
    layoutAtMount({
      userId: id,
      isGuest,
      readFor: id && launched.has(id) ? id : null,
      cached: id ? (launched.get(id) ?? null) : null,
    }),
  );
}
