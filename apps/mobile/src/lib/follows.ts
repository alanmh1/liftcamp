import type { FollowRow } from '@liftcamp/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { listFollows } from '@/data/social';

/**
 * The signed-in user's list_follows() rows, read once and shared by
 * everything that shows them: the Profile tab's badge, Home's requests
 * line and invite card, Profile's counts, and the Followers and Following
 * lists. The split into followers, following, requests and sent is
 * `splitFollows` in shared.
 *
 * Read when social is on for the run (useFollowsSync, mounted in the tabs
 * layout), on each return to the foreground, and each time Home, Profile,
 * Followers or Following gains focus (useRefreshFollowsOnFocus), which
 * includes a modal such as the invite screen closing over them. That is
 * how an approval made on the other person's phone shows up here.
 * A failed read keeps the rows held. Actions update the rows in place
 * (`updateFollows`) so a list changes at the tap, then read again.
 *
 * Memory only. Nothing about other people is stored on the phone.
 */

/** Whose rows these are; rows for anyone else are never shown. */
let owner: string | null = null;
/** Null until the first read for `owner` lands. */
let rows: FollowRow[] | null = null;
/**
 * Counts reads, so only the newest one lands. Focus, the foreground and an
 * action can start reads close together, and an older answer arriving last
 * would put back rows the newer one had moved on from.
 */
let readSeq = 0;
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

function own(userId: string | null) {
  if (owner === userId) return;
  owner = userId;
  rows = null;
  notify();
}

/** Reads the rows again. Resolves once they are in, or the read failed. */
export async function refreshFollows(userId: string): Promise<void> {
  own(userId);
  const seq = ++readSeq;
  const result = await listFollows();
  if (owner !== userId || seq !== readSeq || !result.ok) return;
  rows = result.data;
  notify();
}

/** Changes the held rows at once, ahead of the server's answer. */
export function updateFollows(userId: string, change: (rows: FollowRow[]) => FollowRow[]) {
  if (owner !== userId || !rows) return;
  rows = change(rows);
  notify();
}

/** The rows for `userId`, or null until the first read lands. */
export function useFollowRows(userId: string | null | undefined): FollowRow[] | null {
  return useSyncExternalStore(subscribe, () => (userId && owner === userId ? rows : null));
}

/**
 * Reads the rows again each time the screen gains focus, for `userId`
 * with social on; nothing for null. Focus comes back when a root modal
 * (the invite screen, link-account) closes over the screen, as well as on
 * a tab switch or a pop back to it.
 */
export function useRefreshFollowsOnFocus(userId: string | null) {
  useFocusEffect(
    useCallback(() => {
      if (userId) void refreshFollows(userId);
    }, [userId]),
  );
}

/**
 * Keeps the rows read while `userId` has social on: at once, then on each
 * return to the foreground. With social off it holds nothing.
 */
export function useFollowsSync(userId: string | null) {
  useEffect(() => {
    own(userId);
    if (!userId) return;
    void refreshFollows(userId);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refreshFollows(userId);
    });
    return () => sub.remove();
  }, [userId]);
}
