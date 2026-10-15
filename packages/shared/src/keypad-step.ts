import { loadRuleFor, type ProgressionExercise } from "./progression";
import { tidyWeight, type WeightUnit } from "./units";

/**
 * Logging steps for the keypad's minus and plus buttons on a weight box,
 * in the user's unit. Free: this is the size of one tap, and nothing about
 * progression (no suggestion, no reason, no ladder) reaches the screen.
 *
 * The step is the smallest jump the equipment allows, not the progression
 * increment. Barbells, EZ bars and Smith machines step by the smallest
 * plate pair, 5 lb (2.5 kg), on every exercise, lower-body compounds
 * included. Machines, cables and bodyweight load use the load rule's step.
 * Dumbbells and kettlebells come in fixed sizes, so they get the smallest
 * common jump instead of the progression ladder: 2.5 lb dumbbells (1 kg in
 * kg) and 5 lb kettlebells (2 kg). Equipment with no step of its own keeps
 * the keypad's old 2.5.
 */
export const KEYPAD_STEPS = {
  barbell: { lb: 5, kg: 2.5 },
  dumbbell: { lb: 2.5, kg: 1 },
  kettlebell: { lb: 5, kg: 2 },
  fallback: { lb: 2.5, kg: 2.5 },
} as const;

/** Equipment loaded with plates on a bar. */
const BARBELLS: readonly string[] = ["barbell", "e-z curl bar", "smith machine"];

/** The reps box always steps by one. */
export const KEYPAD_REPS_STEP = 1;

/** How far one tap on the keypad's minus or plus moves a weight box. */
export function keypadWeightStep(ex: ProgressionExercise, unit: WeightUnit): number {
  const equipment = (ex.equipment ?? "").trim().toLowerCase();
  const rule = loadRuleFor(ex, unit);
  if (rule.kind === "linear" && BARBELLS.includes(equipment)) return KEYPAD_STEPS.barbell[unit];
  switch (rule.kind) {
    case "linear":
    case "bodyweight":
      return rule.step;
    case "sets":
      return rule.firstLoad;
    case "ladder":
      return equipment === "kettlebells"
        ? KEYPAD_STEPS.kettlebell[unit]
        : KEYPAD_STEPS.dumbbell[unit];
    default:
      return KEYPAD_STEPS.fallback[unit];
  }
}

/**
 * A weight box after one tap on minus or plus. An empty box steps from its
 * placeholder, the number the user can see, and from the value as the box
 * prints it, so a converted 102.058 steps to 104.6. Never below 0.
 *
 * The result is written exactly as a typed weight is (`weight_value`, with
 * `stored` cleared), so the boxes below fill from it the same way.
 */
export function steppedWeight(
  current: number | null,
  placeholder: number | null,
  delta: number,
  unit: WeightUnit,
): number {
  const next = Math.max(0, (tidyWeight(current ?? placeholder, unit) ?? 0) + delta);
  return Math.round(next * 100) / 100;
}
