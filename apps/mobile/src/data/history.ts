import { computePrSetIds, pendingWorkoutNotes, setVolume, toUserUnit, type WeightUnit } from '@liftcamp/shared';

import { scanCache } from '@/data/scan-cache';
import { EXERCISE_FIELDS, getBodyweight, type ExerciseInfo } from '@/data/workouts';
import { pendingWrites } from '@/data/write-queue';
import { supabase } from '../../lib/supabase';

/**
 * Reads for History. Same rules as workouts.ts and home.ts: screens
 * never import `supabase`. This module only reads, and every set it reads
 * passes through `toUserUnit` before any volume or PR math.
 */

export const HISTORY_PAGE = 20;

/**
 * The PR pass pages `workout_exercises` at this size, for the same reason
 * `EXERCISE_PAGE` in workouts.ts does: PostgREST caps response rows.
 */
export const PR_SCAN_PAGE = 500;

/**
 * The PR pass gives up past this many pages and reports no counts at all.
 * A truncated scan is worse than none: without the earliest sets, later
 * sets look like first-time records, so the screen would show PRs that are
 * wrong rather than PRs that are missing. Lower it to 1 to exercise the
 * no-ribbon path on a real account.
 */
export const PR_SCAN_MAX_PAGES = 10;

export type HistoryWorkout = {
  id: string;
  name: string | null;
  workoutDate: string;
  createdAt: string;
  finishedAt: string;
  exerciseCount: number;
  /** In the user's unit, via setVolume so unilateral doubling is honoured. */
  volume: number;
  /**
   * Personal records set in this workout. Null when the PR pass was
   * abandoned, in which case the screen shows no ribbons anywhere.
   */
  prCount: number | null;
};

export type HistoryPage = {
  workouts: HistoryWorkout[];
  hasMore: boolean;
};

/**
 * What every page of history needs and what is fetched once per screen
 * load: the bodyweight that scores bodyweight exercises, and the PR count
 * per workout across the whole account.
 */
export type HistoryContext = {
  /** The unit the page was loaded in; every page converts to it. */
  unit: WeightUnit;
  bodyweight: number | null;
  /** Workout id to PR count. Null when the PR pass was abandoned. */
  prCounts: Map<string, number> | null;
};

/**
 * The scan rows do not depend on bodyweight, so the two reads run
 * together; bodyweight is applied when the PRs are counted. `force`
 * rescans, for pull to refresh.
 */
export async function loadHistoryContext(
  userId: string,
  unit: WeightUnit,
  { force = false }: { force?: boolean } = {},
): Promise<HistoryContext> {
  const [bodyweight, rows] = await Promise.all([getBodyweight(userId), getScanRows(userId, unit, { force })]);
  return { unit, bodyweight, prCounts: rows ? tallyPrs(rows, bodyweight) : null };
}

export type ScanRow = {
  workout_id: string;
  exercise_id: string;
  exercises: {
    id: string;
    name: string;
    equipment: string | null;
    weight_type: string | null;
    is_unilateral: boolean | null;
  } | null;
  workouts: { workout_date: string; finished_at: string | null } | null;
  sets:
    | {
        id: string;
        weight: string | null;
        weight_value: number | null;
        weight_unit: string;
        reps: number | null;
        completed: boolean;
        created_at: string | null;
        position: number;
      }[]
    | null;
};

/**
 * Every `workout_exercises` row the user owns, with its sets, in pages.
 * Null when the scan was abandoned or a request failed.
 *
 * All or nothing: past `PR_SCAN_MAX_PAGES` this returns null rather than
 * a partial list, because the PR maths below is only right over the whole
 * account.
 *
 * The exercise's name and volume fields and the workout's date and
 * `finished_at` ride along for Profile, which derives its PRs, volume and
 * strength levels from this one scan. The PR maths ignores them.
 */
async function scanWorkoutExercises(userId: string, unit: WeightUnit): Promise<ScanRow[] | null> {
  const rows: ScanRow[] = [];
  for (let page = 0; ; page += 1) {
    if (page >= PR_SCAN_MAX_PAGES) return null;
    const from = page * PR_SCAN_PAGE;
    // Ordered by id so consecutive ranges never overlap or skip a row.
    const { data, error } = await supabase
      .from('workout_exercises')
      .select(
        `workout_id, exercise_id,
         exercises(id, name, equipment, weight_type, is_unilateral),
         workouts(workout_date, finished_at),
         sets(id, weight, weight_value, weight_unit, reps, completed, created_at, position)`,
      )
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(from, from + PR_SCAN_PAGE - 1);
    if (error) return null;
    if (!data || data.length === 0) break;
    for (const row of data as unknown as ScanRow[]) {
      rows.push({ ...row, sets: (row.sets ?? []).map((s) => toUserUnit(s, unit)) });
    }
    if (data.length < PR_SCAN_PAGE) break;
  }
  return rows;
}

