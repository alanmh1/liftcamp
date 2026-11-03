import {
  applyPendingOps,
  cardioSeconds,
  computePrSetIds,
  countedTotals,
  pendingWorkoutDeletes,
  toUserUnit,
  type OverlayWorkout,
  type WeightUnit,
} from '@liftcamp/shared';

import { scanCache } from '@/data/scan-cache';
import { EXERCISE_FIELDS, getBodyweight, type ExerciseInfo } from '@/data/workouts';
import { deletedWorkoutIds, idList, pendingWrites } from '@/data/write-queue';
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
 * The PR pass gives up on an account with more `workout_exercises` rows
 * than this and reports no counts at all. A truncated scan is worse than
 * none: without the earliest sets, later sets look like first-time
 * records, so the screen would show PRs that are wrong rather than PRs
 * that are missing. 20,000 rows is 40 pages, about 20 years at five
 * exercises a workout, four workouts a week. Lower it below an account's
 * row count (1 works for any account with two rows) to exercise the
 * no-ribbon path on a real account.
 *
 * The exercise screen's records and the picker's Last done dates
 * (data/exercise-progress.ts) stop at the same number of rows.
 */
export const PR_SCAN_MAX_ROWS = 20_000;

/** Pages of the PR pass in flight at once, after the first. */
const PR_SCAN_PARALLEL = 4;

export type HistoryWorkout = {
  id: string;
  /** The owner. A row offers delete only when it is the signed-in user. */
  userId: string;
  name: string | null;
  workoutDate: string;
  createdAt: string;
  finishedAt: string;
  exerciseCount: number;
  /** In the user's unit, via setVolume so unilateral doubling is honoured. */
  volume: number;
  /** Completed cardio time in seconds, shown where volume goes when there is no volume. */
  cardioSeconds: number;
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
    /** So cardio sets no PR and adds no volume. */
    set_type: string | null;
    /** For Pro starting weights, which look for a related lift (data/pro-inputs.ts). */
    mechanic: string | null;
    primary_muscle: string | null;
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
        /** 'warmup' for a Pro warm-up row, which sets no PR and adds no volume. */
        set_type: string | null;
      }[]
    | null;
};

/**
 * Every `workout_exercises` row the user owns, with its sets, in pages.
 * Null when the scan was abandoned or a request failed.
 *
 * All or nothing: an account over `PR_SCAN_MAX_ROWS` rows, or any page
 * that fails, returns null rather than a partial list, because the PR
 * maths below is only right over the whole account. Missing the earliest
 * rows would turn later sets into false first-time records.
 *
 * The first page asks for the total. Past it, the rest are fetched
 * `PR_SCAN_PARALLEL` at a time and put back in page order. An account
 * over the cap is refused on that first answer, before any other page.
 *
 * The exercise's name and volume fields and the workout's date and
 * `finished_at` ride along for Profile, which derives its PRs, volume and
 * strength levels from this one scan. The PR maths ignores them.
 */
