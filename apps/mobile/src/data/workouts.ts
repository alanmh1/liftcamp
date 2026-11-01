import {
  applyPendingOps,
  asSetType,
  coldStartSuggestion,
  effectiveLoad,
  firstCompletedPriorSession,
  isCardio,
  normalizePriorSets,
  normalizeSearch,
  notesToSave,
  oneRepMaxNumeric,
  startSetCount,
  storedWeightOf,
  toUserUnit,
  weightToWrite,
  withServerDetails as mergeServerDetails,
  type HistorySession,
  type PriorExerciseRow,
  type PriorSet,
  type Progression,
  type InsertRow,
  type OverlayWorkout,
  type StoredWeight,
  type SuggestionWrite,
  type WeightUnit,
} from '@liftcamp/shared';
import { requireOptionalNativeModule } from 'expo';
import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';

import { clearDeviceWorkout, saveDeviceWorkout } from '@/data/device-workout';
import { todayIso } from '@/data/placeholders';
import { rememberRoutineNote } from '@/data/routine-note';
import { bodyweightCache, invalidateScanCache } from '@/data/scan-cache';
import { enqueueWrite, pendingWrites, syncedWithin } from '@/data/write-queue';
import { endWorkoutActivity } from '@/lib/live-activity';
import { cancelFirstNudges } from '@/lib/nudges';
import { cancelRestAlert } from '@/lib/rest-alert';
import { clearRunningRest } from '@/lib/rest-store';
import { supabase } from '../../lib/supabase';

/**
 * Every write the active workout screen performs goes through this module.
 *
 * Each write is queued on the phone first (write-queue.ts) and sent in
 * order when there is signal, so a set logged in a basement gym is kept and
 * syncs later. Screens never import `supabase`.
 *
 * Two rules make replaying a write safe: every insert carries a
 * client-generated UUID and is idempotent on that id, and every update
 * sets absolute values. A write resent after a lost response is a no-op
 * instead of a duplicate row.
 *
 * Reads see the queue: loadWorkout applies the writes still on the phone
 * over what the server returns.
 *
 * Units: every set read passes through `toUserUnit`, so a set in memory is in
 * the user's current unit whatever unit it was logged in. Every write that
 * carries `weight_value` also carries `weight_unit`. Callers pass the unit
 * from `useWeightUnit` rather than this module reading the profile again.
 *
 * A converted set also keeps `stored`, its weight exactly as the row holds
 * it. A weight carried into a new set without being edited is written from
 * `stored`, so it ties its source rather than beating it by the rounding.
 */

export type WorkoutSet = {
  id: string;
  position: number;
  /** In the user's current unit. */
  weight_value: number | null;
  reps: number | null;
  /** Cardio only: the set's time in seconds and distance in meters. */
  duration_seconds: number | null;
  distance_meters: number | null;
  incline_percent: number | null;
  completed: boolean;
  note: string | null;
  /**
   * The weight as stored, when it is in the other unit. Null once the user
   * edits the weight, and for a set already in the current unit.
   */
  stored: StoredWeight | null;
  /**
   * `sets.set_type`: 'warmup' for a Pro generated warm-up row
   * (addWarmupRows), null or missing for every other set.
   */
  set_type?: string | null;
};

/** A prior-session set, converted, with the weight it was logged as. */
export type SeedSource = PriorSet & { stored: StoredWeight | null };

export type ExerciseInfo = {
  id: string;
  name: string;
  weight_type: string | null;
  is_unilateral: boolean;
  mechanic: string | null;
  level: string | null;
  equipment: string | null;
  primary_muscle: string | null;
  /** Pipe-delimited canonical muscles; canonMuscleList() splits it. */
  secondary_muscles: string | null;
  /** 'cardio' for an exercise logged as time and distance (isCardio), else null. */
  set_type: string | null;
  /**
   * A cardio exercise that also takes an incline: the 3 treadmills
   * (hasIncline). Optional, since a phone's copy saved before the column
   * was read has none.
   */
  has_incline?: boolean;
  description: string | null;
  /**
   * Media, in the order the UI falls back through them. The GIFs are the
   * licensed ExerciseDB set: in-app, behind auth, alongside the exercise
   * data only. 548 of 898 rows have them; 882 have a photo; 16 have neither.
   */
  gif_url_sm: string | null;
  gif_url: string | null;
  image_url: string | null;
  /**
   * The user who made it, for a custom exercise; null for the catalog.
   * Optional, since a phone's copy saved before the column was read has
   * none (isCustomExercise in shared reads it either way).
   */
  owner_id?: string | null;
  /** Set when the user deleted their custom exercise. Kept for history. */
  archived_at?: string | null;
};

export type WorkoutExercise = {
  /** The `workout_exercises` row id, not the exercise id. */
  id: string;
  position: number;
  exercise: ExerciseInfo;
  sets: WorkoutSet[];
  /**
   * The user's last finished session of this exercise, for the PREVIOUS
   * column and the placeholders.
   */
  prior: SeedSource[];
  /**
   * Up to the last 10 finished sessions, newest first, with each set in
   * the unit it was logged in: what Pro progression reads. From the same
   * request as `prior`. Missing on a phone copy saved before it existed.
   */
  history?: HistorySession[];
  /** Best estimated 1RM before this workout. Null when never logged. */
  priorBestOrm: number | null;
  /**
   * Finished workouts before this one with a completed set of the exercise.
   * The "one dumbbell" hint under the name stops at 3.
   */
  finishedSessions: number;
  /**
   * The routine's target for this exercise: a set count and free-text reps
   * ("8-10", "30s", "8 each"). Shown as a meta line under the name, and the
   * reps placeholder falls back to its low end. Null for exercises the
   * workout did not get from a routine.
   */
  target: SetTarget | null;
};

