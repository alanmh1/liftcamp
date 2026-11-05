import { weightForReps } from "./one-rep-max";
import { barWeightFor } from "./plates";
import {
  classifySets,
  loadRuleFor,
  roundToRule,
  type HistorySession,
  type Ladder,
  type LoadRule,
  type ProgressionExercise,
} from "./progression";
import { standardThresholds } from "./strength-standards";
import { asWeightUnit, convertWeight, type WeightUnit } from "./units";

/**
 * Pro starting weights: a conservative working weight for the first session
 * of an exercise, where progression has no history to go on. Never free,
 * not even as a preview; `suggestProgression` calls it only when the input
 * carries `starting`, which callers pass behind `usePro`.
 *
 * Three sources, tried in order:
 *
 * 1. `standards`: the Novice threshold from the strength standards for the
 *    user's sex, bodyweight and age, as a 1RM, turned into a weight for the
 *    rep target with the Epley inverse, then 60% of that.
 * 2. `sibling`: 70% of the last working weight on a related lift the user
 *    has logged: same primary muscle, mechanic and equipment family.
 * 3. `floor`: the empty bar, the lightest dumbbell or kettlebell, or the
 *    lightest plate on the stack.
 *
 * Every weight is rounded onto the exercise's step or ladder and never
 * goes under the floor.
 */

export const STARTING_WEIGHT_RULES = {
  /** Share of the Novice working weight a starting weight takes. */
  standardsShare: 0.6,
  /** Share of a related lift's last working weight. */
  siblingShare: 0.7,
};

export type StartingWeightSource = "standards" | "sibling" | "floor";

/** Another exercise's finished sessions, newest first, for a related lift. */
export type SiblingHistory = {
  exercise: ProgressionExercise & { name: string };
  sessions: HistorySession[];
};

export type StartingWeightInput = {
  unit: WeightUnit;
  sex: string | null;
  bodyweightKg: number | null;
  age: number | null;
  /** The rep target: the routine's (low end of a range) or the cold-start reps. */
  reps: number;
  /** The set count: the routine's or the cold-start count. */
  sets: number;
  siblings: readonly SiblingHistory[];
  /** The bar weight setting, in `unit`. An EZ bar uses its own weight. */
  barWeight: number;
  dumbbellLadder?: Ladder;
};

export type StartingWeight = {
  /** In `unit`. */
  weight: number;
  reps: number;
  sets: number;
  source: StartingWeightSource;
  /** The related lift's name, for `sibling`. */
  siblingName?: string;
};

/** Equipment that loads the same way, for a related lift. */
export type EquipmentFamily = "bar" | "dumbbell" | "stack";

export function equipmentFamily(equipment: string | null): EquipmentFamily | null {
  switch ((equipment ?? "").trim().toLowerCase()) {
    case "barbell":
    case "smith machine":
    case "e-z curl bar":
      return "bar";
    case "dumbbell":
      return "dumbbell";
    case "cable":
    case "machine":
      return "stack";
    default:
      return null;
  }
}

/**
 * The lightest load an exercise takes, in `unit`: the empty bar (the EZ
 * bar's own weight for an EZ bar), the ladder's first value for dumbbells
 * and kettlebells, and one step for a machine or cable stack. Null for any
 * other rule.
 */
export function loadFloor(ex: ProgressionExercise, rule: LoadRule, unit: WeightUnit, barWeight: number): number | null {
  const bar = barWeightFor(ex, unit, barWeight);
  if (bar != null) return bar;
  if (rule.kind === "ladder") return rule.ladder.values[0] ?? null;
  if (rule.kind === "linear") return rule.step;
  return null;
}

/** The top working load of a sibling's newest session with one, in `unit`. */
function lastWorkingLoad(sessions: readonly HistorySession[], unit: WeightUnit): { load: number; date: string } | null {
  for (const session of sessions) {
    const kept = session.sets.filter((s) => s.reps != null && s.reps > 0 && s.weight_value != null);
    const loads = kept.map((s) => convertWeight(s.weight_value as number, asWeightUnit(s.weight_unit), unit));
    const roles = classifySets(kept.map((s, i) => ({ load: loads[i], set_type: s.set_type })));
    let top: number | null = null;
    loads.forEach((load, i) => {
      if (roles[i] === "working" && load > 0 && (top == null || load > top)) top = load;
    });
    if (top != null) return { load: top, date: session.date };
  }
  return null;
}

/** The related lift logged most recently, and its last working load. */
function closestSibling(
  ex: ProgressionExercise,
  input: StartingWeightInput,
): { name: string; load: number } | null {
  const family = equipmentFamily(ex.equipment);
  if (family == null || !ex.primary_muscle || !ex.mechanic) return null;
  let best: { name: string; load: number; date: string } | null = null;
  for (const s of input.siblings) {
    const other = s.exercise;
    if (other.id === ex.id) continue;
    if (other.primary_muscle !== ex.primary_muscle || other.mechanic !== ex.mechanic) continue;
    if (equipmentFamily(other.equipment) !== family) continue;
    const kind = loadRuleFor(other, input.unit, input.dumbbellLadder).kind;
    if (kind !== "linear" && kind !== "ladder") continue;
    const last = lastWorkingLoad(s.sessions, input.unit);
    if (last && (best == null || last.date > best.date)) best = { name: other.name, ...last };
  }
  return best && { name: best.name, load: best.load };
}

/**
 * The starting weight for a first session of `ex`, or null where there is
 * none: body only (reps only, as today), bodyweight-type, bands, balls,
 * "other", timed and cardio.
 */
export function startingWeight(ex: ProgressionExercise, input: StartingWeightInput): StartingWeight | null {
  const { unit, reps, sets } = input;
  const rule = loadRuleFor(ex, unit, input.dumbbellLadder);
  if (rule.kind !== "linear" && rule.kind !== "ladder") return null;
  if (!(reps > 0)) return null;
  const floor = loadFloor(ex, rule, unit, input.barWeight);
  if (floor == null) return null;
  const place = (value: number) => Math.max(floor, roundToRule(value, rule));

  const thresholds =
    input.bodyweightKg != null ? standardThresholds(ex.id, input.sex, input.bodyweightKg, input.age) : null;
  if (thresholds) {
    const noviceMax = convertWeight(thresholds[0], "kg", unit);
    const working = weightForReps(noviceMax, reps);
    if (working != null) {
      return { weight: place(working * STARTING_WEIGHT_RULES.standardsShare), reps, sets, source: "standards" };
    }
  }

  const sibling = closestSibling(ex, input);
  if (sibling) {
    return {
      weight: place(sibling.load * STARTING_WEIGHT_RULES.siblingShare),
      reps,
      sets,
      source: "sibling",
      siblingName: sibling.name,
    };
  }

  return { weight: floor, reps, sets, source: "floor" };
}
