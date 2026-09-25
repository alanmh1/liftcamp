import { dumbbellCount } from "./dumbbell-load";

export type WeightType = "standard" | "bodyweight";

export type BwMode = "assist" | "body" | "added";

export function bwModeFromValue(v: number | null | undefined): BwMode {
  if (v == null) return "body";
  if (v < 0) return "assist";
  if (v > 0) return "added";
  return "body";
}

export function signedFromBw(mode: BwMode, magnitude: number): number {
  if (mode === "body") return 0;
  const m = Math.abs(magnitude);
  return mode === "assist" ? -m : m;
}

export type SetForDisplay = {
  weight: string | null;
  weight_value: number | null;
  reps?: number | null;
};

export function formatSetWeight(
  set: SetForDisplay,
  weightType: string | null | undefined,
  unit: string,
): string {
  const v = set.weight_value;
  if (v == null) return set.weight?.trim() || "—";
  if (weightType === "bodyweight") {
    if (v === 0) return "Bodyweight";
    if (v < 0) return `BW − ${Math.abs(v)} ${unit} assist`;
    return `BW + ${v} ${unit}`;
  }
  return `${v} ${unit}`;
}

// Numeric magnitude useful for 1RM-style comparisons.
// Returns null when the set has no usable weight signal.
export function numericWeight(set: SetForDisplay): number | null {
  if (set.weight_value != null) return set.weight_value;
  const m = (set.weight ?? "").match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number.parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Returns the load (in the user's unit) that should drive 1RM / PR math
 * for a given set. Returns null when the set should be excluded.
 *
 * - standard exercise:   weight_value, falling back to parsing the legacy
 *                        free-text `weight` column. Null if neither yields a number.
 * - bodyweight exercise: bodyweight + weight_value (signed: assist negative,
 *                        bodyweight 0, added positive). Null if bodyweight
 *                        is unset or weight_value is null.
 */
export function effectiveLoad(
  set: SetForDisplay,
  exercise: { weight_type?: string | null } | null | undefined,
  bodyweight: number | null | undefined,
): number | null {
  const wt = exercise?.weight_type ?? "standard";
  if (wt === "bodyweight") {
    if (bodyweight == null || !Number.isFinite(bodyweight)) return null;
    if (set.weight_value == null) return null;
    return bodyweight + set.weight_value;
  }
  return numericWeight(set);
}


/**
 * Exercises logged as time, not reps. The schema has no duration column
 * and no timed flag: a timed set would carry its seconds in `reps`, so
 * `setVolume` would read a 45 second hold as 45 reps. Listed by id, the
 * way STRENGTH_EXERCISES is, and always zero volume.
 *
 * Only bodyweight-type exercises are listed, because only they pick up a
 * load from bodyweight alone. Plank, Side Bridge and the isometric holds
 * are `standard` with no weight logged, so their volume is already 0.
 */
export const TIMED_EXERCISES: readonly string[] = [
  "57c7550a-4a9f-4caa-a783-7ce8b38ec9f4", // Wall Sit
];

export function isTimedExercise(exerciseId: string | null | undefined): boolean {
  return exerciseId != null && TIMED_EXERCISES.includes(exerciseId);
}

/**
 * Total volume contributed by one set, in the user's unit:
 * load × reps × sides × dumbbells.
 *
 * Unilateral exercises store reps PER SIDE, so `sides` is 2 for them. A
 * dumbbell exercise logs the weight of one dumbbell, so `dumbbells` is 2
 * when a dumbbell is held in each hand (see `dumbbellCount`); that needs
 * the exercise's `id` and `equipment`, and without them it is 1. Every
 * volume readout goes through here so the multipliers live in one place.
 * PRs and estimated max use the load alone and are unaffected.
 *
 * A bodyweight exercise logged with no weight (the `BW` box left empty)
 * moves the lifter's bodyweight, so its load here is the bodyweight. This
 * applies to volume only: `effectiveLoad` still returns null for it, so
 * PRs, estimated max and the rep-based check see no change. With no
 * bodyweight set the set adds 0, and a timed exercise always adds 0.
 */
export function setVolume(
  set: SetForDisplay,
  exercise:
    | {
        id?: string | null;
        equipment?: string | null;
        weight_type?: string | null;
        is_unilateral?: boolean | null;
      }
    | null
    | undefined,
  bodyweight: number | null | undefined,
): number {
  if (isTimedExercise(exercise?.id)) return 0;
  let load = effectiveLoad(set, exercise, bodyweight);
  if (
    load == null &&
    exercise?.weight_type === "bodyweight" &&
    set.weight_value == null &&
    bodyweight != null &&
    Number.isFinite(bodyweight)
  ) {
    load = bodyweight;
  }
  if (load == null || !set.reps) return 0;
  const sides = exercise?.is_unilateral ? 2 : 1;
  return load * set.reps * sides * dumbbellCount(exercise);
}
