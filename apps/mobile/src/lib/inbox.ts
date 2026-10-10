import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  hasUnseenInbox,
  inboxItems,
  inboxSeenKey,
  inboxSeenValue,
  parseInboxSeen,
  type Inbox,
  type KudosInboxRow,
} from '@liftcamp/shared';
import { useMemo, useSyncExternalStore } from 'react';

import { kudosInbox } from '@/data/social';
import { useFollowRows } from '@/lib/follows';

/**
 * The notifications inbox behind Home's bell, built from data that already
 * exists (docs/social-spec.md, Notifications): the follow rows Profile
 * holds (lib/follows.ts) and social_kudos_inbox(). No notifications table
 * and no push.
 *
 * The kudos rows are read on each focus of Home, each return to the
 * foreground, and when the inbox opens. Last seen is this device's
 * (`liftcamp:inbox-seen:<userId>`), so a second phone shows the dot again.
 *
 * Fails quiet: a failed kudos read keeps what is held, or none; the seen
 * read failing leaves the dot off until it is known. Nothing here throws.
 */

let owner: string | null = null;
/** Null until the first kudos read for `owner` lands. */
let kudos: KudosInboxRow[] | null = null;
/** Undefined until this device's last-seen is read for `owner`. */
let seen: number | null | undefined;
let readSeq = 0;
let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version += 1;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function own(userId: string) {
  if (owner === userId) return;
  owner = userId;
  kudos = null;
  seen = undefined;
  readSeq += 1;
  notify();
  void AsyncStorage.getItem(inboxSeenKey(userId))
    .then((raw) => {
      if (owner !== userId) return;
      seen = parseInboxSeen(raw);
      notify();
    })
    .catch(() => {
      if (owner !== userId) return;
      seen = null;
      notify();
    });
}

/** Reads the kudos rows again. Never throws. */
export async function refreshInbox(userId: string): Promise<void> {
  try {
    own(userId);
    const seq = ++readSeq;
    const result = await kudosInbox();
    if (owner !== userId || seq !== readSeq || !result.ok) return;
    kudos = result.data ?? [];
    notify();
  } catch {
    // Keeps what is held.
  }
}

/** The inbox was opened: everything in it now is seen on this device. */
export function markInboxSeen(userId: string, at: number = Date.now()) {
  if (owner !== userId) own(userId);
  seen = at;
  notify();
  void AsyncStorage.setItem(inboxSeenKey(userId), inboxSeenValue(at)).catch(() => {});
}

/**
 * The inbox for `userId`, with social on, and whether the bell shows its
 * dot. Null until the follow rows are in; the kudos join it when they land.
 */
export function useInbox(userId: string | null): { inbox: Inbox | null; unseen: boolean; kudosLoaded: boolean } {
  const v = useSyncExternalStore(subscribe, () => version);
  const rows = useFollowRows(userId);
  return useMemo(() => {
    if (!userId || owner !== userId || !rows) return { inbox: null, unseen: false, kudosLoaded: false };
    const inbox = inboxItems(rows, kudos ?? [], userId, Date.now());
    // No dot until this device's last seen is known, so it never flashes.
    const unseen = seen === undefined ? false : hasUnseenInbox(inbox, seen);
    return { inbox, unseen, kudosLoaded: kudos != null };
    // `v` stands for the module state read above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, rows, v]);
}