/**
 * The ids of every set that was a personal record when it was logged, and
 * the workout each of those sets belongs to. Pure, over a full scan.
 *
 * Only completed sets go in. `computePrSetIds` does not filter on
 * `completed` itself (`getPriorHistory` does, which makes this easy to
 * miss), and an incomplete set with a big number typed in would invent a
 * PR that never happened.
 *
 * Every workout counts, finished or not, because that is what the active
 * screen's prior-best lookup scans. A ribbon here should match the ribbon
 * the user saw while lifting.
 *
 * Sets seeded from a routine share one `created_at`, and which of two tied
 * sets gets the record depends on which comes first. `computePrSetIds`
 * sorts by `created_at` and its sort is stable, so each group is put in
 * `position` order first: tied sets then resolve in the order the user
 * completed them, which is the order the active screen walked.
 */
export function markPrs(
  rows: ScanRow[],
  bodyweight: number | null,
): { prSetIds: Set<string>; workoutOfSet: Map<string, string> } {
  const workoutOfSet = new Map<string, string>();
  const byExercise = new Map<
    string,
    { exercise: { weight_type: string | null } | null; sets: NonNullable<ScanRow['sets']> }
  >();

  for (const row of rows) {
    let group = byExercise.get(row.exercise_id);
    if (!group) {
      group = { exercise: row.exercises, sets: [] };
      byExercise.set(row.exercise_id, group);
    }
    for (const s of row.sets ?? []) {
      if (!s.completed) continue;
      workoutOfSet.set(s.id, row.workout_id);
      group.sets.push(s);
    }
  }

  const prSetIds = new Set<string>();
  for (const { exercise, sets } of byExercise.values()) {
    sets.sort((a, b) => a.position - b.position);
    for (const setId of computePrSetIds(sets, exercise, bodyweight)) prSetIds.add(setId);
  }
  return { prSetIds, workoutOfSet };
}

/**
 * The set ids that carry a PR ribbon, across the whole account. The detail
 * screen marks its sets against this; the list tallies it per workout
 * through `tallyPrs`. One code path, so the two screens cannot disagree.
 *
 * Not `getPriorHistory` per exercise: that is one query each, so a page of
 * 20 workouts at 5 exercises would be 100 round trips. This is one request
 * per 500 `workout_exercises` rows.
 *
 * Null when the scan was abandoned, in which case no ribbons show anywhere.
 */
export async function getPrSetIds(
  userId: string,
  /** May be pending: the scan does not need it, only the marking after. */
  bodyweightIn: number | null | Promise<number | null>,
  unit: WeightUnit,
): Promise<Set<string> | null> {
  const [rows, bodyweight] = await Promise.all([getScanRows(userId, unit), bodyweightIn]);
  if (!rows) return null;
  return markPrs(rows, bodyweight).prSetIds;
}

/**
 * The scan, from the session cache when nothing has been written since it
 * ran (see scan-cache.ts). Null when the scan was abandoned or failed,
 * which is never cached.
 */
export function getScanRows(
  userId: string,
  unit: WeightUnit,
  { force = false }: { force?: boolean } = {},
): Promise<ScanRow[] | null> {
  return scanCache.load(scanKey(userId, unit), () => scanWorkoutExercises(userId, unit), { force });
}

/** The cached scan when it is fresh, else undefined. Never reads. */
export function peekScanRows(userId: string, unit: WeightUnit): ScanRow[] | undefined {
  return scanCache.peek(scanKey(userId, unit));
}

function scanKey(userId: string, unit: WeightUnit): string {
  return `${userId}|${unit}`;
}

/** Pure. Set ids tallied back to workout ids. */
export function tallyPrs(rows: ScanRow[], bodyweight: number | null): Map<string, number> {
  const { prSetIds, workoutOfSet } = markPrs(rows, bodyweight);
  const counts = new Map<string, number>();
  for (const setId of prSetIds) {
    const workoutId = workoutOfSet.get(setId);
    if (!workoutId) continue;
    counts.set(workoutId, (counts.get(workoutId) ?? 0) + 1);
  }
  return counts;
}

type WorkoutRow = {
  id: string;
  name: string | null;
  workout_date: string;
  created_at: string;
  finished_at: string | null;
  workout_exercises:
    | {
        exercises: {
          id: string;
          equipment: string | null;
          weight_type: string | null;
          is_unilateral: boolean | null;
        } | null;
        sets:
          | { weight: string | null; weight_value: number | null; weight_unit: string; reps: number | null; completed: boolean }[]
          | null;
      }[]
    | null;
};

/**
 * One page of finished workouts, newest first. `from` is the offset of the
 * first row wanted, so the screen passes the number of rows it already has.
 *
 * The same select as `getLastWorkout` in home.ts, without the limit of one.
 * Ordered by `workout_date` first so a backdated workout sits under the
 * month it was dated to, and by `finished_at` within a day.
 */
