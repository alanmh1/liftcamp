import {
  summarizeSession,
  toUserUnit,
  type ExerciseSession,
  type ProgressExercise,
  type WeightUnit,
} from '@liftcamp/shared';

import { PR_SCAN_MAX_PAGES, PR_SCAN_PAGE } from '@/data/history';
import { supabase } from '../../lib/supabase';

/**
 * Reads for the exercise screen: one exercise's sessions across finished
 * workouts, and when each exercise was last done. Same rules as the other
 * data modules: screens never import `supabase`, this module only reads, and
 * every set passes through `toUserUnit` on its way out.
 */

export type SessionSet = {
  id: string;
  position: number;
  weight: string | null;
  weight_value: number | null;
  reps: number | null;
  /** Cardio only. */
  duration_seconds: number | null;
  distance_meters: number | null;
  note: string | null;
};

/** One finished workout's completed sets for the exercise, in the order they were done. */
export type SessionDetail = {
  workoutId: string;
  workoutName: string | null;
  workoutDate: string;
  finishedAt: string;
  sets: SessionSet[];
};

type SessionRow = {
  id: string;
  name: string | null;
  workout_date: string;
  finished_at: string | null;
  workout_exercises:
    | {
        created_at: string | null;
        sets: (SessionSet & { completed: boolean; weight_unit: string })[] | null;
      }[]
    | null;
};

const SESSION_SELECT = `id, name, workout_date, finished_at,
  workout_exercises!inner(created_at, exercise_id,
    sets(id, position, weight, weight_value, weight_unit, reps, duration_seconds, distance_meters, completed, note))`;

/**
 * An exercise can appear twice in one workout (added, abandoned, added
 * again). The rows concatenate in created_at order and the sets renumber,
 * the same rule normalizePriorSets follows for the Previous column.
 */
function toSession(row: SessionRow, unit: WeightUnit): SessionDetail | null {
  if (!row.finished_at) return null;
  const wes = [...(row.workout_exercises ?? [])].sort((a, b) =>
    (a.created_at ?? '').localeCompare(b.created_at ?? ''),
  );
  const sets: SessionSet[] = [];
  for (const we of wes) {
    const done = (we.sets ?? []).filter((s) => s.completed).sort((a, b) => a.position - b.position);
    for (const s of done.map((d) => toUserUnit(d, unit))) {
      sets.push({
        id: s.id,
        position: sets.length,
        weight: s.weight,
        weight_value: s.weight_value,
        reps: s.reps,
        duration_seconds: s.duration_seconds ?? null,
        distance_meters: s.distance_meters ?? null,
        note: s.note,
      });
    }
  }
  return { workoutId: row.id, workoutName: row.name, workoutDate: row.workout_date, finishedAt: row.finished_at, sets };
}

/**
 * A page of the exercise's finished sessions, newest first. `before` is
 * the previous page's `cursor`, so the next page starts after it; paging
 * on a timestamp rather than an offset means a workout finished
 * mid-scroll cannot shift the seam.
 *
 * A session with no completed set of the exercise is left out, as the
 * chart and records leave it out: the exercise was added and nothing was
 * ticked. `cursor` is the `finished_at` of the last row read, kept or
 * not, so a page that ends on a left-out session does not read it again.
 */
export async function getExerciseSessions(
  userId: string,
  exerciseId: string,
  unit: WeightUnit,
  { limit = 20, before }: { limit?: number; before?: string | null } = {},
): Promise<{ sessions: SessionDetail[]; hasMore: boolean; cursor: string | null }> {
  let q = supabase
    .from('workouts')
    .select(SESSION_SELECT)
    .eq('user_id', userId)
    .eq('workout_exercises.exercise_id', exerciseId)
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(limit + 1);
  if (before) q = q.lt('finished_at', before);
  const { data, error } = await q;
  if (error || !data) return { sessions: [], hasMore: false, cursor: null };
  const rows = data as unknown as SessionRow[];
  const page = rows.slice(0, limit);
  const sessions = page
    .map((r) => toSession(r, unit))
    .filter((s): s is SessionDetail => s != null && s.sets.length > 0);
  return { sessions, hasMore: rows.length > limit, cursor: page[page.length - 1]?.finished_at ?? null };
}

/**
 * Every finished session for the exercise, for the chart and the records.
 * Paged at the PR scan's page size and abandoned past its cap, for the
 * same reason: a record computed over part of the history is wrong, not
 * merely incomplete. Null when abandoned.
 */
export async function getExerciseProgress(
  userId: string,
  exerciseId: string,
  /** Both may be pending: they are only needed to summarize, after the fetch. */
  exerciseIn: ProgressExercise | Promise<ProgressExercise>,
  bodyweightIn: number | null | Promise<number | null>,
  unit: WeightUnit,
): Promise<{ sessions: ExerciseSession[]; details: SessionDetail[] } | null> {
  const rows: SessionRow[] = [];
  for (let page = 0; ; page += 1) {
    if (page >= PR_SCAN_MAX_PAGES) return null;
    const from = page * PR_SCAN_PAGE;
    const { data, error } = await supabase
      .from('workouts')
      .select(SESSION_SELECT)
      .eq('user_id', userId)
      .eq('workout_exercises.exercise_id', exerciseId)
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false })
      .range(from, from + PR_SCAN_PAGE - 1);
    if (error) return null;
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as SessionRow[]));
    if (data.length < PR_SCAN_PAGE) break;
  }
  const details = rows.map((r) => toSession(r, unit)).filter((s): s is SessionDetail => s != null && s.sets.length > 0);
  const [exercise, bodyweight] = await Promise.all([exerciseIn, bodyweightIn]);
  const sessions = details.map((d) => ({
    workoutId: d.workoutId,
    workoutDate: d.workoutDate,
    summary: summarizeSession(d.sets, exercise, bodyweight),
  }));
  return { sessions, details };
}

type LastDoneRow = {
  exercise_id: string;
  workouts: { workout_date: string; finished_at: string | null } | null;
  sets: { completed: boolean }[] | null;
};

/**
 * Exercise id to the date it was last done: the latest finished workout in
 * which the exercise has at least one completed set. One scan of the
 * account's workout_exercises rows, paged like the PR scan; past the cap
 * the map is what was read, since a missing date only hides a Last done
 * label rather than misstating a record.
 */
export async function getLastDoneDates(userId: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let page = 0; page < PR_SCAN_MAX_PAGES; page += 1) {
    const from = page * PR_SCAN_PAGE;
    const { data, error } = await supabase
      .from('workout_exercises')
      .select('exercise_id, workouts!inner(workout_date, finished_at), sets(completed)')
      .eq('user_id', userId)
      .not('workouts.finished_at', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + PR_SCAN_PAGE - 1);
    if (error || !data) break;
    for (const row of data as unknown as LastDoneRow[]) {
      const date = row.workouts?.workout_date;
      if (!date || !(row.sets ?? []).some((s) => s.completed)) continue;
      const prev = out.get(row.exercise_id);
      if (!prev || date > prev) out.set(row.exercise_id, date);
    }
    if (data.length < PR_SCAN_PAGE) break;
  }
  return out;
}
