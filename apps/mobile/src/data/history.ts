import { computePrSetIds, setVolume } from '@liftcamp/shared';

import { getBodyweight } from '@/data/workouts';
import { supabase } from '../../lib/supabase';

/**
 * Reads for the History tab. Same rules as workouts.ts and home.ts: screens
 * never import `supabase`. This module only reads.
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
  bodyweight: number | null;
  /** Workout id to PR count. Null when the PR pass was abandoned. */
  prCounts: Map<string, number> | null;
};

export async function loadHistoryContext(userId: string): Promise<HistoryContext> {
  const bodyweight = await getBodyweight(userId);
  const prCounts = await getPrCounts(userId, bodyweight);
  return { bodyweight, prCounts };
}

type ScanRow = {
  workout_id: string;
  exercise_id: string;
  exercises: { weight_type: string | null } | null;
  sets:
    | {
        id: string;
        weight: string | null;
        weight_value: number | null;
        reps: number | null;
        completed: boolean;
        created_at: string | null;
        position: number;
      }[]
    | null;
};

/**
 * PR count per workout, in one pass over the account.
 *
 * Not `getPriorBestOrm` per row: that is one query per exercise, so a page
 * of 20 workouts at 5 exercises each would be 100 round trips. Instead every
 * `workout_exercises` row the user owns comes down in pages, the completed
 * sets group by exercise, and `computePrSetIds` marks the records in each
 * group. The set ids tally back to workout ids through a map built while
 * paging.
 *
 * Only completed sets go in. `computePrSetIds` does not filter on
 * `completed` itself (`getPriorBestOrm` does, which makes this easy to
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
 *
 * All or nothing: past `PR_SCAN_MAX_PAGES` this returns null.
 */
export async function getPrCounts(
  userId: string,
  bodyweight: number | null,
): Promise<Map<string, number> | null> {
  const rows: ScanRow[] = [];
  for (let page = 0; ; page += 1) {
    if (page >= PR_SCAN_MAX_PAGES) return null;
    const from = page * PR_SCAN_PAGE;
    // Ordered by id so consecutive ranges never overlap or skip a row.
    const { data, error } = await supabase
      .from('workout_exercises')
      .select(
        `workout_id, exercise_id,
         exercises(weight_type),
         sets(id, weight, weight_value, reps, completed, created_at, position)`,
      )
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(from, from + PR_SCAN_PAGE - 1);
    if (error) return null;
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as ScanRow[]));
    if (data.length < PR_SCAN_PAGE) break;
  }
  return tallyPrs(rows, bodyweight);
}

/** Pure. Split out so the paging above and the tally can be read apart. */
export function tallyPrs(rows: ScanRow[], bodyweight: number | null): Map<string, number> {
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

  const counts = new Map<string, number>();
  for (const { exercise, sets } of byExercise.values()) {
    sets.sort((a, b) => a.position - b.position);
    for (const setId of computePrSetIds(sets, exercise, bodyweight)) {
      const workoutId = workoutOfSet.get(setId);
      if (!workoutId) continue;
      counts.set(workoutId, (counts.get(workoutId) ?? 0) + 1);
    }
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
        exercises: { weight_type: string | null; is_unilateral: boolean | null } | null;
        sets: { weight: string | null; weight_value: number | null; reps: number | null; completed: boolean }[] | null;
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
       workout_exercises(exercises(weight_type, is_unilateral),
         sets(weight, weight_value, reps, completed))`,
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
        volume += setVolume(s, we.exercises, ctx.bodyweight);
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
