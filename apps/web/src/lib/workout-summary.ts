import { setVolume, effectiveLoad, type SetForDisplay } from "@/lib/set-weight";
import { oneRepMaxNumeric } from "@/lib/one-rep-max";

type ExerciseLike = { name?: string | null; weight_type?: string | null; is_unilateral?: boolean | null } | null | undefined;

export type SessionSet = SetForDisplay & { completed: boolean };

export type SessionExercise = {
  exercise: ExerciseLike;
  sets: SessionSet[];
};

export type SessionTotals = {
  exerciseCount: number;
  setCount: number;
  volume: number;
};

/**
 * Totals for the session that just finished. Only completed sets count, and an
 * exercise the user skipped entirely is not counted.
 */
export function sessionTotals(
  exercises: SessionExercise[],
  bodyweight: number | null | undefined,
): SessionTotals {
  let exerciseCount = 0;
  let setCount = 0;
  let volume = 0;
  for (const we of exercises) {
    let touched = false;
    for (const s of we.sets ?? []) {
      if (!s.completed) continue;
      touched = true;
      setCount += 1;
      volume += setVolume(s, we.exercise, bodyweight);
    }
    if (touched) exerciseCount += 1;
  }
  return { exerciseCount, setCount, volume };
}

export type HistoricSetRow = SetForDisplay & {
  workout_exercises: {
    workout_id: string;
    exercise_id: string;
    exercises: ExerciseLike;
  } | null;
};

/**
 * Names of exercises where this session beat the user's best previous estimated
 * 1RM for that exercise.
 *
 * An exercise with no prior completed set is not a PR. Nothing has been beaten
 * yet, and listing five "PRs" in a first session makes the word meaningless.
 */
export function prExercisesForWorkout(
  rows: HistoricSetRow[],
  workoutId: string,
  bodyweight: number | null | undefined,
): string[] {
  const prior = new Map<string, number>();
  const session = new Map<string, number>();
  const names = new Map<string, string>();

  for (const r of rows) {
    const we = r.workout_exercises;
    if (!we) continue;
    const key = we.exercise_id;
    if (we.exercises?.name) names.set(key, we.exercises.name);
    const orm = oneRepMaxNumeric(
      effectiveLoad(r, we.exercises, bodyweight),
      r.reps,
    );
    if (orm == null) continue;
    const bucket = we.workout_id === workoutId ? session : prior;
    if (orm > (bucket.get(key) ?? -Infinity)) bucket.set(key, orm);
  }

  const out: string[] = [];
  for (const [key, best] of session) {
    const before = prior.get(key);
    if (before == null) continue;
    if (best > before) out.push(names.get(key) ?? "Exercise");
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * Whole minutes between two ISO timestamps, or null when either is missing.
 */
export function durationMinutes(startIso: string | null | undefined, endIso: string | null | undefined): number | null {
  if (!startIso || !endIso) return null;
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const mins = Math.round((end - start) / 60000);
  return mins >= 0 ? mins : null;
}

/**
 * Percentage change in volume against the previous session of the same name.
 * Returns null when there is no comparable session or the previous volume was
 * zero, so the caller can simply omit the line.
 */
export function volumeDelta(current: number, previous: number | null): number | null {
  if (previous == null || previous <= 0 || current <= 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct === 0 ? null : pct;
}
