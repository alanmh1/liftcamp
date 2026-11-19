import { canInteract, toggleKudos, type KudosState } from '@liftcamp/shared';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Alert } from 'react-native';

import { toggleKudosOn, workoutKudos, type KudosGiver } from '@/data/social';

/**
 * Kudos the user gave or took back this run, by workout, so the feed card,
 * a person's workout list and the workout's detail agree without reading
 * again. A tap changes the state at once (toggleKudos in shared), then
 * takes the server's answer, or goes back with a message when it fails.
 *
 * One request per workout at a time: a tap while one is out does nothing,
 * so a quick double tap cannot race itself into the wrong state.
 *
 * Likes need a mutual follow (can_interact on the read). When toggle_kudos
 * refuses with 42501 (the other person unfollowed since the read), the tap
 * goes back and the workout is held as not mutual, so the card and the
 * workout swap the button for the mutual-only line at once.
 *
 * Memory only, cleared when the user changes. A feed read that lands drops
 * the states for the workouts it returned, since it is newer.
 */

let owner: string | null = null;
const states = new Map<string, KudosState>();
const inFlight = new Set<string>();
/** Workouts toggle_kudos refused this run for want of a mutual follow. */
const refused = new Set<string>();
const listeners = new Set<() => void>();
/** Bumped on every change, so useSyncExternalStore sees one. */
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
  states.clear();
  inFlight.clear();
  refused.clear();
  notify();
}

/** Forgets the held states for workouts a fresh read just returned. */
export function dropKudosStates(userId: string, workoutIds: readonly string[]) {
  if (owner !== userId) return;
  let changed = false;
  for (const id of workoutIds) {
    if (inFlight.has(id)) continue;
    changed = states.delete(id) || changed;
    changed = refused.delete(id) || changed;
  }
  if (changed) notify();
}

/** The kudos state to draw: this run's, or what the read said. */
export function useKudos(userId: string | null, workoutId: string, fromRead: KudosState): KudosState {
  useSyncExternalStore(subscribe, () => version);
  if (!userId || owner !== userId) return fromRead;
  return states.get(workoutId) ?? fromRead;
}

/**
 * Whether the like button shows: the read's can_interact, unless
 * toggle_kudos has since refused this workout.
 */
export function useCanInteract(
  userId: string | null,
  workoutId: string,
  fromRead: { can_interact?: boolean | null },
): boolean {
  useSyncExternalStore(subscribe, () => version);
  if (userId && owner === userId && refused.has(workoutId)) return false;
  return canInteract(fromRead);
}

/** Gives or takes back kudos on `workoutId`. Never throws. */
export async function tapKudos(userId: string, workoutId: string, current: KudosState): Promise<void> {
  own(userId);
  if (inFlight.has(workoutId)) return;
  inFlight.add(workoutId);
  states.set(workoutId, toggleKudos(current));
  notify();
  try {
    const result = await toggleKudosOn(workoutId);
    if (owner !== userId) return;
    if (result.ok) {
      states.set(workoutId, result.data);
    } else if (result.code === '42501') {
      // No mutual follow any more. The line under the card says why.
      states.set(workoutId, current);
      refused.add(workoutId);
    } else {
      states.set(workoutId, current);
      Alert.alert('Kudos did not go through', result.message);
    }
  } catch {
    if (owner === userId) states.set(workoutId, current);
  } finally {
    inFlight.delete(workoutId);
    notify();
  }
}

/**
 * Who gave kudos on one of the user's own workouts, read when `enabled`
 * (social on), when the workout changes, and when `refreshKey` does (Home
 * bumps it on each focus). Null until it lands and whenever it fails,
 * which hides the line; a failed re-read keeps the last answer. Never
 * throws.
 */
export function useKudosGivers(
  workoutId: string | null | undefined,
  enabled: boolean,
  refreshKey = 0,
): KudosGiver[] | null {
  const [givers, setGivers] = useState<{ id: string; list: KudosGiver[] } | null>(null);
  const load = useCallback(async (id: string, isCancelled: () => boolean) => {
    try {
      const result = await workoutKudos(id);
      if (!isCancelled() && result.ok) setGivers({ id, list: result.data ?? [] });
    } catch {
      // Hidden; the card and the detail are whole without it.
    }
  }, []);
  useEffect(() => {
    if (!enabled || !workoutId) return;
    let cancelled = false;
    void load(workoutId, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [workoutId, enabled, load, refreshKey]);
  return enabled && givers && givers.id === workoutId ? givers.list : null;
}
