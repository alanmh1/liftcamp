// 1RM helpers using Epley formula: 1RM = weight * (1 + reps/30)
export function parseWeight(weight: string | null | undefined): number | null {
  if (!weight) return null;
  const m = weight.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number.parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

export function oneRepMax(weight: string | null | undefined, reps: number | null | undefined): number | null {
  const w = parseWeight(weight);
  if (w == null || reps == null || reps <= 0) return null;
  return w * (1 + reps / 30);
}

export function oneRepMaxNumeric(weight: number | null | undefined, reps: number | null | undefined): number | null {
  if (weight == null || !Number.isFinite(weight) || reps == null || reps <= 0) return null;
  return weight * (1 + reps / 30);
}

/**
 * The weight that `reps` clean reps take for a given 1RM: the inverse of
 * `oneRepMaxNumeric`, so `weightForReps(oneRepMaxNumeric(w, r), r)` is `w`.
 * Null for a missing max or no reps.
 */
export function weightForReps(oneRm: number | null | undefined, reps: number | null | undefined): number | null {
  if (oneRm == null || !Number.isFinite(oneRm) || reps == null || reps <= 0) return null;
  return oneRm / (1 + reps / 30);
}
