import {
  importBatches,
  importTag,
  type ImportMapRow,
  type ImportSource,
  type ImportWorkoutPayload,
  type Json,
  type MatchCatalogEntry,
} from '@liftcamp/shared';

import { localDateIso } from '@/data/home';
import { invalidateScanCache } from '@/data/scan-cache';
import { searchExercises, type ExerciseInfo } from '@/data/workouts';
import { networkFailedSince } from '@/lib/network';
import { supabase } from '../../lib/supabase';

/**
 * Workout import (docs/import-workouts-spec.md). Parsing, matching and the
 * payload are in shared (`packages/shared/src/import`); this module reads
 * what they need and sends the result to `import_workouts`
 * (docs/import-workouts.sql), 50 workouts a call.
 *
 * Imported workouts carry `platform = 'import'` and `app_version`
 * `<source>-csv`, which is how the function skips a start already in and
 * how Settings counts and removes them.
 */

export const IMPORT_PLATFORM = 'import';

/** The catalog entry the import works with: the library row plus its aliases. */
export type ImportCatalogEntry = ExerciseInfo & MatchCatalogEntry;

export type ImportContext = {
  catalog: ImportCatalogEntry[];
  map: ImportMapRow[];
  /** Local dates with a finished workout not imported from this source. */
  existingDates: Set<string>;
  /** Starts of workouts already imported from this source. */
  importedStarts: Set<string>;
};

/** PostgREST's row cap per response; the workout list is read in pages of it. */
const PAGE = 1000;

type WorkoutDateRow = { workout_date: string; created_at: string; app_version: string | null };

async function readFinishedWorkouts(userId: string): Promise<WorkoutDateRow[] | null> {
  const out: WorkoutDateRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('workouts')
      .select('workout_date, created_at, app_version')
      .eq('user_id', userId)
      .not('finished_at', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data) return null;
    out.push(...(data as WorkoutDateRow[]));
    if (data.length < PAGE) return out;
  }
}

/** The 343 catalog rows with aliases, as `id` to `alias_text`. Null on a failed read. */
async function readAliases(): Promise<Map<string, string> | null> {
  const out = new Map<string, string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, alias_text')
      .not('alias_text', 'is', null)
      .neq('alias_text', '')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data) return null;
    for (const row of data) if (row.alias_text) out.set(row.id, row.alias_text);
    if (data.length < PAGE) return out;
  }
}

/**
 * Everything the review step needs, read once after a file parses: the
 * library through the app's loader, its aliases, the source's name map,
 * and the user's finished workouts for the two skip rules. Null when any
 * read fails.
 */
export async function loadImportContext(userId: string, source: ImportSource): Promise<ImportContext | null> {
  const [library, aliases, mapRes, workouts] = await Promise.all([
    searchExercises(''),
    readAliases(),
    supabase.from('import_exercise_map').select('source_name, exercise_id, close').eq('source', source),
    readFinishedWorkouts(userId),
  ]);
  // The loader answers an empty list on a failed read; the library is never empty.
  if (library.length === 0 || !aliases || mapRes.error || !mapRes.data || !workouts) return null;

  const tag = importTag(source);
  const existingDates = new Set<string>();
  const importedStarts = new Set<string>();
  for (const w of workouts) {
    if (w.app_version === tag) importedStarts.add(w.created_at);
    else existingDates.add(w.workout_date);
  }

  return {
    catalog: library.map((e) => ({ ...e, alias_text: aliases.get(e.id) ?? null })),
    map: mapRes.data,
    existingDates,
    importedStarts,
  };
}

/** The device's local date of an ISO time, YYYY-MM-DD. */
export function localDateOf(iso: string): string {
  return localDateIso(new Date(iso));
}

export type ImportRun =
  | { ok: true; inserted: number; skipped: number }
  /** `sent` workouts got through (inserted or already in) before a call failed. */
  | { ok: false; offline: boolean; sent: number; inserted: number };

/**
 * Sends the workouts 50 a call. `onProgress` gets the number sent so far
 * after each call. A failed call stops the run; trying again resends
 * everything, and the function skips what is already in.
 */
export async function runImport(
  source: ImportSource,
  workouts: ImportWorkoutPayload[],
  onProgress: (sent: number) => void,
): Promise<ImportRun> {
  const started = Date.now();
  let sent = 0;
  let inserted = 0;
  let skipped = 0;
  try {
    for (const batch of importBatches(workouts)) {
      const { data, error } = await supabase.rpc('import_workouts', {
        p_source: source,
        p_workouts: batch as unknown as Json,
      });
      if (error) return { ok: false, offline: networkFailedSince(started), sent, inserted };
      const row = data?.[0];
      inserted += row?.inserted ?? 0;
      skipped += row?.skipped ?? 0;
      sent += batch.length;
      onProgress(sent);
    }
  } catch {
    return { ok: false, offline: networkFailedSince(started), sent, inserted };
  } finally {
    // Whatever got in is history now, so every screen reading the scan reloads.
    if (inserted > 0) invalidateScanCache();
  }
  return { ok: true, inserted, skipped };
}

/** How many workouts the user has imported from the source. Null on a failed read. */
export async function getImportedCount(userId: string, source: ImportSource): Promise<number | null> {
  const { count, error } = await supabase
    .from('workouts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('platform', IMPORT_PLATFORM)
    .eq('app_version', importTag(source));
  return error ? null : (count ?? 0);
}

/**
 * Deletes every workout imported from the source. Their exercises and sets
 * go with them (ON DELETE CASCADE). Workouts logged in LiftCamp are not
 * touched, and medals already earned stay. True when the delete went through.
 */
export async function removeImported(userId: string, source: ImportSource): Promise<boolean> {
  const { error } = await supabase
    .from('workouts')
    .delete()
    .eq('user_id', userId)
    .eq('platform', IMPORT_PLATFORM)
    .eq('app_version', importTag(source));
  if (error) return false;
  invalidateScanCache();
  return true;
}