export type ActiveWorkout = {
  id: string;
  name: string | null;
  createdAt: string;
  finishedAt: string | null;
  /**
   * The workout's note, as typed (saved trimmed). Missing on a phone copy
   * saved before notes existed.
   */
  notes?: string | null;
  /**
   * The routine day it started from, for "Last time". Null for an empty or
   * generated workout. Missing on a phone copy saved before it existed.
   */
  templateId?: string | null;
  exercises: WorkoutExercise[];
  /** Fetched once here so the screen does not fetch it again. */
  bodyweight: number | null;
};

export { isBodyOnly, placeholderAt, placeholdersFor, progressionFor } from '@/data/placeholders';

export const EXERCISE_FIELDS =
  'id, name, weight_type, is_unilateral, mechanic, level, equipment, primary_muscle, secondary_muscles, set_type, has_incline, description, gif_url_sm, gif_url, image_url, owner_id, archived_at';

/**
 * EXERCISE_FIELDS without `description`, for joins that ride along with
 * routine and workout lists so a start needs no read of its own. The
 * descriptions of every system routine's exercises come to about 345 KB;
 * the workout screen reads them once it has signal.
 */
export const START_EXERCISE_FIELDS =
  'id, name, weight_type, is_unilateral, mechanic, level, equipment, primary_muscle, secondary_muscles, set_type, has_incline, gif_url_sm, gif_url, image_url, owner_id, archived_at';

