// What a finished workout tells the people who follow its owner: its volume
// and its PRs, worked out on the owner's phone at finish and written to the
// workout row (workouts.volume, volume_unit, pr_count, pr_exercise_ids).
//
// The phone, not the server, because both need what only the owner has:
// volume scores a bodyweight exercise with the owner's bodyweight, and a PR
// is measured against the owner's prior best on each exercise. The server
// stores the result, so a friend sees the numbers the owner's summary
// showed and never the bodyweight behind them.

import { oneRepMaxNumeric } from "./one-rep-max";
import { effectiveLoad, setVolume } from "./set-weight";
import type { WeightUnit } from "./units";
import { countedSets } from "./working-sets";

export type FinishSet = {
  id: string;
  completed: boolean;
  weight_value: number | null;
  reps: number | null;
  /** A warm-up ('warmup') never counts toward volume or PRs (working-sets.ts). */
  set_type?: string | null;
};

export type FinishExercise = {
  /** The workout_exercises row id. */
  id: string;
  exercise: { id?: string | null; weight_type?: string | null; is_unilateral?: boolean | null; equipment?: string | null };
  /** Best estimated 1RM before this workout; null when never logged. */
  priorBestOrm: number | null;
  /**
   * False when no read that sets `priorBestOrm` has answered: a start or an
   * added exercise with no signal, before the workout screen's server read
   * lands. A null there is then not "never logged". Missing means known
   * (a phone copy saved before the field existed).
   */
  baselineKnown?: boolean;
  sets: FinishSet[];
};

/**
 * The completed working sets of one exercise that are PRs, in one pass: a
 * set has to beat the prior best and every earlier counted set in this
 * workout. Warm-ups never count.
 * Without the running best, every set of a first-ever session would count.
 * The workout screen's ribbons and PR haptic ask the same question.
 */
export function exercisePrSetIds(
  sets: readonly FinishSet[],
  exercise: { weight_type?: string | null } | null | undefined,
  priorBestOrm: number | null,
  bodyweight: number | null,
): Set<string> {
  const prIds = new Set<string>();
  let best = priorBestOrm;
  for (const s of countedSets(sets)) {
    const load = effectiveLoad({ weight: null, weight_value: s.weight_value }, exercise, bodyweight);
    const orm = oneRepMaxNumeric(load, s.reps);
    if (orm == null) continue;
    if (best == null || orm > best) {
      prIds.add(s.id);
      best = orm;
    }
  }
  return prIds;
}

export type FinishStats = {
  /** Completed working sets through setVolume, the summary's number, in `volume_unit`. */
  volume: number;
  volume_unit: WeightUnit;
  /** PR sets. Null when the baselines were not all known. */
  pr_count: number | null;
  /** workout_exercises ids with a PR set. Null when the baselines were not all known. */
  pr_exercise_ids: string[] | null;
};

/**
 * The finish stats. `unit` is the unit the workout's weights are in on
 * the phone (the user's), and `bodyweight` the one the workout screen
 * scored with.
 *
 * When any exercise with a completed set has no known baseline (a start
 * with no signal that stayed offline, or an exercise whose baseline read
 * failed), the PRs are unknown, not none, and stay null so no card claims
 * a record. The volume needs no baseline and is always written.
 */
export function finishStats(input: {
  exercises: readonly FinishExercise[];
  bodyweight: number | null;
  unit: WeightUnit;
}): FinishStats {
  let volume = 0;
  for (const we of input.exercises) {
    for (const s of countedSets(we.sets)) {
      volume += setVolume({ weight: null, weight_value: s.weight_value, reps: s.reps }, we.exercise, input.bodyweight);
    }
  }
  volume = Math.round(volume * 100) / 100;

  const counted = input.exercises.filter((we) => countedSets(we.sets).length > 0);
  const known = counted.every((we) => we.baselineKnown !== false);
  if (!known) return { volume, volume_unit: input.unit, pr_count: null, pr_exercise_ids: null };

  let prCount = 0;
  const prExercises: string[] = [];
  for (const we of counted) {
    const ids = exercisePrSetIds(we.sets, we.exercise, we.priorBestOrm, input.bodyweight);
    prCount += ids.size;
    if (ids.size > 0) prExercises.push(we.id);
  }
  return { volume, volume_unit: input.unit, pr_count: prCount, pr_exercise_ids: prExercises };
}
