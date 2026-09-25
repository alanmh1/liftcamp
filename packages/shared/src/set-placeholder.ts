import type { StoredWeight } from "./units";

/**
 * The gray values an empty weight or reps box shows while logging, and what
 * the check logs when the box is left empty.
 *
 * Seeded rows are empty; everything the app used to prefill (the last
 * session, the cold-start reps) arrives here instead, so a value on a set is
 * always one the user typed, stepped or logged.
 *
 * Each field resolves on its own, in this order:
 *
 * 1. The nearest set above in this workout with that field filled. Filling
 *    in set 1 changes what every untouched set below it shows.
 * 2. The same set number from the last finished session (the last prior
 *    set repeats past its end, like the Previous column).
 * 3. Reps only: the routine's target reps, low end of a range.
 * 4. Reps only: the cold-start reps, for an exercise with no routine target.
 * 5. Nothing.
 */

/** A set as the placeholder reads it: in the user's unit, with its stored weight. */
export type PlaceholderSource = {
  weight_value: number | null;
  reps: number | null;
  /** The weight as logged, when that was in the other unit. */
  stored?: StoredWeight | null;
};

export type PlaceholderWeight = { value: number; stored: StoredWeight | null };

export type SetPlaceholder = {
  weight: PlaceholderWeight | null;
  reps: number | null;
};

export type PlaceholderInput = {
  /** This exercise's sets in this workout, in order. */
  sets: PlaceholderSource[];
  /** The last finished session's sets, in order. */
  prior: PlaceholderSource[];
  /** The routine's free-text target reps ("8-10", "30s"), or null. */
  targetReps?: string | null;
  /** Used only when there is no routine target at all. */
  coldReps?: number | null;
  /** A body-only exercise gets reps only; its weight box keeps "BW". */
  repsOnly?: boolean;
};

/**
 * A routine's target reps as a number to log: the low end of a range, the
 * count before "each", and null for a timed target ("30s", "45 sec", "1 min")
 * or anything without a leading number.
 */
export function targetRepsNumber(target: string | null | undefined): number | null {
  const text = target?.trim().toLowerCase();
  if (!text) return null;
  if (/\d\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)\b/.test(text)) return null;
  const match = /^(\d+)/.exec(text);
  if (!match) return null;
  const n = Number(match[1]);
  return n > 0 ? n : null;
}

function priorAt(prior: PlaceholderSource[], index: number): PlaceholderSource | null {
  if (prior.length === 0) return null;
  return prior[Math.min(index, prior.length - 1)];
}

/** The placeholder for the set at `index`. */
export function setPlaceholder(input: PlaceholderInput, index: number): SetPlaceholder {
  const above = input.sets.slice(0, index).reverse();
  const prior = priorAt(input.prior, index);

  let weight: PlaceholderWeight | null = null;
  if (!input.repsOnly) {
    const filled = above.find((s) => s.weight_value != null);
    if (filled && filled.weight_value != null) {
      weight = { value: filled.weight_value, stored: filled.stored ?? null };
    } else if (prior && prior.weight_value != null) {
      weight = { value: prior.weight_value, stored: prior.stored ?? null };
    }
  }

  const hasTarget = input.targetReps != null && input.targetReps.trim() !== "";
  const reps =
    above.find((s) => s.reps != null)?.reps ??
    prior?.reps ??
    (hasTarget ? targetRepsNumber(input.targetReps) : (input.coldReps ?? null));

  return { weight, reps };
}

/** Every set's placeholder, in order. */
export function setPlaceholders(input: PlaceholderInput): SetPlaceholder[] {
  return input.sets.map((_, i) => setPlaceholder(input, i));
}
