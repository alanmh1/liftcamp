// How a bodyweight set's weight prints, in one place: the set row's
// Previous column, the progression sheet and summary, and the Live
// Activity's set and last lines all go through here.

import { tidyWeight, type WeightUnit } from "./units";

type BodyweightExercise = { weight_type?: string | null; equipment?: string | null };

/**
 * Whether the weight box means load on top of bodyweight: a
 * bodyweight-type exercise, or any body-only one (its box reads "BW" and
 * its column "+LBS").
 */
export function isBodyweightLoad(exercise: BodyweightExercise): boolean {
  return exercise.weight_type === "bodyweight" || (exercise.equipment ?? "").trim().toLowerCase() === "body only";
}

function unitLabel(unit: WeightUnit): string {
  return unit === "kg" ? "kg" : "lbs";
}

/**
 * "BW", "BW +10" or "BW −20" (assist; the minus says it), in the user's
 * unit. With `withUnit`, "BW +10 lbs". Null and 0 are bodyweight alone.
 * A set logged in the other unit arrives converted and prints rounded.
 */
export function formatBodyweight(value: number | null, unit: WeightUnit, withUnit = false): string {
  const v = tidyWeight(value, unit);
  if (v == null || v === 0) return "BW";
  const suffix = withUnit ? ` ${unitLabel(unit)}` : "";
  return v > 0 ? `BW +${v}${suffix}` : `BW −${Math.abs(v)}${suffix}`;
}

/**
 * The set row's Previous column: "140 × 10", "BW × 12", "BW +10 × 12".
 * The unit is in the column header, so it is left off. "—" with nothing
 * logged.
 */
export function formatPreviousSet(
  prior: { weight_value: number | null; reps: number | null } | null,
  unit: WeightUnit,
  exercise: BodyweightExercise,
): string {
  if (!prior || (prior.weight_value == null && prior.reps == null)) return "—";
  const r = prior.reps == null ? "" : String(prior.reps);
  let w: string;
  if (isBodyweightLoad(exercise)) {
    w = formatBodyweight(prior.weight_value, unit);
  } else {
    const v = tidyWeight(prior.weight_value, unit);
    w = v == null ? "" : String(v);
  }
  if (w && r) return `${w} × ${r}`;
  return w || r || "—";
}
