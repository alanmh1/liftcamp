// The routine detail's lines from the last time a saved day was done
// (docs/workout-tab-spec.md, Routine detail screen): the meta line under
// the name and each exercise's set scheme with its top weight. Each app
// reads the workout; this file only shapes it.

import { isCardio, workStat } from "./cardio";
import { formatDuration } from "./format-duration";
import { formatSetTarget } from "./templates";
import { tidyWeight, type WeightUnit } from "./units";

/** The latest finished workout started from a routine day, sets in the user's unit. */
export type RoutineLastDone = {
  workoutId: string;
  /** YYYY-MM-DD, local. */
  workoutDate: string;
  createdAt: string;
  finishedAt: string;
  /** Completed sets through `setVolume`, in the user's unit. */
  volume: number;
  cardioSeconds: number;
  /** The heaviest completed weight per exercise id, in the user's unit. */
  topWeights: Map<string, number>;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sat, Oct 17" from YYYY-MM-DD, read as a local calendar date. */
export function shortDateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(y, m - 1, d);
  return `${WEEKDAYS[day.getDay()]}, ${MONTHS[day.getMonth()]} ${day.getDate()}`;
}

/**
 * "Last done Sat, Oct 17 · 52 min · 7,820 lbs", or "Not done yet" with no
 * history. A workout with no volume shows its cardio time instead, and
 * one with neither shows the date and duration only.
 */
export function lastDoneDetailLine(last: RoutineLastDone | null, unitLabel: string): string {
  if (!last) return "Not done yet";
  const work =
    last.volume > 0 || last.cardioSeconds > 0 ? workStat(last.volume, last.cardioSeconds, unitLabel).value : null;
  return [`Last done ${shortDateLabel(last.workoutDate)}`, formatDuration(last.createdAt, last.finishedAt), work]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The heaviest completed weight per exercise, from sets already in the
 * user's unit. Weighted exercises only: a bodyweight exercise's number is
 * an assist or an addition, and cardio has none, so both are left out.
 */
export function topWeightsByExercise(
  exercises: readonly {
    exercise: { id: string; weight_type?: string | null; set_type?: string | null } | null;
    sets: readonly { weight_value: number | null; completed: boolean }[] | null;
  }[],
): Map<string, number> {
  const top = new Map<string, number>();
  for (const we of exercises) {
    const ex = we.exercise;
    if (!ex || isCardio(ex) || ex.weight_type === "bodyweight") continue;
    for (const s of we.sets ?? []) {
      if (!s.completed || s.weight_value == null || s.weight_value <= 0) continue;
      const prev = top.get(ex.id);
      if (prev == null || s.weight_value > prev) top.set(ex.id, s.weight_value);
    }
  }
  return top;
}

/**
 * An exercise row's line: "3 × 10 · 120 lbs last time". With no weight
 * from last time, the target alone; with no target, the weight alone.
 * Null when there is neither.
 */
export function routineExerciseLine(
  target: { sets: number | null; reps: string | null },
  topWeight: number | null | undefined,
  unit: WeightUnit,
  unitLabel: string,
): string | null {
  const scheme = formatSetTarget(target);
  const weight = topWeight != null ? `${tidyWeight(topWeight, unit)!.toLocaleString()} ${unitLabel} last time` : null;
  const parts = [scheme, weight].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
