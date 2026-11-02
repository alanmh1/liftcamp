// Save as routine: the routine a finished workout becomes. Pure, no React,
// no Supabase.
//
// Each exercise keeps its place and becomes one routine day entry, with
// target sets from what was completed and target reps from what was most
// often done. Exercises with no completed set are left out: the routine is
// what was trained, not what was planned. Warm-up rows (Pro) are left out:
// they are generated again at each start.

import { countedSets } from "./working-sets";

export type RoutineSourceSet = {
  position: number;
  reps: number | null;
  completed: boolean;
  /** A warm-up row (Pro) is not a target set and has no vote on reps. */
  set_type?: string | null;
};

export type RoutineSourceExercise = {
  exerciseId: string;
  sets: readonly RoutineSourceSet[];
  /** A cardio exercise keeps its set count and gets no target reps. */
  cardio?: boolean;
};

/** One `template_exercises` row to write, in order. `targetReps` is text, as the column is. */
export type RoutineExercise = {
  exerciseId: string;
  targetSets: number;
  targetReps: string | null;
};

/**
 * The most common rep count among completed sets, with a tie going to the
 * count of the first completed set, in position order. Sets with no reps
 * logged (or zero) do not vote. Null when none has reps.
 */
export function modalReps(sets: readonly RoutineSourceSet[]): number | null {
  const done = countedSets(sets).sort((a, b) => a.position - b.position);
  const counts = new Map<number, number>();
  // Map keeps insertion order, so the first completed set's count is met first.
  for (const s of done) {
    if (s.reps == null || s.reps <= 0) continue;
    counts.set(s.reps, (counts.get(s.reps) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [reps, n] of counts) {
    if (n > bestCount) {
      best = reps;
      bestCount = n;
    }
  }
  return best;
}

/** The routine's exercises from a finished workout's, in the workout's order. */
export function routineFromWorkout(exercises: readonly RoutineSourceExercise[]): RoutineExercise[] {
  const out: RoutineExercise[] = [];
  for (const we of exercises) {
    const targetSets = countedSets(we.sets).length;
    if (targetSets === 0) continue;
    const reps = we.cardio ? null : modalReps(we.sets);
    out.push({ exerciseId: we.exerciseId, targetSets, targetReps: reps == null ? null : String(reps) });
  }
  return out;
}
