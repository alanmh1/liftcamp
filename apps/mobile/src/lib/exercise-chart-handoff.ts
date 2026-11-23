import type { ExerciseSession, WeightUnit } from '@liftcamp/shared';

/**
 * The exercise screen's sessions, handed to the fullscreen chart it opens
 * so that route draws at once without reading them again. One slot, in
 * memory: the latest exercise opened. A deep link, or a relaunch onto the
 * route, finds nothing here and the route reads for itself.
 */
type Handoff = { exerciseId: string; unit: WeightUnit; name: string; sessions: ExerciseSession[] };

let slot: Handoff | null = null;

export function handOffExerciseChart(handoff: Handoff): void {
  slot = handoff;
}

export function peekExerciseChart(exerciseId: string, unit: WeightUnit): Handoff | null {
  return slot && slot.exerciseId === exerciseId && slot.unit === unit ? slot : null;
}
