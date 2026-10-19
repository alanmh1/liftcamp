import { numericWeight } from "./set-weight";

/**
 * One set from the user's previous session of an exercise, normalized for
 * seeding and for the "last session" hints on the logging screen.
 *
 * `weight_value` here is already resolved: it prefers the numeric column and
 * falls back to parsing the legacy free-text `weight`, so callers never have to
 * touch that column. Nothing writes `weight` any more.
 */
export type PriorSet = {
  position: number;
  weight_value: number | null;
  reps: number | null;
  /** The unit the set was logged in, when the row carried one. */
  weight_unit?: string;
  /** A cardio set's time and distance; missing on rows read without them. */
  duration_seconds?: number | null;
  distance_meters?: number | null;
};

/** A `sets` row as selected for prior-session lookup, before normalization. */
export type PriorSetRow = {
  position: number;
  weight: string | null;
  weight_value: number | null;
  weight_unit?: string;
  reps: number | null;
  completed: boolean;
  duration_seconds?: number | null;
  distance_meters?: number | null;
};

/**
 * One `workout_exercises` row of a prior workout, with its sets.
 *
 * `created_at` orders the rows when the same exercise appears more than once
 * in a workout.
 */
export type PriorExerciseRow = {
  created_at: string | null;
  sets: PriorSetRow[] | null;
};

/**
 * Turns one prior workout's rows for an exercise into an ordered set list.
 *
 * Only completed sets count. An untouched cold-start row carries placeholder
 * reps and no weight, and seeding from those produced the interleaved
 * "40x10, empty, 45x10, empty" list: the exercise had two `workout_exercises`
 * rows in that workout, one logged and one abandoned, and merging them by
 * position zipped the two together.
 *
 * So rows are concatenated in `created_at` order and renumbered, never sorted
 * across rows by position. Position is only meaningful inside a single row.
 *
 * Returns [] when the workout has no completed sets for the exercise, which is
 * the caller's signal to look at the next older workout.
 */
export function normalizePriorSets(rows: PriorExerciseRow[]): PriorSet[] {
  const ordered = [...rows].sort((a, b) =>
    (a.created_at ?? "").localeCompare(b.created_at ?? ""),
  );

  const out: PriorSet[] = [];
  for (const we of ordered) {
    const sets = (we.sets ?? [])
      .filter((s) => s.completed)
      .sort((a, b) => a.position - b.position);
    for (const s of sets) {
      out.push({
        position: out.length,
        weight_value: numericWeight({ weight: s.weight, weight_value: s.weight_value }),
        reps: s.reps,
        ...(s.weight_unit ? { weight_unit: s.weight_unit } : {}),
        ...(s.duration_seconds !== undefined ? { duration_seconds: s.duration_seconds } : {}),
        ...(s.distance_meters !== undefined ? { distance_meters: s.distance_meters } : {}),
      });
    }
  }
  return out;
}

/**
 * The most recent workout that actually has completed sets for the exercise.
 *
 * `workouts` must be ordered most recent first. A workout where the exercise
 * was added but never logged is skipped rather than seeding an empty session.
 */
export function firstCompletedPriorSession(workouts: PriorExerciseRow[][]): PriorSet[] {
  for (const rows of workouts) {
    const sets = normalizePriorSets(rows);
    if (sets.length > 0) return sets;
  }
  return [];
}

/**
 * The prior set to use for a given position when seeding.
 *
 * Position N takes prior position N. Once the prior session runs out, every
 * remaining position repeats its last set, which is what a user carrying a
 * 3-set history into a 5-set template expects to see.
 */
export function priorSetForPosition<T extends PriorSet>(prior: T[], position: number): T | null {
  if (prior.length === 0) return null;
  return prior[Math.min(position, prior.length - 1)];
}