export async function getWorkoutHistory(
  userId: string,
  from: number,
  ctx: HistoryContext,
): Promise<HistoryPage> {
  // One row past the page decides `hasMore` without a second count query.
  const { data, error } = await supabase
    .from('workouts')
    .select(
      `id, name, workout_date, created_at, finished_at,
       workout_exercises(exercises(id, equipment, weight_type, is_unilateral),
         sets(weight, weight_value, weight_unit, reps, completed))`,
    )
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .order('workout_date', { ascending: false })
    .order('finished_at', { ascending: false })
    .range(from, from + HISTORY_PAGE);
  if (error || !data) return { workouts: [], hasMore: false };

  const rows = data as unknown as WorkoutRow[];
  const hasMore = rows.length > HISTORY_PAGE;
  const workouts: HistoryWorkout[] = [];
  for (const w of rows.slice(0, HISTORY_PAGE)) {
    if (!w.finished_at) continue;
    const wes = w.workout_exercises ?? [];
    let volume = 0;
    for (const we of wes) {
      for (const s of we.sets ?? []) {
        if (!s.completed) continue;
        volume += setVolume(toUserUnit(s, ctx.unit), we.exercises, ctx.bodyweight);
      }
    }
    workouts.push({
      id: w.id,
      name: w.name,
      workoutDate: w.workout_date,
      createdAt: w.created_at,
      finishedAt: w.finished_at,
      exerciseCount: wes.length,
      volume,
      prCount: ctx.prCounts ? (ctx.prCounts.get(w.id) ?? 0) : null,
    });
  }
  return { workouts, hasMore };
}

// ---------------------------------------------------------------------------
// One workout, read-only
// ---------------------------------------------------------------------------

export type DetailSet = {
  id: string;
  position: number;
  weight: string | null;
  weight_value: number | null;
  reps: number | null;
  completed: boolean;
  note: string | null;
};

export type DetailExercise = {
  /** The `workout_exercises` row id, not the exercise id. */
  id: string;
  position: number;
  exercise: ExerciseInfo;
  sets: DetailSet[];
};

export type WorkoutDetail = {
  id: string;
  name: string | null;
  workoutDate: string;
  createdAt: string;
  finishedAt: string;
  notes: string | null;
  exercises: DetailExercise[];
  /** Completed sets only, via setVolume, in the user's unit. */
  volume: number;
  completedSets: number;
  /** Exercise ids in position order, for Repeat. */
  exerciseIds: string[];
};

type DetailRow = {
  id: string;
  name: string | null;
  workout_date: string;
  created_at: string;
  finished_at: string | null;
  notes: string | null;
  workout_exercises:
    | {
        id: string;
        position: number;
        exercises: ExerciseInfo | null;
        sets: (DetailSet & { weight_unit: string })[] | null;
      }[]
    | null;
};

/**
 * A finished workout for the detail screen: the exercises in position order
 * with their sets in position order. Null when the id does not resolve for
 * this user, or the workout is not finished.
 *
 * Not `loadWorkout` from workouts.ts: that fetches the prior session and a
 * prior-best 1RM per exercise, one query each, for a screen that logs. A
 * read-only view needs neither.
 *
 * The note is the one field edited after the finish (on the summary), so
 * a note still queued on the phone is laid over the server's.
 */
export async function getWorkoutDetail(
  userId: string,
  workoutId: string,
  /** May be pending: it is only needed for the volume, after the fetch. */
  bodyweightIn: number | null | Promise<number | null>,
  unit: WeightUnit,
): Promise<WorkoutDetail | null> {
  const [{ data, error }, pending] = await Promise.all([
    supabase
      .from('workouts')
      .select(
        `id, name, workout_date, created_at, finished_at, notes,
         workout_exercises(id, position,
           exercises(${EXERCISE_FIELDS}),
           sets(id, position, weight, weight_value, weight_unit, reps, completed, note))`,
      )
      .eq('id', workoutId)
      .eq('user_id', userId)
      .not('finished_at', 'is', null)
      .maybeSingle(),
    pendingWrites(userId),
  ]);
  if (error || !data) return null;
  const row = data as unknown as DetailRow;
  if (!row.finished_at) return null;

  const exercises: DetailExercise[] = (row.workout_exercises ?? [])
    .filter((we) => we.exercises != null)
    .sort((a, b) => a.position - b.position)
    .map((we) => ({
      id: we.id,
      position: we.position,
      exercise: we.exercises!,
      sets: (we.sets ?? [])
        .map((row): DetailSet => {
          const s = toUserUnit(row, unit);
          return { id: s.id, position: s.position, weight: s.weight, weight_value: s.weight_value, reps: s.reps, completed: s.completed, note: s.note };
        })
        .sort((a, b) => a.position - b.position),
    }));

  const queuedNotes = pendingWorkoutNotes(pending, row.id);
  const bodyweight = await bodyweightIn;
  let volume = 0;
  let completedSets = 0;
  for (const we of exercises) {
    for (const s of we.sets) {
      if (!s.completed) continue;
      completedSets += 1;
      volume += setVolume(s, we.exercise, bodyweight);
    }
  }

  return {
    id: row.id,
    name: row.name,
    workoutDate: row.workout_date,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    notes: queuedNotes !== undefined ? queuedNotes : row.notes,
    exercises,
    volume,
    completedSets,
    exerciseIds: exercises.map((we) => we.exercise.id),
  };
}