/** One exercise by id, for an info sheet opened with only the id in hand. */
export async function getExercise(id: string): Promise<ExerciseInfo | null> {
  const { data } = await supabase.from('exercises').select(EXERCISE_FIELDS).eq('id', id).maybeSingle();
  return (data as ExerciseInfo | null) ?? null;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * How many recent workouts to consider before giving up. A workout where the
 * exercise was added but never logged is skipped, so more than one may be
 * needed to find real history.
 */
const LOOKBACK_WORKOUTS = 10;

/**
 * The user's last finished session of an exercise. Ported from the web
 * query in apps/web/src/lib/prior-session.ts; the normalization itself lives
 * in @liftcamp/shared so both platforms renumber identically.
 *
 * Only completed sets of finished workouts count as history, and never the
 * workout in progress, so an abandoned session or this one's own ticked sets
 * cannot stand in for the last session.
 *
 * `history` is every session the same request returned, for Pro
 * progression. Kept for every user: it costs no request, and only the
 * progression worked out from it is gated.
 */
export async function getPriorSets(
  userId: string,
  exerciseId: string,
  unit: WeightUnit,
  excludeWorkoutId: string,
): Promise<{ prior: SeedSource[]; history: HistorySession[] }> {
  const { data, error } = await supabase
    .from('workouts')
    .select(
      'id, workout_date, created_at, workout_exercises!inner(id, created_at, exercise_id, sets(position, weight, weight_value, weight_unit, reps, duration_seconds, distance_meters, incline_percent, completed, set_type))',
    )
    .eq('user_id', userId)
    .eq('workout_exercises.exercise_id', exerciseId)
    .not('finished_at', 'is', null)
    .neq('id', excludeWorkoutId)
    .order('workout_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(LOOKBACK_WORKOUTS);

  if (error || !data) return { prior: [], history: [] };

  const workouts = data.map((w) => (w.workout_exercises ?? []) as unknown as PriorExerciseRow[]);
  // Converted after normalizing, which has already resolved any legacy text
  // weight to a number, so `stored` is exact for those too.
  const prior = firstCompletedPriorSession(workouts).map((p) => ({
    ...toUserUnit(p, unit),
    stored: storedWeightOf(p.weight_value, p.weight_unit, unit),
  }));
  // Every session, unconverted: progression converts each set from its own
  // unit itself, and skips a session with nothing logged.
  const history: HistorySession[] = data.map((w, i) => ({
    workoutId: w.id,
    date: w.workout_date,
    sets: normalizePriorSets(workouts[i]).map((p) => ({
      weight_value: p.weight_value,
      weight_unit: p.weight_unit ?? null,
      reps: p.reps,
      set_type: asSetType(p.set_type),
    })),
    // Every row, ticked or not, in the rows that were used: more rows than
    // ticked sets means the session was cut short. An exercise added and
    // abandoned (no ticks) does not count. Nor does a generated warm-up
    // row: skipping a warm-up does not cut the session short.
    plannedSets: workouts[i]
      .filter((we) => (we.sets ?? []).some((s) => s.completed))
      .reduce((n, we) => n + (we.sets ?? []).filter((s) => s.set_type !== 'warmup').length, 0),
  }));
  return { prior, history };
}

/**
 * The user's most recently logged distinct exercises, newest first. Same
 * query as the web picker's defaults: the last 200 workout_exercises rows,
 * deduplicated in order, capped at `limit`.
 */
export async function getRecentExercises(userId: string, limit = 8): Promise<ExerciseInfo[]> {
  const { data: recent } = await supabase
    .from('workout_exercises')
    .select('exercise_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);

  const ids: string[] = [];
  for (const r of recent ?? []) {
    if (!ids.includes(r.exercise_id)) ids.push(r.exercise_id);
    if (ids.length === limit) break;
  }
  if (ids.length === 0) return [];

  // A custom exercise the user deleted stays in history but leaves Recent.
  const { data } = await supabase.from('exercises').select(EXERCISE_FIELDS).in('id', ids).is('archived_at', null);
  const byId = new Map(((data ?? []) as ExerciseInfo[]).map((e) => [e.id, e]));
  return ids.map((id) => byId.get(id)).filter((e): e is ExerciseInfo => e != null);
}

/**
 * Set targets for a workout started from a routine, keyed by exercise id.
 * Read through `workouts.template_id`, so a renamed workout or two routines
 * with the same name cannot confuse it. Empty for workouts with no routine.
 */
export async function getTemplateTargets(templateId: string | null): Promise<Map<string, SetTarget>> {
  if (!templateId) return new Map();
  const { data } = await supabase
    .from('template_exercises')
    .select('exercise_id, target_sets, target_reps')
    .eq('template_id', templateId);
  const out = new Map<string, SetTarget>();
  for (const row of data ?? []) {
    const target = cleanTarget({ sets: row.target_sets, reps: row.target_reps });
    if (target) out.set(row.exercise_id, target);
  }
  return out;
}

/** A workout's routine targets by exercise id, read through its `template_id`. */
export async function getWorkoutTargets(userId: string, workoutId: string): Promise<Map<string, SetTarget>> {
  const { data } = await supabase
    .from('workouts')
    .select('template_id')
    .eq('id', workoutId)
    .eq('user_id', userId)
    .maybeSingle();
  return getTemplateTargets(data?.template_id ?? null);
}

/** Trims the reps and drops a target with nothing in it. */
function cleanTarget(target: SetTarget | null | undefined): SetTarget | null {
  if (!target) return null;
  const sets = target.sets != null && target.sets > 0 ? target.sets : null;
  const reps = target.reps?.trim() || null;
  return sets == null && reps == null ? null : { sets, reps };
}

/** The user's bodyweight, needed to score bodyweight exercises. */
/**
 * The user's bodyweight in their unit, or null when none is set. Cached
 * for the session beside the PR scan (see scan-cache.ts), so the screens
 * that score bodyweight exercises read it once. A failed read returns
 * null and is not cached.
 */
export async function getBodyweight(userId: string): Promise<number | null> {
  const entry = await bodyweightCache.load(userId, () => readBodyweight(userId));
  return entry?.value ?? null;
}

async function readBodyweight(userId: string): Promise<{ value: number | null } | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('bodyweight')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return { value: data?.bodyweight ?? null };
}

export type PriorHistory = {
  /**
   * Best estimated 1RM across every completed set of this exercise before
   * now. A set in the current workout beating this is a PR.
   */
  priorBestOrm: number | null;
  /**
   * Finished workouts with at least one completed set of the exercise, the
   * same thing the exercise screen counts as a session.
   */
  finishedSessions: number;
};

/** One read of the exercise's earlier rows, for the PR baseline and the session count. */
export async function getPriorHistory(
  userId: string,
  exerciseId: string,
  excludeWorkoutId: string,
  exercise: { weight_type?: string | null } | null,
  bodyweight: number | null,
  unit: WeightUnit,
): Promise<PriorHistory> {
  const { data, error } = await supabase
    .from('workout_exercises')
    .select('workout_id, workouts(finished_at), sets(weight, weight_value, weight_unit, reps, completed)')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .neq('workout_id', excludeWorkoutId)
    .limit(500);

  if (error || !data) return { priorBestOrm: null, finishedSessions: 0 };

  let best: number | null = null;
  const finished = new Set<string>();
  for (const we of data) {
    const workout = we.workouts as unknown as { finished_at: string | null } | null;
    for (const s of we.sets ?? []) {
      if (!s.completed) continue;
      if (workout?.finished_at) finished.add(we.workout_id);
      const load = effectiveLoad(toUserUnit(s, unit), exercise, bodyweight);
      const orm = oneRepMaxNumeric(load, s.reps);
      if (orm != null && (best == null || orm > best)) best = orm;
    }
  }
  return { priorBestOrm: best, finishedSessions: finished.size };
}

/**
 * Loads the whole workout tree the screen renders: the server's rows with
 * the writes still queued on the phone applied over them, so a reload
 * before the sync shows every set as the user left it.
 */
export async function loadWorkout(
  userId: string,
  workoutId: string,
  unit: WeightUnit,
): Promise<ActiveWorkout | null> {
  const [{ data: server, error }, pending] = await Promise.all([
    supabase
      .from('workouts')
      .select(
        `id, name, created_at, finished_at, template_id, notes,
         workout_exercises(id, position, exercise_id,
           exercises(${EXERCISE_FIELDS}),
           sets(id, position, weight_value, weight_unit, reps, duration_seconds, distance_meters, incline_percent, completed, note, set_type))`,
      )
      .eq('id', workoutId)
      .eq('user_id', userId)
      .maybeSingle(),
    pendingWrites(userId),
  ]);

  if (error) return null;
  const data = applyPendingOps(workoutId, server as unknown as OverlayWorkout | null, pending) as
    | (typeof server & object)
    | null;
  if (!data) return null;

  const [bodyweight, targets] = await Promise.all([
    getBodyweight(userId),
    getTemplateTargets(data.template_id),
  ]);

  const wes = (data.workout_exercises ?? []) as unknown as {
    id: string;
    position: number;
    exercise_id: string;
    exercises: ExerciseInfo | null;
    sets: (WorkoutSet & { weight_unit: string })[] | null;
  }[];

  // Every exercise's history lookup is independent, so they all go at once.
  // Mapping over the sorted list keeps the card order without a sort after.
  const ordered = [...wes]
    .sort((a, b) => a.position - b.position)
    .filter((we) => we.exercises != null);

  const exercises: WorkoutExercise[] = await Promise.all(
    ordered.map(async (we) => {
      const [{ prior, history: sessions }, history] = await Promise.all([
        getPriorSets(userId, we.exercise_id, unit, workoutId),
        getPriorHistory(userId, we.exercise_id, workoutId, we.exercises, bodyweight, unit),
      ]);
      return {
        id: we.id,
        position: we.position,
        exercise: we.exercises!,
        // Converted, then the stored unit dropped: in memory every set is
        // in the current unit, and a later write says so itself.
        sets: (we.sets ?? [])
          .map((row): WorkoutSet => {
            const s = toUserUnit(row, unit);
            return {
              id: s.id,
              position: s.position,
              weight_value: s.weight_value,
              reps: s.reps,
              duration_seconds: s.duration_seconds ?? null,
              distance_meters: s.distance_meters ?? null,
              incline_percent: s.incline_percent ?? null,
              completed: s.completed,
              note: s.note,
              stored: storedWeightOf(row.weight_value, row.weight_unit, unit),
              set_type: s.set_type ?? null,
            };
          })
          .sort((a, b) => a.position - b.position),
        prior,
        history: sessions,
        priorBestOrm: history.priorBestOrm,
        finishedSessions: history.finishedSessions,
        target: targets.get(we.exercise_id) ?? null,
      };
    }),
  );

  return {
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
    finishedAt: data.finished_at,
    notes: data.notes,
    templateId: data.template_id,
    exercises,
    bodyweight,
  };
}

/**
 * PostgREST caps a single response (Supabase's `max-rows`), so the full library
 * is fetched in pages. 500 keeps each request well under any common cap.
 */
const EXERCISE_PAGE = 500;

/**
 * The unfiltered library, cached for the session. It is 898 rows that cannot
 * change while the app is running, and the picker re-runs its query every time
 * it opens.
 */
let allExercisesCache: ExerciseInfo[] | null = null;
/**
 * The unfiltered fetch while it is in flight, so the library's list and its
 * Equipment chips, which both ask for it on open, share one request.
 */
let allExercisesPending: Promise<ExerciseInfo[] | null> | null = null;

/**
 * Exercise search for the picker.
 *
 * Returns every match, not a page of them. The previous version fetched 120
 * rows with no ORDER BY and sliced to 40, which capped an empty search at 40 of
 * 898 and returned whatever arbitrary 120 rows Postgres happened to hand back
 * rather than the start of the alphabet.
 *
 * Ordering by name in the database is what makes paging safe. Without a stable
 * ORDER BY, two `.range()` calls can return overlapping or missing rows.
 *
 * One alphabetical list. It used to be compounds first, then isolation, then
 * unclassified, each A to Z, which read as the list starting over at A.
 */
/** The whole library if an empty search has already loaded it, else undefined. */
export function peekAllExercises(): ExerciseInfo[] | undefined {
  return allExercisesCache ?? undefined;
}

/**
 * Drops the session's copy of the library. Called after a custom exercise
 * is created, edited, deleted or restored, so the next search reads the
 * change; nothing else changes the library during a session.
 */
export function invalidateExerciseCache(): void {
  allExercisesCache = null;
  allExercisesPending = null;
}

export async function searchExercises(term: string): Promise<ExerciseInfo[]> {
  const tokens = term
    .split(/\s+/)
    .map((raw) => normalizeSearch(raw))
    .filter(Boolean);

  if (tokens.length > 0) return (await fetchExercises(tokens)) ?? [];
  if (allExercisesCache) return allExercisesCache;
  if (!allExercisesPending) {
    allExercisesPending = fetchExercises([])
      .then((rows) => {
        if (rows) allExercisesCache = rows;
        return rows;
      })
      .finally(() => {
        allExercisesPending = null;
      });
  }
  return (await allExercisesPending) ?? [];
}

/** Every match for the tokens, A to Z. Null on a failed read, which is never cached. */
async function fetchExercises(tokens: string[]): Promise<ExerciseInfo[] | null> {
  const rows: ExerciseInfo[] = [];
  for (let from = 0; ; from += EXERCISE_PAGE) {
    // RLS adds the user's own custom exercises to the catalog; a deleted
    // one (archived_at set) stays readable for history but leaves the list.
    let q = supabase
      .from('exercises')
      .select(EXERCISE_FIELDS)
      .is('archived_at', null)
      .order('name', { ascending: true });

    // Every whitespace-separated token must appear somewhere in search_all
    // (normalized name plus curated aliases). Repeated .ilike calls are ANDed
    // by PostgREST, so "smith hip thrust" matches Smith Machine Hip Thrust even
    // though the words are not adjacent in the stored name.
    //
    // Tokens are normalized one at a time with the same transform that
    // generates search_all, which is why a partial word works: "incline dumb"
    // becomes %incline% AND %dumb%, and both are substrings of
    // "inclinedumbbellpress". Passing the raw string instead would search for
    // "incline dumb" with its space intact, and search_all has no spaces.
    for (const token of tokens) q = q.ilike('search_all', `%${token}%`);

    const { data, error } = await q.range(from, from + EXERCISE_PAGE - 1);
    if (error) return null;
    if (!data || data.length === 0) break;
    rows.push(...(data as ExerciseInfo[]));
    if (data.length < EXERCISE_PAGE) break;
  }

  // Sorted again here so the order is the device's, not the database
  // collation's, which can disagree on case and punctuation.
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------
//
// Every write below is queued on the phone (see write-queue.ts) and resolves
// once it is saved there, not once the server has it. Each op names the
// rows it hangs off (`parents`: the workout, then the exercise row), so
// deleting an exercise or discarding a workout also drops its queued writes
// that never left the phone.

/** Where a set sits, for the queue's parents. */
export type SetRef = { workoutId: string; workoutExerciseId: string; setId: string };

/** What a routine asks for. `sets` drives the seeded count; `reps` is guidance. */
export type SetTarget = { sets: number | null; reps: string | null };

/** A new row's `created_at`. Sent, so a write synced later keeps the time it was made. */
function nowIso(): string {
  return new Date().toISOString();
}

/**
 * expo-application's native module, for the Android versionCode, which
 * expo-constants no longer reports there (its `platform.android` is empty).
 * Linked through expo-notifications since 29 Sep 2026, so it is read
 * without importing expo-application, whose import throws in a binary
 * built before then. Null in such a binary, and the row gets the version
 * alone.
 */
const ExpoApplication = requireOptionalNativeModule<{ nativeBuildVersion?: string | null }>('ExpoApplication');

/**
 * The app that created a workout, stored on its row as `platform` and
 * `app_version` ("1.0.0 (10)"). The version comes from the running config,
 * so an update reports its own; the build is the binary's (CFBundleVersion
 * on iOS, versionCode on Android). Either part can be missing in a dev
 * build, and the row then carries what there is. Older builds send neither
 * column, and the web never does: both are nullable.
 */
const WORKOUT_SOURCE = {
  platform: Platform.OS,
  app_version: appVersion(),
};

export function appVersion(): string | null {
  const version = Constants.expoConfig?.version ?? null;
  const build =
    Platform.OS === 'ios'
      ? Constants.platform?.ios?.buildNumber
      : Platform.OS === 'android'
        ? ExpoApplication?.nativeBuildVersion
        : null;
  if (!version) return build ? `(${build})` : null;
  return build ? `${version} (${build})` : version;
}

function workoutExerciseRow(
  userId: string,
  workoutId: string,
  id: string,
  exercise: ExerciseInfo,
  position: number,
  createdAt: string,
): InsertRow {
  return {
    id,
    parents: [workoutId],
    values: { id, workout_id: workoutId, exercise_id: exercise.id, user_id: userId, position, created_at: createdAt },
    // Not sent. A reload before the sync draws the card from it.
    meta: { exercises: exercise },
  };
}

function setRow(
  userId: string,
  workoutId: string,
  workoutExerciseId: string,
  set: WorkoutSet,
  unit: WeightUnit,
  createdAt: string,
): InsertRow {
  return {
    id: set.id,
    parents: [workoutId, workoutExerciseId],
    values: {
      id: set.id,
      workout_exercise_id: workoutExerciseId,
      user_id: userId,
      position: set.position,
      ...weightToWrite(set.weight_value, set.stored, unit),
      reps: set.reps,
      duration_seconds: set.duration_seconds ?? null,
      distance_meters: set.distance_meters ?? null,
      incline_percent: set.incline_percent ?? null,
      // Only when set, so an ordinary insert names no column it does not need.
      ...(set.set_type ? { set_type: set.set_type } : {}),
      completed: set.completed,
      note: set.note,
      created_at: createdAt,
    },
  };
}

/** A cardio exercise new to the user starts with one set: one run, one ride. */
const CARDIO_COLD_SETS = 1;

/**
 * An exercise's empty starting sets: the routine's target_sets when there
 * is one, else `count` (the prior session's, or the repeated workout's),
 * else the cold-start suggestion, which for cardio is one set. The last
 * session, the routine's target reps and the cold-start reps all show as
 * gray placeholders (see setPlaceholder in @liftcamp/shared), and the
 * check logs a placeholder when its box is still empty.
 */
function seedSets(exercise: ExerciseInfo, target: SetTarget | null | undefined, count: number | null): WorkoutSet[] {
  const coldSets = isCardio(exercise) ? CARDIO_COLD_SETS : coldStartSuggestion(exercise).sets;
  const n = startSetCount(target?.sets, count, coldSets);
  return Array.from({ length: n }, (_, idx) => ({
    id: randomUUID(),
    position: idx,
    weight_value: null,
    reps: null,
    duration_seconds: null,
    distance_meters: null,
    incline_percent: null,
    completed: false,
    note: null,
    stored: null,
  }));
}

type Seeded = {
  id: string;
  sets: WorkoutSet[];
  prior: SeedSource[];
  history: HistorySession[];
  target: SetTarget | null;
};

/** Reads the prior session and plans an exercise's rows. Writes nothing. */
async function planExercise(
  userId: string,
  workoutId: string,
  exercise: ExerciseInfo,
  unit: WeightUnit,
  target?: SetTarget | null,
): Promise<Seeded> {
  const { prior, history } = await getPriorSets(userId, exercise.id, unit, workoutId);
  return {
    id: randomUUID(),
    sets: seedSets(exercise, target, prior.length),
    prior,
    history,
    target: cleanTarget(target),
  };
}

/** Queues exercise rows and their sets: one op for the exercises, one for every set. */
async function queueExercises(
  userId: string,
  workoutId: string,
  planned: { exercise: ExerciseInfo; position: number; seeded: Seeded }[],
  unit: WeightUnit,
): Promise<boolean> {
  if (planned.length === 0) return true;
  const createdAt = nowIso();
  const saved =
    (await enqueueWrite(userId, {
      kind: 'insert',
      table: 'workout_exercises',
      rows: planned.map((p) => workoutExerciseRow(userId, workoutId, p.seeded.id, p.exercise, p.position, createdAt)),
    })) &&
    (await enqueueWrite(userId, {
      kind: 'insert',
      table: 'sets',
      rows: planned.flatMap((p) =>
        p.seeded.sets.map((s) => setRow(userId, workoutId, p.seeded.id, s, unit, createdAt)),
      ),
    }));
  invalidateScanCache();
  return saved;
}

/**
 * An exercise a workout starts with: its routine target if it has one, and
 * for a repeat, how many sets the repeated workout had. The exercise's
 * fields may leave out `description`; the workout screen reads it later.
 */
export type StartExercise = { exercise: ExerciseInfo; target?: SetTarget | null; setCount?: number | null };

/**
 * Starts a workout, optionally named, from a routine, and with exercises in
 * the given order. Returns its id at once, or null when it could not be
 * saved on the phone.
 *
 * Nothing waits for the server. The rows go into the write queue (the
 * workout, its exercises, their sets: three ops), a copy goes into device
 * storage, and the workout screen opens from that copy. The prior session,
 * the PR baseline and the full exercise fields arrive when the screen's
 * server read lands, with signal; until then the cards have no PREVIOUS
 * column. Set counts come from the routine's targets or the repeated
 * workout, so they do not wait on the prior-session read either.
 */
export async function startWorkout(
  userId: string,
  unit: WeightUnit,
  options: { name?: string | null; templateId?: string | null; exercises?: StartExercise[] } = {},
): Promise<string | null> {
  const workoutId = randomUUID();
  const createdAt = nowIso();
  const name = options.name?.trim() || null;
  const planned = (options.exercises ?? []).map(({ exercise, target, setCount }, position) => ({
    exercise,
    position,
    seeded: {
      id: randomUUID(),
      sets: seedSets(exercise, target, setCount ?? null),
      prior: [] as SeedSource[],
      history: [] as HistorySession[],
      target: cleanTarget(target),
    },
  }));

  const saved =
    (await enqueueWrite(userId, {
      kind: 'insert',
      table: 'workouts',
      rows: [
        {
          id: workoutId,
          parents: [],
          values: {
            id: workoutId,
            user_id: userId,
            name,
            workout_date: todayIso(),
            // Only a workout started from a routine carries this. Empty and
            // generated workouts leave it null, and loadWorkout reads targets from it.
            template_id: options.templateId ?? null,
            created_at: createdAt,
            ...WORKOUT_SOURCE,
          },
        },
      ],
    })) && (await queueExercises(userId, workoutId, planned, unit));
  invalidateScanCache();
  if (!saved) {
    await discardWorkout(userId, workoutId);
    return null;
  }

  await saveDeviceWorkout(userId, unit, {
    id: workoutId,
    name,
    createdAt,
    finishedAt: null,
    notes: null,
    templateId: options.templateId ?? null,
    exercises: planned.map(({ exercise, position, seeded }) => ({
      id: seeded.id,
      position,
      exercise,
      sets: seeded.sets,
      prior: seeded.prior,
      history: seeded.history,
      priorBestOrm: null,
      finishedSessions: 0,
      target: seeded.target,
    })),
    bodyweight: null,
  });
  return workoutId;
}

/** Starts an empty ad-hoc workout and returns its id. */
export function startAdHocWorkout(userId: string, unit: WeightUnit): Promise<string | null> {
  return startWorkout(userId, unit);
}

/** The phone's workout with the server read's details filled in; see @liftcamp/shared. */
export function withServerDetails(local: ActiveWorkout, server: ActiveWorkout): ActiveWorkout {
  const merged = mergeServerDetails(local, server);
  // A copy saved before these existed has none to keep.
  return {
    ...merged,
    notes: local.notes === undefined ? server.notes : local.notes,
    templateId: local.templateId === undefined ? server.templateId : local.templateId,
  };
}

/**
 * Adds an exercise to a workout in progress, seeded from the prior session,
 * with the PR baseline the card needs. The baseline lookup is independent of
 * seeding, so the two run together. Null when it could not be saved.
 */
export async function addExercise(
  userId: string,
  workoutId: string,
  exercise: ExerciseInfo,
  position: number,
  bodyweight: number | null,
  unit: WeightUnit,
): Promise<WorkoutExercise | null> {
  const [seeded, history] = await Promise.all([
    planExercise(userId, workoutId, exercise, unit),
    getPriorHistory(userId, exercise.id, workoutId, exercise, bodyweight, unit),
  ]);
  if (!(await queueExercises(userId, workoutId, [{ exercise, position, seeded }], unit))) return null;
  return {
    id: seeded.id,
    position,
    exercise,
    sets: seeded.sets,
    prior: seeded.prior,
    history: seeded.history,
    priorBestOrm: history.priorBestOrm,
    finishedSessions: history.finishedSessions,
    target: seeded.target,
  };
}

/**
 * Appends a set. Past the end of the prior session a new set copies the
 * previous set in this workout, which is what the spec's prefill rule asks
 * for. A cardio set copies its time and distance the same way.
 */
export async function addSet(
  userId: string,
  workoutId: string,
  workoutExerciseId: string,
  position: number,
  seed: {
    weight_value: number | null;
    reps: number | null;
    stored: StoredWeight | null;
    duration_seconds?: number | null;
    distance_meters?: number | null;
    incline_percent?: number | null;
  },
  unit: WeightUnit,
): Promise<WorkoutSet> {
  const row: WorkoutSet = {
    id: randomUUID(),
    position,
    weight_value: seed.weight_value,
    reps: seed.reps,
    duration_seconds: seed.duration_seconds ?? null,
    distance_meters: seed.distance_meters ?? null,
    incline_percent: seed.incline_percent ?? null,
    completed: false,
    note: null,
    stored: seed.stored,
  };
  await enqueueWrite(userId, {
    kind: 'insert',
    table: 'sets',
    rows: [setRow(userId, workoutId, workoutExerciseId, row, unit, nowIso())],
  });
  invalidateScanCache();
  return row;
}

/**
 * A patch that sets `weight_value` writes it through `weightToWrite`: an
 * edit (with `stored` null) is the typed value in the current unit, and a
 * placeholder logged unedited (with its source's `stored`) keeps the value
 * and unit it was logged as. One that only touches reps, a cardio time or
 * distance, completion, the note or position leaves the stored weight and
 * unit as they were, so ticking a set logged in lb does not relabel its
 * weight as kg. A distance is meters whatever the unit, so it needs none.
 *
 * Worked out now, so a unit switch before the sync cannot change it. Typing
 * queues one update per keystroke; the queue merges them into one.
 */
export async function updateSet(
  userId: string,
  ref: SetRef,
  patch: Partial<WorkoutSet>,
  unit: WeightUnit,
  /**
   * Pro only: the suggestion shown for the set, sent with its tick so
   * `suggestion_matched` can be worked out. Null on every free write.
   */
  suggestion: SuggestionWrite | null = null,
): Promise<void> {
  const row = {
    ...(suggestion ?? {}),
    ...(patch.weight_value !== undefined ? weightToWrite(patch.weight_value, patch.stored ?? null, unit) : {}),
    ...(patch.reps !== undefined ? { reps: patch.reps } : {}),
    ...(patch.duration_seconds !== undefined ? { duration_seconds: patch.duration_seconds } : {}),
    ...(patch.distance_meters !== undefined ? { distance_meters: patch.distance_meters } : {}),
    ...(patch.incline_percent !== undefined ? { incline_percent: patch.incline_percent } : {}),
    ...(patch.completed !== undefined ? { completed: patch.completed } : {}),
    ...(patch.note !== undefined ? { note: patch.note } : {}),
    ...(patch.position !== undefined ? { position: patch.position } : {}),
  };
  if (Object.keys(row).length === 0) return;
  await enqueueWrite(userId, {
    kind: 'update',
    table: 'sets',
    id: ref.setId,
    parents: [ref.workoutId, ref.workoutExerciseId],
    patch: row,
  });
  invalidateScanCache();
}

/**
 * Pro: puts `count` empty warm-up rows (`set_type` warmup) at the top of a
 * card, for the generated warm-ups. The rows already there move down by
 * `count` first, last row first, so no two rows ever share a position.
 * Returns the new rows; the caller moves its own rows down by `count`.
 */
export async function addWarmupRows(
  userId: string,
  workoutId: string,
  we: WorkoutExercise,
  count: number,
  unit: WeightUnit,
): Promise<WorkoutSet[]> {
  const existing = [...we.sets].sort((a, b) => a.position - b.position);
  const shift = Math.max(count, 0);
  for (const s of [...existing].reverse()) {
    await updateSet(userId, { workoutId, workoutExerciseId: we.id, setId: s.id }, { position: s.position + shift }, unit);
  }
  const warmups: WorkoutSet[] = Array.from({ length: shift }, (_, i) => ({
    id: randomUUID(),
    position: (existing[0]?.position ?? 0) + i,
    weight_value: null,
    reps: null,
    duration_seconds: null,
    distance_meters: null,
    incline_percent: null,
    completed: false,
    note: null,
    stored: null,
    set_type: 'warmup',
  }));
  if (warmups.length > 0) {
    await enqueueWrite(userId, {
      kind: 'insert',
      table: 'sets',
      rows: warmups.map((s) => setRow(userId, workoutId, we.id, s, unit, nowIso())),
    });
    invalidateScanCache();
  }
  return warmups;
}

export async function deleteSet(userId: string, ref: SetRef): Promise<void> {
  await enqueueWrite(userId, {
    kind: 'delete',
    table: 'sets',
    id: ref.setId,
    parents: [ref.workoutId, ref.workoutExerciseId],
  });
  invalidateScanCache();
}

/**
 * Puts a deleted set back, id and all. The undo toast calls this. Queued
 * after the delete, so the two can never land the other way round.
 */
export async function restoreSet(
  userId: string,
  workoutId: string,
  workoutExerciseId: string,
  set: WorkoutSet,
  unit: WeightUnit,
): Promise<void> {
  await enqueueWrite(userId, {
    kind: 'insert',
    table: 'sets',
    rows: [setRow(userId, workoutId, workoutExerciseId, set, unit, nowIso())],
  });
  invalidateScanCache();
}

export async function removeExercise(userId: string, workoutId: string, workoutExerciseId: string): Promise<void> {
  // sets cascade on workout_exercise_id.
  await enqueueWrite(userId, {
    kind: 'delete',
    table: 'workout_exercises',
    id: workoutExerciseId,
    parents: [workoutId],
  });
  invalidateScanCache();
}

/**
 * Writes the new order of a workout's exercises: every row's position,
 * changed or not, so the order that lands is this one whole, never mixed
 * with another device's. One update per row; the queue merges a later
 * reorder into these while they wait.
 */
export async function reorderExercises(
  userId: string,
  workoutId: string,
  ordered: { id: string }[],
): Promise<void> {
  for (const [position, we] of ordered.entries()) {
    await enqueueWrite(userId, {
      kind: 'update',
      table: 'workout_exercises',
      id: we.id,
      parents: [workoutId],
      patch: { position },
    });
  }
  invalidateScanCache();
}

/** Swaps which exercise a card points at, keeping its position. */
export async function replaceExercise(
  userId: string,
  workoutId: string,
  workoutExerciseId: string,
  exercise: ExerciseInfo,
): Promise<void> {
  await enqueueWrite(userId, {
    kind: 'update',
    table: 'workout_exercises',
    id: workoutExerciseId,
    parents: [workoutId],
    patch: { exercise_id: exercise.id },
    meta: { exercises: exercise },
  });
  invalidateScanCache();
}

/**
 * Finishes the workout: only while it is unfinished, so on two devices the
 * first finish wins. `finished_at` is the moment of the tap, however late it
 * syncs. The phone's copy is kept, marked finished, until the server has
 * the finish. Resolves true once the server has every write for the
 * workout, false when they are still on the phone (no signal) after a
 * short wait.
 */
export async function finishWorkout(userId: string, workout: ActiveWorkout, unit: WeightUnit): Promise<boolean> {
  const finishedAt = nowIso();
  await enqueueWrite(userId, {
    kind: 'update',
    table: 'workouts',
    id: workout.id,
    parents: [],
    patch: { finished_at: finishedAt },
    onlyIfNull: 'finished_at',
  });
  invalidateScanCache();
  await Promise.all([
    clearRunningRest(workout.id),
    cancelRestAlert(workout.id),
    // Finished one: the first-workout nudges have done their job.
    cancelFirstNudges(),
    endWorkoutActivity(workout.id),
    saveDeviceWorkout(userId, unit, { ...workout, finishedAt }),
    rememberRoutineNote(userId, { ...workout, finishedAt, notes: notesToSave(workout.notes ?? '') }),
  ]);
  return syncedWithin(workout.id);
}

/**
 * Saves the workout's note through the queue: trimmed, null when empty, cut
 * to WORKOUT_NOTES_MAX. Typing queues one update per keystroke; the queue
 * merges them into one, or into the workout's insert if that has not been
 * sent. Never merged into the finish, which stays first-wins.
 */
export async function setWorkoutNotes(userId: string, workoutId: string, text: string): Promise<void> {
  await enqueueWrite(userId, {
    kind: 'update',
    table: 'workouts',
    id: workoutId,
    parents: [],
    patch: { notes: notesToSave(text) },
  });
  invalidateScanCache();
  await rememberRoutineNote(userId, { id: workoutId, notes: notesToSave(text) });
}

/**
 * Cancel discards the whole workout. Sets and exercises cascade. Writes
 * for it that never left the phone are dropped rather than sent. False
 * when the phone could not save the delete.
 */
export async function discardWorkout(userId: string, workoutId: string): Promise<boolean> {
  const saved = await enqueueWrite(userId, { kind: 'delete', table: 'workouts', id: workoutId, parents: [] });
  invalidateScanCache();
  await Promise.all([
    clearRunningRest(workoutId),
    cancelRestAlert(workoutId),
    endWorkoutActivity(workoutId),
    clearDeviceWorkout(workoutId),
  ]);
  return saved;
}

/**
 * Deletes a finished workout, from a History row or the workout's detail.
 * The same queued op as a discard: one delete of the `workouts` row by id.
 * The database cascades its exercises, sets and kudos and nulls its
 * reports; streak medals are their own rows and stay. Until the delete
 * syncs, every read of finished workouts leaves it out
 * (`deletedWorkoutIds`), so it is gone everywhere at once, offline too.
 * False when the phone could not save the delete.
 */
export function deleteWorkout(userId: string, workoutId: string): Promise<boolean> {
  return discardWorkout(userId, workoutId);
}

/**
 * The user's saved rest per exercise, in seconds, from the rest sheet's
 * "Use for this exercise next time". An exercise with no entry rests for
 * the default. A failed read, including the table not existing yet, is an
 * empty map, so the timer still runs on the default.
 */
export async function getRestPrefs(userId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('exercise_rest_prefs')
    .select('exercise_id, rest_seconds')
    .eq('user_id', userId);
  if (error || !data) return new Map();
  return new Map(data.map((r) => [r.exercise_id, r.rest_seconds]));
}

/** Saves an exercise's rest, or with null forgets it. Returns whether it stuck. */
export async function setRestPref(
  userId: string,
  exerciseId: string,
  seconds: number | null,
): Promise<boolean> {
  const { error } =
    seconds == null
      ? await supabase
          .from('exercise_rest_prefs')
          .delete()
          .eq('user_id', userId)
          .eq('exercise_id', exerciseId)
      : await supabase.from('exercise_rest_prefs').upsert({
          user_id: userId,
          exercise_id: exerciseId,
          rest_seconds: seconds,
          updated_at: new Date().toISOString(),
        });
  return !error;
}

/**
 * The ids of this exercise's completed sets that are PRs, resolved in one
 * pass so a set has to beat the prior best and every earlier completed set
 * in this workout. Without the running best, every set of a first-ever
 * session would show a ribbon. The exercise card draws the ribbons from
 * this, and the workout screen's PR haptic asks the same question, so the
 * two cannot disagree.
 */
export function workoutPrSetIds(we: WorkoutExercise, bodyweight: number | null): Set<string> {
  const prIds = new Set<string>();
  let best = we.priorBestOrm;
  for (const s of we.sets) {
    if (!s.completed) continue;
    const load = effectiveLoad({ weight: null, weight_value: s.weight_value }, we.exercise, bodyweight);
    const orm = oneRepMaxNumeric(load, s.reps);
    if (orm == null) continue;
    if (best == null || orm > best) {
      prIds.add(s.id);
      best = orm;
    }
  }
  return prIds;
}
