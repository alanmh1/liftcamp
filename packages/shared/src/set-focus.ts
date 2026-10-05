// The set a workout is "on", and that set as one line of text, for the Live
// Activity on the lock screen and in the Dynamic Island. Pure, no React.
//
// The workout screen has no current-set field: its active set is the first
// set of an exercise that is not done (exercise-card.tsx). This picks the
// exercise the same way the user moves through a workout, and the set the
// same way the card does.

import { formatSetWeight } from "./set-weight";
import { tidyWeight, type WeightUnit } from "./units";

type FocusExercise = {
  position: number;
  exercise: { id: string };
  sets: readonly { completed: boolean }[];
};

export type SetFocus<E, S> = {
  exercise: E;
  /** Null only when the exercise has no sets. */
  set: S | null;
  /** 1-based; 0 when the exercise has no sets. */
  setIndex: number;
  setCount: number;
};

/**
 * The exercise matching `hintExerciseId` while it still has a set to do,
 * else the first exercise by position with one, else the last exercise.
 * Within it, the first set not done, else the last set. Null for a workout
 * with no exercises.
 *
 * The hint is the exercise whose set started the rest, so checking a set
 * out of order keeps the activity on that exercise until it is finished.
 */
export function currentSetFocus<E extends FocusExercise>(
  workout: { exercises: readonly E[] },
  hintExerciseId?: string | null,
): SetFocus<E, E["sets"][number]> | null {
  const ordered = [...workout.exercises].sort((a, b) => a.position - b.position);
  if (ordered.length === 0) return null;
  const open = (e: E) => e.sets.some((s) => !s.completed);
  const exercise =
    (hintExerciseId != null ? ordered.find((e) => e.exercise.id === hintExerciseId && open(e)) : undefined) ??
    ordered.find(open) ??
    ordered[ordered.length - 1];
  const setCount = exercise.sets.length;
  if (setCount === 0) return { exercise, set: null, setIndex: 0, setCount: 0 };
  const firstOpen = exercise.sets.findIndex((s) => !s.completed);
  const i = firstOpen === -1 ? setCount - 1 : firstOpen;
  return { exercise, set: exercise.sets[i], setIndex: i + 1, setCount };
}

function unitLabel(unit: WeightUnit): string {
  return unit === "kg" ? "kg" : "lbs";
}

type LineSet = { weight_value: number | null; reps: number | null };

/** Whether the weight box means load on top of bodyweight. */
function isBodyweight(exercise: { weight_type?: string | null; equipment?: string | null }): boolean {
  return exercise.weight_type === "bodyweight" || exercise.equipment === "body only";
}

function repsText(reps: number): string {
  return reps === 1 ? "1 rep" : `${reps} reps`;
}

/**
 * One set as "90 lbs × 8", "BW × 12" or "BW + 10 lbs × 6". A weight or
 * reps box left empty takes the prior session's set at the same position,
 * the way the set row's placeholders do. Null when both are still empty.
 *
 * `prior` is that one prior set, already picked (priorSetForPosition), in
 * the user's unit like the set itself.
 */
export function formatSetLine(
  set: LineSet,
  prior: LineSet | null,
  unit: WeightUnit,
  exercise: { weight_type?: string | null; equipment?: string | null },
): string | null {
  const weight = set.weight_value ?? prior?.weight_value ?? null;
  const reps = set.reps ?? prior?.reps ?? null;
  if (weight == null && reps == null) return null;
  const tidy = tidyWeight(weight, unit);
  let w: string | null;
  if (isBodyweight(exercise)) {
    w = tidy == null || tidy === 0 ? "BW" : formatSetWeight({ weight: null, weight_value: tidy }, "bodyweight", unitLabel(unit));
  } else {
    w = tidy == null ? null : formatSetWeight({ weight: null, weight_value: tidy }, "standard", unitLabel(unit));
  }
  if (w != null && reps != null) return `${w} × ${reps}`;
  if (w != null) return w;
  return repsText(reps as number);
}

/**
 * "Last time 85 × 8": the prior session's set at `index` (0-based, the
 * last prior set when this workout has more sets), without the unit, as
 * the set row's PREVIOUS column prints it. Null when there is no prior
 * session or that set has neither number.
 */
export function formatLastLine(
  prior: readonly { weight_value: number | null; reps: number | null }[],
  index: number,
  unit: WeightUnit,
): string | null {
  if (prior.length === 0) return null;
  const p = prior[Math.max(0, Math.min(index, prior.length - 1))];
  const w = tidyWeight(p.weight_value, unit);
  if (w != null && p.reps != null) return `Last time ${w} × ${p.reps}`;
  if (w != null) return `Last time ${w} ${unitLabel(unit)}`;
  if (p.reps != null) return `Last time ${repsText(p.reps)}`;
  return null;
}