// The proper fix for the row cap is computing PRs on the server, a later branch.
async function scanWorkoutExercises(userId: string, unit: WeightUnit): Promise<ScanRow[] | null> {
  // Deleted on the phone and not synced: left out, so PRs, Profile and the
  // exercise records drop the workout at once.
  const deleted = new Set(await deletedWorkoutIds(userId));

  const page = (n: number, withCount = false) => {
    const from = n * PR_SCAN_PAGE;
    // Ordered by id so consecutive ranges never overlap or skip a row.
    return supabase
      .from('workout_exercises')
      .select(
        `workout_id, exercise_id,
         exercises(id, name, equipment, weight_type, is_unilateral, set_type, mechanic, primary_muscle),
         workouts(workout_date, finished_at),
         sets(id, weight, weight_value, weight_unit, reps, completed, created_at, position, set_type)`,
        withCount ? { count: 'exact' } : undefined,
      )
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(from, from + PR_SCAN_PAGE - 1);
  };

  const first = await page(0, true);
  if (first.error || first.count == null) return null;
  if (first.count > PR_SCAN_MAX_ROWS) return null;
  const pages: unknown[][] = [first.data ?? []];

  // The rest, at most PR_SCAN_PARALLEL requests at once, each into its own
  // slot so the order is the pages' order whatever order they land in.
  const total = Math.ceil(first.count / PR_SCAN_PAGE);
  let next = 1;
  let failed = false;
  const worker = async () => {
    while (!failed && next < total) {
      const n = next;
      next += 1;
      const { data, error } = await page(n);
      if (error) {
        failed = true;
        return;
      }
      pages[n] = data ?? [];
    }
  };
  await Promise.all(Array.from({ length: Math.max(0, Math.min(PR_SCAN_PARALLEL, total - 1)) }, worker));
  if (failed) return null;

  // A full last page may have more after it: rows logged since the count
  // came back. Read on, one page at a time, as the scan did before, until a
  // short page, and give up on rows past the cap.
  while (pages[pages.length - 1].length === PR_SCAN_PAGE) {
    const { data, error } = await page(pages.length);
    if (error) return null;
    if (data && data.length > 0 && pages.length * PR_SCAN_PAGE >= PR_SCAN_MAX_ROWS) return null;
    pages.push(data ?? []);
  }

  const rows: ScanRow[] = [];
  for (const row of pages.flat() as ScanRow[]) {
    if (deleted.has(row.workout_id)) continue;
    rows.push({ ...row, sets: (row.sets ?? []).map((s) => toUserUnit(s, unit)) });
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
    { exercise: { weight_type: string | null; set_type: string | null } | null; sets: NonNullable<ScanRow['sets']> }
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
  user_id: string;
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
          set_type: string | null;
        } | null;
        sets:
          | {
              weight: string | null;
              weight_value: number | null;
              weight_unit: string;
              reps: number | null;
              duration_seconds: number | null;
              completed: boolean;
              set_type: string | null;
            }[]
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
  const deleted = await deletedWorkoutIds(userId);
  let q = supabase
    .from('workouts')
    .select(
      `id, user_id, name, workout_date, created_at, finished_at,
       workout_exercises(exercises(id, equipment, weight_type, is_unilateral, set_type),
         sets(weight, weight_value, weight_unit, reps, duration_seconds, completed, set_type))`,
    )
    .eq('user_id', userId)
    .not('finished_at', 'is', null);
  // Left out on the server, so the offsets of later pages stay right.
  if (deleted.length > 0) q = q.not('id', 'in', idList(deleted));
  // One row past the page decides `hasMore` without a second count query.
  const { data, error } = await q
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
    const { volume } = countedTotals(
      wes.map((we) => ({ exercise: we.exercises, sets: (we.sets ?? []).map((s) => toUserUnit(s, ctx.unit)) })),
      ctx.bodyweight,
    );
    workouts.push({
      id: w.id,
      userId: w.user_id,
      name: w.name,
      workoutDate: w.workout_date,
      createdAt: w.created_at,
      finishedAt: w.finished_at,
      exerciseCount: wes.length,
      volume,
      cardioSeconds: cardioSeconds(wes.map((we) => ({ exercise: we.exercises, sets: we.sets }))),
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
  /** Cardio only. */
  duration_seconds: number | null;
  distance_meters: number | null;
  incline_percent: number | null;
  completed: boolean;
  note: string | null;
  /** 'warmup' for a Pro warm-up row: badged W, left out of volume and set counts. */
  set_type: string | null;
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
  /** The owner. The delete menu shows only when it is the signed-in user. */
  userId: string;
  name: string | null;
  workoutDate: string;
  createdAt: string;
  finishedAt: string;
  notes: string | null;
  exercises: DetailExercise[];
  /** Completed working sets only (countedTotals), in the user's unit. */
  volume: number;
  /** Completed cardio time in seconds, shown where volume goes when there is no volume. */
  cardioSeconds: number;
  /** Completed working sets; warm-ups are left out. */
  completedSets: number;
  /** Exercise ids in position order, for Repeat. */
  exerciseIds: string[];
  /** The routine day it was done from, for Repeat. */
  templateId: string | null;
};

type DetailRow = {
  id: string;
  user_id: string;
  name: string | null;
  workout_date: string;
  created_at: string;
  finished_at: string | null;
  notes: string | null;
  template_id: string | null;
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
 * this user, the workout is not finished, or its delete is queued.
 *
 * Not `loadWorkout` from workouts.ts: that fetches the prior session and a
 * prior-best 1RM per exercise, one query each, for a screen that logs. The
 * detail needs neither.
 *
 * The writes still queued on the phone are laid over the server's rows
 * (applyPendingOps): a note edited on the summary, and every change saved
 * from edit mode, show here before they sync.
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
        `id, user_id, name, workout_date, created_at, finished_at, notes, template_id,
         workout_exercises(id, position,
           exercises(${EXERCISE_FIELDS}),
           sets(id, position, weight, weight_value, weight_unit, reps, duration_seconds, distance_meters, incline_percent, completed, note, set_type))`,
      )
      .eq('id', workoutId)
      .eq('user_id', userId)
      .not('finished_at', 'is', null)
      .maybeSingle(),
    pendingWrites(userId),
  ]);
  if (error || !data) return null;
  // Deleted on the phone, delete not synced yet.
  if (pendingWorkoutDeletes(pending).includes(data.id)) return null;
  // The writes still on the phone laid over the server's rows, as
  // loadWorkout does, so an edit saved with no signal shows at once.
  const row = applyPendingOps(workoutId, data as unknown as OverlayWorkout, pending) as unknown as DetailRow | null;
  if (!row?.finished_at) return null;

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
          return {
            id: s.id,
            position: s.position,
            // A set added on the phone has no legacy text weight.
            weight: s.weight ?? null,
            weight_value: s.weight_value,
            reps: s.reps,
            duration_seconds: s.duration_seconds ?? null,
            distance_meters: s.distance_meters ?? null,
            incline_percent: s.incline_percent ?? null,
            completed: s.completed,
            note: s.note,
            set_type: s.set_type ?? null,
          };
        })
        .sort((a, b) => a.position - b.position),
    }));

  const bodyweight = await bodyweightIn;
  const { volume, sets: completedSets } = countedTotals(exercises, bodyweight);

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    workoutDate: row.workout_date,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    notes: row.notes,
    exercises,
    volume,
    cardioSeconds: cardioSeconds(exercises),
    completedSets,
    exerciseIds: exercises.map((we) => we.exercise.id),
    templateId: row.template_id,
  };
}
