import {
  coldStartSuggestion,
  placeholderSuggestions,
  setPlaceholders,
  type Progression,
  type SetPlaceholder,
} from '@liftcamp/shared';

import type { WorkoutExercise } from '@/data/workouts';

// The card's gray values, in a module of their own so lib/live-activity can
// read them without importing data/workouts (which imports live-activity).
// data/workouts re-exports both.

/** A no-equipment exercise: reps only, and its weight box reads "BW". */
export function isBodyOnly(exercise: { equipment: string | null }): boolean {
  return exercise.equipment === 'body only';
}

/**
 * The gray weight and reps each set of a card shows, and what its check
 * logs for a box left empty. Recomputed from the sets on every render, so
 * typing into set 1 moves the placeholders of the untouched sets below it.
 * Cold-start reps apply only to an exercise with no routine target.
 */
export function placeholdersFor(we: WorkoutExercise, progression?: Progression | null): SetPlaceholder[] {
  return setPlaceholders({
    sets: we.sets,
    prior: we.prior,
    // Pro only: null for everyone else, which leaves the free order as it was.
    suggested: progression ? placeholderSuggestions(progression) : null,
    targetReps: we.target?.reps ?? null,
    coldReps: we.target == null ? coldStartSuggestion(we.exercise).reps : null,
    repsOnly: isBodyOnly(we.exercise),
  });
}
