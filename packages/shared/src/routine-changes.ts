// Update routine: whether a workout started from a routine changed which
// exercises it holds, and the routine to write if so. Pure, no React, no
// Supabase.
//
// Only the exercises count. Order, set counts and rep counts change every
// session, so they never prompt on their own. An exercise in the workout
// with no completed set is still in the workout (a machine that was taken),
// so it is not a removal. A new exercise with no completed set was never
// trained and is left out, the way routineFromWorkout leaves it out.

import { routineFromWorkout, type RoutineSourceExercise } from "./routine-from-workout";

/** One `template_exercises` row, read or to write. Targets as the columns hold them. */
export type RoutineEntry = {
  exerciseId: string;
  targetSets: number | null;
  targetReps: string | null;
};

/**
 * The routine's exercises after this workout, in the workout's order, or
 * null when there is nothing to offer: the same set of exercise ids, or a
 * result with no exercises at all.
 *
 * - An exercise already in the routine keeps the routine's targets.
 * - A new exercise with completed sets gets routineFromWorkout's targets.
 * - A new exercise with no completed set is dropped.
 * - A routine exercise no longer in the workout is dropped.
 *
 * Duplicates: the routine's copies of one exercise are matched to the
 * workout's in order. A copy beyond the routine's count is treated as new,
 * and a routine copy with no partner in the workout is dropped. Neither
 * prompts on its own, since the set of ids is unchanged.
 */
export function routineChanges(
  routine: readonly RoutineEntry[],
  workout: readonly RoutineSourceExercise[],
): RoutineEntry[] | null {
  const routineIds = new Set(routine.map((e) => e.exerciseId));
  const workoutIds = new Set(workout.map((we) => we.exerciseId));

  // Targets per exercise id, queued in routine order for duplicates.
  const targets = new Map<string, RoutineEntry[]>();
  for (const e of routine) {
    const queue = targets.get(e.exerciseId) ?? [];
    queue.push(e);
    targets.set(e.exerciseId, queue);
  }

  const out: RoutineEntry[] = [];
  let added = false;
  for (const we of workout) {
    const kept = targets.get(we.exerciseId)?.shift();
    if (kept) {
      out.push({ exerciseId: we.exerciseId, targetSets: kept.targetSets, targetReps: kept.targetReps });
      continue;
    }
    const [fresh] = routineFromWorkout([we]);
    if (!fresh) continue;
    out.push(fresh);
    if (!routineIds.has(we.exerciseId)) added = true;
  }

  const removed = [...routineIds].some((id) => !workoutIds.has(id));
  if (!added && !removed) return null;
  return out.length > 0 ? out : null;
}
