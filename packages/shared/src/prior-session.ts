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
