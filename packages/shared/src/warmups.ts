import { barWeightFor } from "./plates";
import { roundToRule, type LoadRule, type ProgressionExercise, type SuggestedSet } from "./progression";
import type { WeightUnit } from "./units";

/**
 * Pro warm-up sets: the lighter sets ahead of a compound's working weight,
 * for users who do not log warm-ups of their own. `suggestProgression`
 * puts them in front of the working sets when the Warm-up sets setting is
 * on.
 *
 * By the working weight W:
 *
 * - On a bar (barbell, Smith machine, EZ bar): none at or under the empty
 *   bar; one set (50% × 8) up to twice the bar; two (50% × 6, 75% × 3)
 *   over twice; three (bar × 8, 55% × 5, 80% × 2) over three times.
 * - Dumbbells and kettlebells: none under 20 lb (10 kg), else 50% × 8.
 * - Machines and cables: 50% × 8.
 *
 * Isolation exercises, bodyweight and reps-only rules, timed and cardio get
 * none. Each weight is rounded onto the step or ladder, never under the
 * floor (`loadFloor`), and kept only while it stays under W and above the
 * warm-up before it.
 */

export const WARMUP_RULES = {
  /** Dumbbells and kettlebells under this get no warm-up. */
  dumbbellMin: { lb: 20, kg: 10 } as Record<WeightUnit, number>,
};

type Plan = { share: number; reps: number }[];

/** A share of 0 means the empty bar. */
const BAR_TIERS: { over: number; plan: Plan }[] = [
  { over: 3, plan: [{ share: 0, reps: 8 }, { share: 0.55, reps: 5 }, { share: 0.8, reps: 2 }] },
  { over: 2, plan: [{ share: 0.5, reps: 6 }, { share: 0.75, reps: 3 }] },
  { over: 1, plan: [{ share: 0.5, reps: 8 }] },
];

const ONE_SET: Plan = [{ share: 0.5, reps: 8 }];

const EPS = 0.01;

export function warmupSets(
  working: { weight: number; reps: number },
  rule: LoadRule,
  ex: ProgressionExercise,
  unit: WeightUnit,
  barWeight: number,
): SuggestedSet[] {
  if ((ex.mechanic ?? "").trim().toLowerCase() !== "compound") return [];
  if (rule.kind !== "linear" && rule.kind !== "ladder") return [];
  const w = working.weight;
  if (!(w > 0)) return [];

  const bar = barWeightFor(ex, unit, barWeight);
  const equipment = (ex.equipment ?? "").trim().toLowerCase();
  let plan: Plan;
  let floor: number;
  if (bar != null) {
    plan = BAR_TIERS.find((t) => w > t.over * bar + EPS)?.plan ?? [];
    floor = bar;
  } else if (rule.kind === "ladder") {
    plan = w < WARMUP_RULES.dumbbellMin[unit] - EPS ? [] : ONE_SET;
    floor = rule.ladder.values[0] ?? 0;
  } else if (equipment === "machine" || equipment === "cable") {
    plan = ONE_SET;
    floor = rule.step;
  } else {
    return [];
  }

  const out: SuggestedSet[] = [];
  let previous = 0;
  for (const step of plan) {
    const value = step.share === 0 ? floor : Math.max(floor, roundToRule(w * step.share, rule));
    if (value >= w - EPS || value <= previous + EPS) continue;
    out.push({
      position: out.length,
      role: "warmup",
      weight: { value, stored: null },
      reps: step.reps,
      last: null,
      generated: true,
    });
    previous = value;
  }
  return out;
}
