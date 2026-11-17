// The warm-up sets calculator on /plate-calculator. It runs the app's own
// Pro warm-up rule (warmupSets in packages/shared/src/warmups.ts) for a
// barbell compound lift, so the web and the app always agree. Rounding uses
// the upper body barbell step, 5 lb or 2.5 kg, the finer of the two, since
// the page doesn't ask which lift.

import { warmupSets, type ProgressionExercise, type WeightUnit } from "@liftcamp/shared";

const BARBELL_LIFT: ProgressionExercise = {
  id: "web-warmup-calculator",
  equipment: "barbell",
  weight_type: "standard",
  mechanic: "compound",
  primary_muscle: "chest",
};

const STEP: Record<WeightUnit, number> = { lb: 5, kg: 2.5 };

export function barbellWarmups(
  working: number,
  unit: WeightUnit,
  bar: number,
): { weight: number; reps: number }[] {
  return warmupSets(
    { weight: working, reps: 8 },
    { kind: "linear", step: STEP[unit] },
    BARBELL_LIFT,
    unit,
    bar,
  ).flatMap((s) => (s.weight ? [{ weight: s.weight.value, reps: s.reps }] : []));
}
