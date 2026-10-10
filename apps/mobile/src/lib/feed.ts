import { FEED_PAGE, appendFeedPage, feedCursor, type FeedItem } from '@liftcamp/shared';
import { useSyncExternalStore } from 'react';

import { socialFeed } from '@/data/social';
import { dropKudosStates } from '@/lib/kudos';

/**
 * The following feed on Home: social_feed() pages held in memory for the
 * signed-in user, newest first. Read on each focus of Home and each return
 * to the foreground (the feed slot asks), and a page more on Show more.
 *
 * Fails quiet. A read that fails keeps what is held; with nothing held the
 * slot draws nothing for the feed. Nothing here throws, so a read that
 * starts at launch or on focus cannot leave an unhandled rejection.
 *
 * Memory only. Nothing about other people is stored on the phone.
 */

export type FeedState = {
  /** Null until the first read for this user lands. */
  items: FeedItem[] | null;
  /** More may exist past the last item. */
  more: boolean;
  loadingMore: boolean;
};

const EMPTY: FeedState = { items: null, more: false, loadingMore: false };

let owner: string | null = null;
let state: FeedState = EMPTY;
/** Only the newest first-page read lands; Show more is dropped by a newer refresh. */
let readSeq = 0;
const listeners = new Set<() => void>();

function set(next: FeedState) {
  state = next;
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
  readSeq += 1;
  set(EMPTY);
}

/** Reads the first page again. Never throws. */
export async function refreshFeed(userId: string): Promise<void> {
  try {
    own(userId);
    const seq = ++readSeq;
    const result = await socialFeed({ cursor: null, limit: FEED_PAGE });
    if (owner !== userId || seq !== readSeq || !result.ok) return;
    const items = result.data ?? [];
    dropKudosStates(userId, items.map((i) => i.workout_id));
    set({ items, more: items.length >= FEED_PAGE, loadingMore: false });
  } catch {
    // Keeps what is held.
  }
}

/** Show more: the next page after the last held item. Never throws. */
export async function loadMoreFeed(userId: string): Promise<void> {
  try {
    if (owner !== userId || !state.items || state.loadingMore || !state.more) return;
    const cursor = feedCursor(state.items);
    if (!cursor) return;
    const seq = readSeq;
    set({ ...state, loadingMore: true });
    const result = await socialFeed({ cursor, limit: FEED_PAGE });
    if (owner !== userId || seq !== readSeq) return;
    if (!result.ok || !state.items) {
      set({ ...state, loadingMore: false });
      return;
    }
    const page = result.data ?? [];
    set({ items: appendFeedPage(state.items, page), more: page.length >= FEED_PAGE, loadingMore: false });
  } catch {
    if (owner === userId) set({ ...state, loadingMore: false });
  }
}

/** The held feed for `userId`, or the empty state for anyone else. */
export function useFeed(userId: string | null): FeedState {
  return useSyncExternalStore(subscribe, () => (userId && owner === userId ? state : EMPTY));
}
