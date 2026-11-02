import {
  coldStartSuggestion,
  isCardio,
  placeholderSuggestions,
  setPlaceholders,
  suggestProgression,
  workingSetCount,
  type Progression,
  type SetPlaceholder,
  type WeightUnit,
} from '@liftcamp/shared';

import type { WorkoutExercise } from '@/data/workouts';
import { proInputs } from '@/lib/pro-inputs';

// The card's gray values and the Pro progression behind them, in a module of
// their own so lib/live-activity can read them without importing
// data/workouts (which imports live-activity). data/workouts re-exports them.

/** Today on the phone's calendar, as YYYY-MM-DD. */
export function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Pro progression for a card: the weight and reps for each of its rows.
 * Null unless the gate is open (`useProgressionGate`), so nothing is
 * computed for a free user. Worked out from the history the workout read,
 * never from this workout's own sets.
 *
 * With the Pro inputs loaded (lib/pro-inputs.ts, in `unit`), an exercise
 * they list as new to the user gets a starting weight. A component that calls this subscribes
 * with `useProInputs` so it redraws when they land.
 */
export function progressionFor(we: WorkoutExercise, unit: WeightUnit, open: boolean): Progression | null {
  if (!open) return null;
  const pro = proInputs(null, unit);
  return suggestProgression({
    exercise: we.exercise,
    history: we.history ?? [],
    unit,
    target: we.target,
    // Generated warm-up rows are not counted: the engine puts its own
    // warm-ups ahead of this many working sets.
    setCount: workingSetCount(we.sets),
    today: todayIso(),
    ...(pro
      ? {
          // Only an exercise the loader saw with no history: until the
          // server's history read lands, every card looks like a first
          // session, and most are not.
          ...(pro.siblings.has(we.exercise.id)
            ? {
                starting: {
                  sex: pro.sex,
                  bodyweightKg: pro.bodyweightKg,
                  age: pro.age,
                  siblings: pro.siblings.get(we.exercise.id) ?? [],
                },
              }
            : {}),
          barWeight: pro.barWeight,
          ...(pro.warmups !== undefined ? { warmups: pro.warmups } : {}),
        }
      : {}),
  });
}

/** A no-equipment exercise: reps only, and its weight box reads "BW". */
export function isBodyOnly(exercise: { equipment: string | null }): boolean {
  return exercise.equipment === 'body only';
}

/**
 * The gray weight and reps (or, for cardio, time and distance) each set of
 * a card shows, and what its check logs for a box left empty. Recomputed
 * from the sets on every render, so
 * typing into set 1 moves the placeholders of the untouched sets below it.
 * Cold-start reps apply only to an exercise with no routine target.
 */
export function placeholdersFor(we: WorkoutExercise, progression?: Progression | null): SetPlaceholder[] {
  return setPlaceholders({
    sets: we.sets,
    prior: we.prior,
    // Pro only: null for everyone else, which leaves the free order as it was.
    // Matched to the rows by role, so generated warm-ups fill warm-up rows.
    suggested: progression ? placeholderSuggestions(progression, we.sets) : null,
    targetReps: we.target?.reps ?? null,
    coldReps: we.target == null ? coldStartSuggestion(we.exercise).reps : null,
    repsOnly: isBodyOnly(we.exercise),
    // Time and distance instead of weight and reps.
    cardio: isCardio(we.exercise),
  });
}

/**
 * The placeholder one row shows, worked out exactly as its card works out
 * every row: placeholdersFor with progressionFor behind the same gate. The
 * workout screen's tick and the Live Activity's up-next line both read it,
 * so neither can disagree with the row.
 */
export function placeholderAt(
  we: WorkoutExercise,
  index: number,
  unit: WeightUnit,
  progressionOpen: boolean,
): SetPlaceholder | null {
  return placeholdersFor(we, progressionFor(we, unit, progressionOpen))[index] ?? null;
}
