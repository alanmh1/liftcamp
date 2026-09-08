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
};

/** A `sets` row as selected for prior-session lookup, before normalization. */
export type PriorSetRow = {
  position: number;
  weight: string | null;
  weight_value: number | null;
  reps: number | null;
};

/**
 * Flattens the `workout_exercises` rows of one prior workout into a single
 * ordered set list.
 *
 * The exercise can appear more than once in one workout. Every matching
 * workout_exercises row is flattened and then renumbered, so the caller sees
 * one continuous list rather than two restarting at position 0.
 *
 * Each app runs its own query with its own Supabase client and passes the rows
 * here, so the normalization rules stay identical on web and mobile.
 */
export function normalizePriorSets(
  rows: { sets: PriorSetRow[] | null }[],
): PriorSet[] {
  return rows
    .flatMap((we) => we.sets ?? [])
    .sort((a, b) => a.position - b.position)
    .map((s, i) => ({
      position: i,
      weight_value: numericWeight({ weight: s.weight, weight_value: s.weight_value }),
      reps: s.reps,
    }));
}

/**
 * The prior set to use for a given position when seeding.
 *
 * Position N takes prior position N. Once the prior session runs out, every
 * remaining position repeats its last set, which is what a user carrying a
 * 3-set history into a 5-set template expects to see.
 */
export function priorSetForPosition(prior: PriorSet[], position: number): PriorSet | null {
  if (prior.length === 0) return null;
  return prior[Math.min(position, prior.length - 1)];
}
