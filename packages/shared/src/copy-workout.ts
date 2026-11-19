// Copy workout: what a friend's finished workout becomes when the viewer
// copies it, as a workout to start now or a routine to keep
// (docs/social-v1-spec.md, Branch 1). Pure, no React, no Supabase.
//
// Each exercise keeps its place, with as many working sets as the friend
// completed and their most common rep count as the target (modalReps, the
// rule Save routine uses). Their completed warm-ups come across as warm-ups
// on a start; a routine has no warm-up rows, so it leaves them out. No
// weights come across: a start fills them from the copier's own last
// session, the way a routine start does.
//
// A custom exercise is the friend's own row in `exercises`, which the
// copier cannot read, so it is skipped and counted for the sheet's note.
// Exercises with no completed working set are left out, as Save routine
// leaves them out.

import { modalReps } from "./routine-from-workout";
import { socialHandle } from "./social";
import { countedSets, isWarmupSet } from "./working-sets";

export type CopySourceSet = {
  position: number;
  reps: number | null;
  completed: boolean;
  set_type?: string | null;
  duration_seconds?: number | null;
  distance_meters?: number | null;
};

export type CopySourceExercise = {
  exerciseId: string;
  /** The friend's own exercise. Missing reads as a catalog exercise. */
  isCustom?: boolean | null;
  sets: readonly CopySourceSet[];
};

export type CopiedExercise = {
  exerciseId: string;
  /** Completed working sets. Always 1 or more. */
  workingSets: number;
  /** Completed warm-ups, for a start. A routine ignores them. */
  warmupSets: number;
  /** The most common rep count, as text like `template_exercises.target_reps`. Null for cardio. */
  targetReps: string | null;
};

export type CopyPlan = {
  exercises: CopiedExercise[];
  /** Custom exercises left out, for "1 custom exercise won't copy." */
  skippedCustom: number;
};

/**
 * A set logged as time or distance. social_workout carries no exercise
 * set_type, so a cardio exercise is told by its sets.
 */
export function isCardioSet(set: Pick<CopySourceSet, "duration_seconds" | "distance_meters">): boolean {
  return set.duration_seconds != null || set.distance_meters != null;
}

export function copyPlan(exercises: readonly CopySourceExercise[]): CopyPlan {
  const out: CopiedExercise[] = [];
  let skippedCustom = 0;
  for (const we of exercises) {
    const working = countedSets(we.sets);
    if (working.length === 0) continue;
    if (we.isCustom) {
      skippedCustom += 1;
      continue;
    }
    const cardio = we.sets.some(isCardioSet);
    const reps = cardio ? null : modalReps(we.sets);
    out.push({
      exerciseId: we.exerciseId,
      workingSets: working.length,
      warmupSets: we.sets.filter((s) => s.completed && isWarmupSet(s)).length,
      targetReps: reps == null ? null : String(reps),
    });
  }
  return { exercises: out, skippedCustom };
}

/** The sheet's note on skipped custom exercises, or null when none were. */
export function copySkippedLine(plan: CopyPlan): string | null {
  if (plan.skippedCustom === 0) return null;
  if (plan.exercises.length === 0) {
    return plan.skippedCustom === 1
      ? "This workout's only exercise is a custom one, so there's nothing to copy."
      : "Every exercise in this workout is a custom one, so there's nothing to copy.";
  }
  return plan.skippedCustom === 1
    ? "1 custom exercise won't copy."
    : `${plan.skippedCustom} custom exercises won't copy.`;
}

/** The longest routine name the app saves (SaveRoutineSheet's limit). */
export const COPY_NAME_MAX = 60;

/**
 * "Pull from @will", the routine's starting name, cut to COPY_NAME_MAX
 * keeping the handle. "from a friend" when the username is unknown.
 */
export function copyRoutineName(workoutName: string | null | undefined, username: string | null | undefined): string {
  const suffix = username ? ` from ${socialHandle(username)}` : " from a friend";
  const base = workoutName?.trim() || "Workout";
  if (base.length + suffix.length <= COPY_NAME_MAX) return base + suffix;
  const room = COPY_NAME_MAX - suffix.length;
  return room > 0 ? base.slice(0, room).trimEnd() + suffix : base.slice(0, COPY_NAME_MAX);
}
