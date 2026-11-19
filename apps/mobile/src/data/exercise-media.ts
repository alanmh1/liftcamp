import { useEffect, useSyncExternalStore } from 'react';

import { peekAllExercises, type ExerciseInfo } from '@/data/workouts';
import { supabase } from '../../lib/supabase';

/** What ExerciseThumb draws from. */
export type ExerciseMedia = Pick<ExerciseInfo, 'id' | 'name' | 'gif_url_sm' | 'gif_url' | 'image_url'>;

const MEDIA_FIELDS = 'id, name, gif_url_sm, gif_url, image_url';
/** Ids per request, to keep the `in` filter's URL short. */
const CHUNK = 100;

/**
 * Thumbnails for the feed cards' exercise rows. social_feed carries only
 * each exercise's id and name, and the catalog is on the phone only after
 * the picker has loaded it (peekAllExercises), so the rest are read here:
 * the ids every card on screen asks for in one render are gathered into one
 * request, and each answer is kept for the session.
 *
 * Null for an id the read did not return: someone else's custom exercise,
 * which RLS hides, or one since deleted. The row then draws the letter tile.
 * A failed read records nothing, so the next feed load asks again.
 */
const known = new Map<string, ExerciseMedia | null>();
const queued = new Set<string>();
const inFlight = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version += 1;
  for (const l of listeners) l();
}

function fromPicker(id: string): ExerciseMedia | undefined {
  return peekAllExercises()?.find((e) => e.id === id);
}

function request(ids: readonly string[]) {
  let seeded = false;
  for (const id of ids) {
    if (known.has(id) || inFlight.has(id)) continue;
    const local = fromPicker(id);
    if (local) {
      known.set(id, local);
      seeded = true;
    } else {
      queued.add(id);
    }
  }
  if (seeded) notify();
  if (queued.size > 0 && !timer) timer = setTimeout(flush, 0);
}

function flush() {
  timer = null;
  const ids = [...queued];
  queued.clear();
  for (let i = 0; i < ids.length; i += CHUNK) void read(ids.slice(i, i + CHUNK));
}

async function read(ids: string[]) {
  for (const id of ids) inFlight.add(id);
  try {
    const { data, error } = await supabase.from('exercises').select(MEDIA_FIELDS).in('id', ids);
    if (error || !data) return;
    const byId = new Map((data as ExerciseMedia[]).map((e) => [e.id, e]));
    for (const id of ids) known.set(id, byId.get(id) ?? null);
    notify();
  } catch {
    // No signal: leave them unknown for the next load.
  } finally {
    for (const id of ids) inFlight.delete(id);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Looks up thumbnails for `ids`, asking for any not yet known. The lookup
 * gives the row, null when there is none to show, or undefined while it is
 * being read.
 */
export function useExerciseMedia(ids: readonly string[]): (id: string) => ExerciseMedia | null | undefined {
  useSyncExternalStore(subscribe, () => version);
  const key = ids.join(',');
  useEffect(() => {
    if (key) request(key.split(','));
  }, [key]);
  return (id) => known.get(id);
}
