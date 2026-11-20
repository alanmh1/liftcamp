import type { RecentComment } from '@liftcamp/shared';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { socialWorkout, workoutComments } from '@/data/social';

/**
 * Comment counts the user has seen change this run, by workout, so a feed
 * card and the friend workout show the count the comments screen last
 * read, added to or deleted from, without reading the feed again. The same
 * pattern as lib/kudos.ts.
 *
 * Memory only, cleared when the user changes. A feed read that lands drops
 * the counts for the workouts it returned, since it is newer.
 */

let owner: string | null = null;
const counts = new Map<string, number>();
/** A card's latest 2 comments, read again after the comments screen. */
const recent = new Map<string, RecentComment[]>();
const listeners = new Set<() => void>();
let version = 0;

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
  counts.clear();
  recent.clear();
  notify();
}

/** The comments screen's count for `workoutId`, once its list is known or changes. */
export function setCommentCount(userId: string, workoutId: string, count: number) {
  own(userId);
  if (counts.get(workoutId) === count) return;
  counts.set(workoutId, count);
  notify();
}

/** Forgets the held counts for workouts a fresh read just returned. */
export function dropCommentCounts(userId: string, workoutIds: readonly string[]) {
  if (owner !== userId) return;
  let changed = false;
  for (const id of workoutIds) {
    changed = counts.delete(id) || changed;
    changed = recent.delete(id) || changed;
  }
  if (changed) notify();
}

/** The latest 2 comments to draw on a card: this run's re-read, or what the read said. */
export function useRecentComments(userId: string | null, workoutId: string, fromRead: RecentComment[]): RecentComment[] {
  useSyncExternalStore(subscribe, () => version);
  if (!userId || owner !== userId) return fromRead;
  return recent.get(workoutId) ?? fromRead;
}

/**
 * Reads one workout again through social_workout, after the comments
 * screen closes over a card, and holds its latest 2 comments and its
 * count for the card to draw. Only that workout, not the feed. Never
 * throws; a failed read keeps what is drawn.
 */
export async function refreshCardComments(userId: string, workoutId: string): Promise<void> {
  try {
    const result = await socialWorkout(workoutId);
    if (!result.ok || !result.data) return;
    own(userId);
    recent.set(workoutId, result.data.recent_comments);
    counts.set(workoutId, result.data.comment_count);
    notify();
  } catch {
    // Keeps what is drawn.
  }
}

/** The count to draw: this run's, or what the read said. */
export function useCommentCount(userId: string | null, workoutId: string, fromRead: number): number {
  useSyncExternalStore(subscribe, () => version);
  if (!userId || owner !== userId) return fromRead;
  return counts.get(workoutId) ?? fromRead;
}

/**
 * The comment count on one of the user's own workouts, read with
 * workout_comments() when `enabled` (social on), when the workout changes
 * and when `refreshKey` does (the detail bumps it on each focus). Null
 * until it lands and whenever it fails, which hides the row; a failed
 * re-read keeps the last answer. The comments screen's count wins once it
 * has one. Never throws.
 */
export function useOwnCommentCount(
  userId: string | null,
  workoutId: string | null | undefined,
  enabled: boolean,
  refreshKey = 0,
): number | null {
  const [read, setRead] = useState<{ id: string; count: number } | null>(null);
  useEffect(() => {
    if (!enabled || !workoutId) return;
    let cancelled = false;
    workoutComments(workoutId)
      .then((result) => {
        if (!cancelled && result.ok) setRead({ id: workoutId, count: result.data.length });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [workoutId, enabled, refreshKey]);
  const fromRead = enabled && read && read.id === workoutId ? read.count : null;
  const held = useCommentCount(userId, workoutId ?? '', fromRead ?? -1);
  if (!enabled || !workoutId) return null;
  return held >= 0 ? held : null;
}
