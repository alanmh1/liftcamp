import { loadRuleFor, type ProgressionExercise } from "./progression";
import type { WeightUnit } from "./units";

/**
 * Logging steps for the keypad's minus and plus buttons on a weight box,
 * in the user's unit. Free: this is the size of one tap, and nothing about
 * progression (no suggestion, no reason, no ladder) reaches the screen.
 *
 * Plate-loaded and stack equipment uses the load rule's step. Dumbbells and
 * kettlebells come in fixed sizes, so they get the smallest common jump
 * instead of the progression ladder: 2.5 lb dumbbells (1 kg in kg) and
 * 5 lb kettlebells (2 kg). Equipment with no step of its own keeps the
 * keypad's old 2.5.
 */
export const KEYPAD_STEPS = {
  dumbbell: { lb: 2.5, kg: 1 },
  kettlebell: { lb: 5, kg: 2 },
  fallback: { lb: 2.5, kg: 2.5 },
} as const;

/** The reps box always steps by one. */
export const KEYPAD_REPS_STEP = 1;

/** How far one tap on the keypad's minus or plus moves a weight box. */
export function keypadWeightStep(ex: ProgressionExercise, unit: WeightUnit): number {
  const rule = loadRuleFor(ex, unit);
  switch (rule.kind) {
    case "linear":
    case "bodyweight":
      return rule.step;
    case "sets":
      return rule.firstLoad;
    case "ladder":
      return (ex.equipment ?? "").trim().toLowerCase() === "kettlebells"
        ? KEYPAD_STEPS.kettlebell[unit]
        : KEYPAD_STEPS.dumbbell[unit];
    default:
      return KEYPAD_STEPS.fallback[unit];
  }
}
