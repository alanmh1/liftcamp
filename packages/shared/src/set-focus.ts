// The set a workout is "on", and that set as one line of text, for the Live
// Activity on the lock screen and in the Dynamic Island. Pure, no React.
//
// The workout screen has no current-set field: its active set is the first
// set of an exercise that is not done (exercise-card.tsx). This picks the
// exercise the same way the user moves through a workout, and the set the
// same way the card does.

import { formatBodyweight, isBodyweightLoad } from "./bodyweight-label";
import { formatCardioSet, isCardio } from "./cardio";
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

/**
 * The set a running rest leads to: the next set not done in the exercise
 * whose set started the rest; with none left there, the first set not done
 * in the next exercise by position after it, then in any exercise before
 * it. With no rest exercise (or one no longer in the workout), the first
 * set not done by position. Null when every set is done.
 */
export function upNextFocus<E extends FocusExercise>(
  workout: { exercises: readonly E[] },
  restExerciseId: string | null | undefined,
): SetFocus<E, E["sets"][number]> | null {
  const ordered = [...workout.exercises].sort((a, b) => a.position - b.position);
  const at = ordered.findIndex((e) => e.exercise.id === restExerciseId);
  const order = at === -1 ? ordered : [...ordered.slice(at), ...ordered.slice(0, at)];
  for (const exercise of order) {
    const i = exercise.sets.findIndex((s) => !s.completed);
    if (i !== -1) return { exercise, set: exercise.sets[i], setIndex: i + 1, setCount: exercise.sets.length };
  }
  return null;
}

function unitLabel(unit: WeightUnit): string {
  return unit === "kg" ? "kg" : "lbs";
}

type LineSet = {
  weight_value: number | null;
  reps: number | null;
  duration_seconds?: number | null;
  distance_meters?: number | null;
  incline_percent?: number | null;
};
type LineExercise = { weight_type?: string | null; equipment?: string | null; set_type?: string | null };

function repsText(reps: number): string {
  return reps === 1 ? "1 rep" : `${reps} reps`;
}

/**
 * The weight and reps as one line, shared by the set line and the last
 * line. A bodyweight exercise reads "BW", "BW +10 lbs" or "BW −20 lbs"
 * (formatBodyweight, which the Previous column uses too). Null when both
 * are empty.
 */
function setText(weight: number | null, reps: number | null, unit: WeightUnit, exercise: LineExercise): string | null {
  if (weight == null && reps == null) return null;
  const tidy = tidyWeight(weight, unit);
  let w: string | null;
  if (isBodyweightLoad(exercise)) {
    w = formatBodyweight(weight, unit, true);
  } else {
    w = tidy == null ? null : formatSetWeight({ weight: null, weight_value: tidy }, "standard", unitLabel(unit));
  }
  if (w != null && reps != null) return `${w} × ${reps}`;
  if (w != null) return w;
  return repsText(reps as number);
}

/**
 * One set as "90 lbs × 8", "BW × 12" or "BW +10 lbs × 6", and a cardio
 * set as "25:00 · 3.2 km" or "25:00 · 1.5 mi · 4%". A box left empty takes the prior session's set
 * at the same position, the way the set row's placeholders do. Null when
 * both are still empty.
 *
 * `prior` is that one prior set, already picked (priorSetForPosition), in
 * the user's unit like the set itself.
 */
export function formatSetLine(
  set: LineSet,
  prior: LineSet | null,
  unit: WeightUnit,
  exercise: LineExercise,
): string | null {
  if (isCardio(exercise)) {
    return formatCardioSet(
      {
        duration_seconds: set.duration_seconds ?? prior?.duration_seconds ?? null,
        distance_meters: set.distance_meters ?? prior?.distance_meters ?? null,
        incline_percent: set.incline_percent ?? prior?.incline_percent ?? null,
      },
      unit,
    );
  }
  return setText(set.weight_value ?? prior?.weight_value ?? null, set.reps ?? prior?.reps ?? null, unit, exercise);
}

/**
 * "Last time 85 lbs × 8", "Last time BW × 12": the prior session's set at
 * `index` (0-based; the last prior set when this workout has more sets),
 * worded as formatSetLine words a set. Null when there is no prior session
 * or that set has neither number. The set row's PREVIOUS column has its
 * own, shorter format.
 */
export function formatLastLine(
  prior: readonly LineSet[],
  index: number,
  unit: WeightUnit,
  exercise: LineExercise,
): string | null {
  if (prior.length === 0) return null;
  const p = prior[Math.max(0, Math.min(index, prior.length - 1))];
  const text = isCardio(exercise) ? formatCardioSet(p, unit) : setText(p.weight_value, p.reps, unit, exercise);
  return text == null ? null : `Last time ${text}`;
}

/**
 * Whether the set line says the same weight and reps as last time's set at
 * `index`, so the lock screen can leave off "Last time ..." beside it. An
 * empty box takes the prior value, as in formatSetLine, so an untouched set
 * repeats last time. False with no prior session or no set line.
 */
export function lastLineRepeats(
  set: LineSet | null,
  prior: readonly LineSet[],
  index: number,
  unit: WeightUnit,
  exercise: LineExercise,
): boolean {
  if (set == null || prior.length === 0) return false;
  const p = prior[Math.max(0, Math.min(index, prior.length - 1))];
  const setLine = formatSetLine(set, p, unit, exercise);
  const lastText = isCardio(exercise) ? formatCardioSet(p, unit) : setText(p.weight_value, p.reps, unit, exercise);
  return setLine != null && setLine === lastText;
}
