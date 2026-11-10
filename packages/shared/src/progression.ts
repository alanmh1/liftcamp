import { formatBodyweight, isBodyweightLoad } from "./bodyweight-label";
import { proseNumber } from "./copy-numbers";
import { targetSeconds } from "./set-placeholder";
import { isCardio } from "./cardio";
import { isTimedExercise } from "./set-weight";
import { startingWeight, type SiblingHistory, type StartingWeightSource } from "./starting-weight";
import { coldStartSuggestion } from "./suggestions";
import { warmupSets } from "./warmups";
import { BAR_WEIGHT_OPTIONS } from "./plates";
import {
  asWeightUnit,
  convertWeight,
  storedWeightOf,
  tidyWeight,
  type StoredWeight,
  type WeightUnit,
} from "./units";

/**
 * Progression guidance for Pro: the weight and reps to aim for on each set
 * of an exercise's next session, and a short reason ("Add 5 more lbs than last time").
 * The set rows and the "next time" block on the summary both read it.
 *
 * Pure: the caller passes the history, the routine's target, the unit and
 * today's date. Nothing here reads the clock or the network.
 *
 * Pro only, never a free preview: callers check `canShowProgression` before
 * computing or showing any of it. Nothing free changes; the Previous
 * column, the placeholders and the cold-start suggestion stay as they are.
 */

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export const PROGRESSION_RULES = {
  /** Misses in a row, at one working weight, before a deload. */
  deloadAfterMisses: 3,
  /** A deload goes to this share of the working weight, then to the step. */
  deloadFactor: 0.9,
  /** A set before the first top set and under this share of it is a warmup. */
  warmupShare: 0.9,
  /** More days than this since the last session holds everything. */
  layoffDays: 28,
  /** The range used when the routine has no rep target, or no routine. */
  defaultRange: { kind: "range", low: 8, high: 12 } as RepTarget,
  /** Body only, no load logged: sets go up one at a time to this, then load goes on. */
  bodyweightMaxSets: 5,
};

/** Two weights within this, in the user's unit, are the same weight. */
const EPS = 0.01;

/**
 * Weights a gym has, in order, for suggestions. Past the last value the
 * weights go up by `then`. Logging is unaffected: a user can log any weight,
 * and an off-ladder weight moves to the next ladder value above it.
 */
export type Ladder = { values: readonly number[]; then: number };

/** The default dumbbell ladder in lb, per dumbbell. */
export const DUMBBELL_LADDER_LB: Ladder = { values: [5, 8, 10, 12, 15, 20, 25], then: 5 };

/** For a gym with 2.5 lb dumbbell increments, once there is a setting for it. */
export const FINE_DUMBBELL_LADDER_LB: Ladder = {
  values: [5, 8, 10, 12, 15, 17.5, 20, 22.5, 25],
  then: 5,
};

export const DUMBBELL_LADDER_KG: Ladder = { values: [2, 4, 6, 8, 10, 12.5, 15], then: 2.5 };

export const KETTLEBELL_LADDER_LB: Ladder = {
  values: [10, 15, 20, 25, 30, 35, 40, 45, 50, 53, 62, 70],
  then: 10,
};

export const KETTLEBELL_LADDER_KG: Ladder = {
  values: [4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32],
  then: 4,
};

/**
 * How an exercise's load goes up.
 *
 * - `linear`: add `step` (barbell, machine, cable).
 * - `ladder`: the next weight on the ladder (dumbbell, kettlebell).
 * - `sets`: a body-only exercise with no load logged yet. Reps go up to
 *   the top of the range, then one set at a time up to
 *   `PROGRESSION_RULES.bodyweightMaxSets`, then `firstLoad` goes on in
 *   +LBS. Once any load (or assist) is logged it is `bodyweight`.
 * - `bodyweight`: the signed extra load of a bodyweight-type or body-only
 *   exercise. Added load goes up by `step`, assist comes down by `step`
 *   until it is gone, and bodyweight alone goes up to `step`.
 * - `reps`: the weight holds and reps go up to the top of the range
 *   (bands, balls, "other"), then it says what to change.
 * - `none`: no guidance (foam roll, timed, cardio, unknown equipment).
 */
export type LoadRule =
  | { kind: "linear"; step: number }
  | { kind: "ladder"; ladder: Ladder }
  | { kind: "sets"; firstLoad: number }
  | { kind: "bodyweight"; step: number }
  | { kind: "reps" }
  | { kind: "none" };

export type ProgressionExercise = {
  id: string;
  equipment: string | null;
  weight_type: string | null;
  mechanic: string | null;
  primary_muscle: string | null;
  is_unilateral?: boolean | null;
  set_type?: string | null;
  /** For the cold-start reps a starting weight falls back to. */
  level?: string | null;
};

/** Primary muscles that make a barbell compound a lower-body lift. */
const LOWER_BODY_MUSCLES: readonly string[] = ["quads", "glutes", "hamstrings", "lower back"];

function isLowerBodyCompound(ex: ProgressionExercise): boolean {
  return ex.mechanic === "compound" && LOWER_BODY_MUSCLES.includes(ex.primary_muscle ?? "");
}

/**
 * A no-equipment exercise, whatever its weight_type: its weight box reads
 * "BW" and takes added load under "+LBS". Equipment is the test because
 * the 240 body-only exercises marked `standard` log the same way as the
 * 11 marked `bodyweight`.
 */
function isBodyOnly(ex: { equipment: string | null }): boolean {
  return (ex.equipment ?? "").trim().toLowerCase() === "body only";
}

/** Whether any completed set in `history` carries load or assist. */
export function hasLoggedLoad(history: readonly HistorySession[]): boolean {
  return history.some((h) =>
    h.sets.some((s) => s.reps != null && s.reps > 0 && s.weight_value != null && Math.abs(s.weight_value) >= EPS),
  );
}

/**
 * The load rule for an exercise in the user's unit. `dumbbellLadder` is in
 * that unit too; it defaults to DUMBBELL_LADDER_LB or DUMBBELL_LADDER_KG.
 * A body-only exercise gets `sets` here; `suggestProgression` moves it to
 * `bodyweight` once its history has load in it.
 */
export function loadRuleFor(
  ex: ProgressionExercise,
  unit: WeightUnit,
  dumbbellLadder?: Ladder,
): LoadRule {
  const kg = unit === "kg";
  if (isTimedExercise(ex.id) || isCardio(ex)) return { kind: "none" };
  if (isBodyOnly(ex)) return { kind: "sets", firstLoad: kg ? 2.5 : 5 };
  if (ex.weight_type === "bodyweight") return { kind: "bodyweight", step: kg ? 2.5 : 5 };
  switch ((ex.equipment ?? "").trim().toLowerCase()) {
    case "barbell":
    case "e-z curl bar":
    case "smith machine":
      return isLowerBodyCompound(ex)
        ? { kind: "linear", step: kg ? 5 : 10 }
        : { kind: "linear", step: kg ? 2.5 : 5 };
    case "machine":
      return { kind: "linear", step: kg ? 5 : 10 };
    case "cable":
      return { kind: "linear", step: kg ? 2.5 : 5 };
    case "dumbbell":
      return { kind: "ladder", ladder: dumbbellLadder ?? (kg ? DUMBBELL_LADDER_KG : DUMBBELL_LADDER_LB) };
    case "kettlebells":
      return { kind: "ladder", ladder: kg ? KETTLEBELL_LADDER_KG : KETTLEBELL_LADDER_LB };
    case "bands":
    case "medicine ball":
    case "exercise ball":
    case "other":
      return { kind: "reps" };
    default:
      return { kind: "none" };
  }
}

// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------

/** Rounds to the nearest multiple of `step`, clear of float noise. */
export function snapToStep(value: number, step: number): number {
  return Math.round(Math.round(value / step) * step * 1000) / 1000;
}

/** The ladder's values up to the first one above `max`, continuing past its end. */
function ladderUpTo(ladder: Ladder, max: number): number[] {
  const out = [...ladder.values];
  let last = out[out.length - 1] ?? 0;
  while (last <= max + EPS) {
    last = Math.round((last + ladder.then) * 1000) / 1000;
    out.push(last);
  }
  return out;
}

/** The first ladder weight above `value`. 17.5 on the default lb ladder gives 20. */
export function nextOnLadder(value: number, ladder: Ladder): number {
  const above = ladderUpTo(ladder, value).find((v) => v > value + EPS);
  // ladderUpTo always ends above `value`.
  return above as number;
}

/**
 * A weight rounded onto the rule's loads: the nearest multiple of the step,
 * or the nearest ladder value (the lighter one on a tie). Other rules
 * return the value as it is.
 */
export function roundToRule(value: number, rule: LoadRule): number {
  if (rule.kind === "linear") return snapToStep(value, rule.step);
  if (rule.kind !== "ladder") return value;
  let best = rule.ladder.values[0] ?? value;
  for (const v of ladderUpTo(rule.ladder, value)) {
    if (Math.abs(v - value) < Math.abs(best - value) - EPS) best = v;
  }
  return best;
}

/** The ladder weight below `value` nearest `target`, or `value` at the bottom. */
function lowerOnLadder(value: number, target: number, ladder: Ladder): number {
  const below = ladderUpTo(ladder, value).filter((v) => v < value - EPS);
  if (below.length === 0) return value;
  let best = below[0];
  for (const v of below) if (Math.abs(v - target) <= Math.abs(best - target)) best = v;
  return best;
}

// ---------------------------------------------------------------------------
// Rep targets
// ---------------------------------------------------------------------------

export type RepTarget =
  | { kind: "range"; low: number; high: number }
  | { kind: "fixed"; reps: number }
  | { kind: "timed" };

/**
 * A routine's free-text target reps. "8-10" and "10-12 each" are ranges,
 * "5" and "8 each" are fixed, "30s" and "45 sec" are timed (the same test
 * `targetRepsNumber` uses), and anything else is null.
 */
export function parseRepTarget(text: string | null | undefined): RepTarget | null {
  const t = text?.trim().toLowerCase();
  if (!t) return null;
  if (/\d\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)\b/.test(t)) return { kind: "timed" };
  const range = /^(\d+)\s*-\s*(\d+)/.exec(t);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (a <= 0 || b <= 0) return null;
    return { kind: "range", low: Math.min(a, b), high: Math.max(a, b) };
  }
  const fixed = /^(\d+)/.exec(t);
  if (fixed) {
    const n = Number(fixed[1]);
    return n > 0 ? { kind: "fixed", reps: n } : null;
  }
  return null;
}

type Range = { low: number; high: number };

/** The rep range progression works within: a fixed target is a range of one. */
export type RepRange = Range;

function toRange(target: RepTarget): Range {
  if (target.kind === "fixed") return { low: target.reps, high: target.reps };
  if (target.kind === "range") return { low: target.low, high: target.high };
  return toRange(PROGRESSION_RULES.defaultRange);
}

// ---------------------------------------------------------------------------
// Sets and sessions
// ---------------------------------------------------------------------------

/**
 * The set types `sets.set_type` holds. Null is untyped, and `classifySets`
 * falls back to load. The app saves two: `warmup` on a generated warm-up
 * row or one the user marked, and `normal` on a row the user marked as a
 * working set.
 */
export type SetType = "warmup" | "normal" | "drop" | "failure";

/** What a set counts as. Drop sets take no part in progression or misses. */
export type SetRole = "warmup" | "working" | "drop";

/** One completed set, as `normalizePriorSets` returns it. */
export type HistorySet = {
  weight_value: number | null;
  /** The unit the set was logged in; lb when missing. */
  weight_unit?: string | null;
  reps: number | null;
  set_type?: SetType | null;
};

/** One finished workout's completed sets for the exercise, in order. */
export type HistorySession = {
  workoutId: string;
  date: string;
  sets: HistorySet[];
  /**
   * Rows the session had for the exercise, ticked or not, counted only in
   * rows with at least one ticked set. More rows than ticked sets means the
   * session was cut short, even without a routine target. Missing on
   * history saved before it existed.
   */
  plannedSets?: number;
};

/**
 * Each set's role. A typed set keeps its type: warmup, drop, and working
 * for normal and failure. An untyped set is a warmup when it comes before
 * the first set at the session's top load and is under 90% of it; lighter
 * sets after the top set are back-off sets and work. With no positive load
 * (bodyweight, assist) every untyped set works.
 *
 * `load` is in the user's unit.
 */
export function classifySets(
  sets: readonly { load: number | null; set_type?: SetType | null }[],
): SetRole[] {
  const typed = (t: SetType | null | undefined): SetRole | null =>
    t === "warmup" ? "warmup" : t === "drop" ? "drop" : t ? "working" : null;

  const eligible = sets.map((s) => typed(s.set_type) !== "warmup" && typed(s.set_type) !== "drop");
  let top = -Infinity;
  sets.forEach((s, i) => {
    if (eligible[i] && s.load != null && s.load > top) top = s.load;
  });
  const firstTop = top > 0 ? sets.findIndex((s, i) => eligible[i] && s.load != null && s.load >= top - EPS) : -1;

  return sets.map((s, i) => {
    const t = typed(s.set_type);
    if (t) return t;
    if (firstTop >= 0 && i < firstTop && s.load != null && s.load < PROGRESSION_RULES.warmupShare * top - EPS) {
      return "warmup";
    }
    return "working";
  });
}

/** A set read for progression: its load in the user's unit, and as stored. */
type ReadSet = {
  load: number | null;
  reps: number;
  role: SetRole;
  /** The weight as logged, when that was in the other unit. */
  stored: StoredWeight | null;
};

type ReadSession = {
  session: HistorySession;
  sets: ReadSet[];
  working: ReadSet[];
  /** The heaviest working load, or null when no working set has one. */
  top: number | null;
};

/**
 * `bodyLoad`: an empty weight is bodyweight alone, so it counts as 0 for
 * the top load. The sets keep their null so a held suggestion matches what
 * the empty box logs.
 */
function readSession(session: HistorySession, unit: WeightUnit, needsLoad: boolean, bodyLoad = false): ReadSession {
  const kept = session.sets.filter(
    (s) => s.reps != null && s.reps > 0 && (!needsLoad || s.weight_value != null),
  );
  const loads = kept.map((s) =>
    s.weight_value == null ? null : convertWeight(s.weight_value, asWeightUnit(s.weight_unit), unit),
  );
  const roles = classifySets(kept.map((s, i) => ({ load: loads[i], set_type: s.set_type })));
  const sets: ReadSet[] = kept.map((s, i) => ({
    load: loads[i],
    reps: s.reps as number,
    role: roles[i],
    stored: storedWeightOf(s.weight_value, s.weight_unit, unit),
  }));
  const working = sets.filter((s) => s.role === "working");
  let top: number | null = null;
  for (const s of working) {
    const load = s.load ?? (bodyLoad ? 0 : null);
    if (load != null && (top == null || load > top)) top = load;
  }
  return { session, sets, working, top };
}

export type SessionResult = "top" | "in-range" | "miss" | "incomplete";

/**
 * How a session went against the range. Fewer working sets than expected
 * (the routine's target sets, or else the session before) is incomplete:
 * no increase, and not a miss. Otherwise every set at the top of the range
 * is `top`, any set under the bottom is `miss`, and the rest is `in-range`.
 *
 * With `repTrigger` (the Pro "Move up when I hit N+ reps" setting) only the
 * first working set counts, and the range and expected sets are ignored:
 * at or above the trigger is `top`, anything below is `in-range`. It never
 * gives `miss` or `incomplete`, so the later sets cannot block a bump.
 */
export function sessionResult(
  working: readonly { reps: number }[],
  range: Range,
  expectedSets = 0,
  repTrigger: number | null = null,
): SessionResult {
  if (repTrigger != null) {
    if (working.length === 0) return "incomplete";
    return working[0].reps >= repTrigger ? "top" : "in-range";
  }
  if (working.length === 0 || working.length < expectedSets) return "incomplete";
  if (working.every((s) => s.reps >= range.high)) return "top";
  if (working.some((s) => s.reps < range.low)) return "miss";
  return "in-range";
}

function sameLoad(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return a == null && b == null;
  return Math.abs(a - b) < EPS;
}

// ---------------------------------------------------------------------------
// Suggestion
// ---------------------------------------------------------------------------

export type ProgressionInput = {
  /** Null when the exercise row is not loaded (offline, missing). */
  exercise: ProgressionExercise | null;
  /** Finished sessions, newest first, never the workout in progress. */
  history: HistorySession[];
  unit: WeightUnit;
  /** The routine's target for this exercise, or null. */
  target: { sets: number | null; reps: string | null } | null;
  /** Rows the card will show. 0 means as many as last time. */
  setCount: number;
  /** Today, as YYYY-MM-DD. */
  today: string;
  /** In the user's unit. Defaults to the standard dumbbell ladder. */
  dumbbellLadder?: Ladder;
  /**
   * What a Pro starting weight is built from. Without it a first session
   * returns no sets, as before.
   */
  starting?: {
    /** `male` or `female` for the strength standards; anything else skips them. */
    sex: string | null;
    bodyweightKg: number | null;
    age: number | null;
    /** History of other exercises, for a related lift. Filtered here, so callers can pass more. */
    siblings: readonly SiblingHistory[];
  };
  /**
   * The Warm-up sets setting. True generates warm-up sets ahead of the
   * working sets; false generates none. Either way warm-ups saved typed
   * (generated last time) are left out of history and never repeated.
   * Missing keeps the old behaviour.
   */
  warmups?: boolean;
  /** The bar weight setting, in `unit` (`barWeight` in plates.ts). Defaults to 45 lb or 20 kg. */
  barWeight?: number;
  /**
   * Pro "Move up when I hit N+ reps" (`user_profiles.progression_rep_trigger`).
   * Set, it replaces the routine's rep target for every loaded exercise:
   * the first working set last time at or above it moves every working
   * set up a step, below it holds, and each set aims for last time's reps.
   * Low reps never lower the weight: the deload after missed sessions is
   * off. Null or missing is the double progression, unchanged.
   */
  repTrigger?: number | null;
};

export type SuggestedSet = {
  position: number;
  role: SetRole;
  /** Null for reps only. `stored` is set when the weight is held from a set logged in the other unit. */
  weight: { value: number; stored: StoredWeight | null } | null;
  reps: number;
  /** The same set number last session, for the sheet's table. Null past its end. */
  last: { weight: { value: number; stored: StoredWeight | null } | null; reps: number } | null;
  /** A warm-up the engine made (`warmupSets`), not one repeated from history. Its tick saves `set_type` warmup. */
  generated?: true;
};

export type ProgressionOutcome =
  | "increase"
  | "add-reps"
  | "add-set"
  | "hold"
  | "deload"
  | "first-session"
  | "unsupported";

/**
 * Why the engine chose what it did, for the chip and the sheet.
 *
 * - `increase`: every working set reached the top of the range.
 * - `beat-reps`: same weight, one more rep per set within the range.
 * - `bodyweight-reps`: body only, one more rep per set up to the top.
 * - `add-set`: body only, every set at the top; one more set at the top.
 * - `add-load`: body only, five sets at the top; the first added load.
 * - `missed`: a set fell short of the bottom; hold and aim for it.
 * - `partial`: last session was cut short; repeat it.
 * - `layoff`: more than four weeks off; repeat the last session.
 * - `deload`: three misses in a row at one weight; lighter.
 * - `top-of-range`: a band, ball or "other" at the top with nothing to add.
 * - `starting-weight`: a first session, from `startingWeight` (Pro).
 * - `below-trigger`: rep trigger set, first working set under it; hold.
 */
export type ProgressionWhy =
  | "increase"
  | "beat-reps"
  | "bodyweight-reps"
  | "add-set"
  | "add-load"
  | "missed"
  | "partial"
  | "layoff"
  | "deload"
  | "top-of-range"
  | "starting-weight"
  | "below-trigger";

export type ProgressionDetail = {
  why: ProgressionWhy;
  rule: LoadRule["kind"];
  range: RepRange;
  /** Weeks since the last session, for a layoff. */
  weeksOff: number | null;
  /** Working sets in the session the suggestion is built on. */
  lastWorkingSets: number;
  /** Starting weight only: where the weight came from. */
  source?: StartingWeightSource;
  /** Starting weight from a related lift only: that lift's name. */
  siblingName?: string;
  /** Rep trigger only: the setting, and the first working set's reps last time. */
  repTrigger?: number;
  firstSetReps?: number;
};

export type Progression = {
  outcome: ProgressionOutcome;
  /** Empty for unsupported, and for first-session without a starting weight. */
  sets: SuggestedSet[];
  /** Short, lower case, no unit unless the last session was in the other one. Empty when there are no sets. */
  reason: string;
  /** Misses in a row at the last working weight. */
  missStreak: number;
  basis: { workoutId: string; date: string } | null;
  /** Null for unsupported, and for first-session without a starting weight. */
  detail: ProgressionDetail | null;
};

const EMPTY = { sets: [], reason: "", missStreak: 0, basis: null, detail: null };

/** Whether progression may be computed or shown. Pro only, behind the flag. */
export function canShowProgression(gate: { flagOn: boolean; isPro: boolean }): boolean {
  return gate.flagOn && gate.isPro;
}

function unitLabel(unit: WeightUnit): string {
  return unit === "kg" ? "kg" : "lbs";
}

function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function daysBetween(from: string, to: string): number | null {
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(from);
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(to);
  if (!a || !b) return null;
  const ms = (m: RegExpExecArray) => Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.round((ms(b) - ms(a)) / 86_400_000);
}

/**
 * A capped reps-only exercise at the top of its range holds, and says what
 * to change instead, since there is no weight to add.
 */
function topOfRangeReason(equipment: string | null): string {
  switch ((equipment ?? "").trim().toLowerCase()) {
    case "bands":
      return "Top of range. Try a harder band";
    case "medicine ball":
      return "Top of range. Try a heavier ball";
    default:
      return "Top of range. Try a harder variation";
  }
}

/** The next multiple of `step` a step above `load`, always above it. */
function snapUp(load: number, step: number): number {
  const v = snapToStep(load + step, step);
  return v <= load + EPS ? snapToStep(v + step, step) : v;
}

/**
 * One step up from a weight the user logged. A load on the half step is a
 * real plate load and keeps its offset: 135 lb with a step of 10 gives 145,
 * since snapping would make that a jump of 15. Anything else lands back on
 * the step: 77.3 kg with a step of 2.5 gives 80.
 */
function stepUp(load: number, step: number): number {
  const onHalfStep = Math.abs(snapToStep(load, step / 2) - load) < EPS;
  return onHalfStep ? load + step : snapUp(load, step);
}

/** `stepUp` going down: 7.3 with a step of 2.5 gives 5. */
function stepDown(load: number, step: number): number {
  return -stepUp(-load, step);
}

/**
 * The load one step up, or null when the set has no load to raise. A
 * bodyweight set with nothing in the box is bodyweight alone, load 0.
 */
function raise(set: ReadSet, rule: LoadRule): number | null {
  const load = set.load ?? (rule.kind === "bodyweight" ? 0 : null);
  if (load == null) return null;
  switch (rule.kind) {
    case "linear":
      // A weight logged in the other unit always lands on this unit's step.
      return set.stored == null ? stepUp(load, rule.step) : snapUp(load, rule.step);
    case "ladder":
      return nextOnLadder(load, rule.ladder);
    case "bodyweight":
      return load < 0 ? Math.min(stepUp(load, rule.step), 0) : stepUp(load, rule.step);
    default:
      return null;
  }
}

/** The deload weight, or the set's own load when it cannot go lower. */
function lower(set: ReadSet, rule: LoadRule): number | null {
  if (set.load == null) return null;
  const target = set.load * PROGRESSION_RULES.deloadFactor;
  switch (rule.kind) {
    case "linear": {
      const v = Math.min(snapToStep(target, rule.step), stepDown(set.load, rule.step));
      return v > 0 ? v : set.load;
    }
    case "ladder":
      return lowerOnLadder(set.load, target, rule.ladder);
    case "bodyweight":
      if (Math.abs(set.load) < EPS) return set.load;
      return set.load < 0 ? stepDown(set.load, rule.step) : Math.max(stepDown(set.load, rule.step), 0);
    default:
      return set.load;
  }
}

/** A suggested set before `last` is attached. */
type Planned = Omit<SuggestedSet, "last">;

function held(set: ReadSet, position: number, reps: number, repsOnly: boolean): Planned {
  return {
    position,
    role: set.role,
    weight: repsOnly || set.load == null ? null : { value: set.load, stored: set.stored },
    reps,
  };
}

function moved(set: ReadSet, position: number, value: number, reps: number): Planned {
  return { position, role: set.role, weight: { value, stored: null }, reps };
}

/**
 * The next session of an exercise, set by set.
 *
 * Double progression: when every working set reaches the top of the range,
 * each working set's weight goes up one step and its reps go back to the
 * bottom. Otherwise the weight holds and each set aims for one more rep
 * than last time, within the range. A fixed target is a range of one.
 * After three misses in a row at one working weight, the weight drops to
 * about 90% and reps go to the bottom. Warmup and drop sets repeat as they
 * were. Positions past the end of last session repeat its last set.
 *
 * A body-only exercise with no load logged climbs its own ladder (`sets`):
 * one more rep per set up to the top of the range; with every set at the
 * top, one more set at the top, up to five; with five at the top, the
 * first added load. Logged load switches it to double progression on that
 * load. A timed target gets nothing.
 */
export function suggestProgression(input: ProgressionInput): Progression {
  if (input.warmups === undefined) return progressionFrom(input);
  // Warm-ups saved typed were generated, so they are made again for today's
  // weight (or left off), never repeated.
  const history = input.history.map((h) => ({ ...h, sets: h.sets.filter((s) => s.set_type !== "warmup") }));
  const p = progressionFrom({ ...input, history });
  if (!input.warmups || !input.exercise) return p;
  // Warm-ups the user does on their own come back as warmup rows; keep theirs.
  if (p.sets.some((s) => s.role === "warmup")) return p;
  const working = p.sets.filter((s) => s.role === "working" && s.weight != null);
  if (working.length === 0) return p;
  const top = working.reduce((a, b) => ((b.weight as { value: number }).value > (a.weight as { value: number }).value ? b : a));
  const rule = loadRuleFor(input.exercise, input.unit, input.dumbbellLadder);
  const bar = input.barWeight ?? BAR_WEIGHT_OPTIONS[input.unit][0];
  const warmups = warmupSets({ weight: (top.weight as { value: number }).value, reps: top.reps }, rule, input.exercise, input.unit, bar);
  if (warmups.length === 0) return p;
  return { ...p, sets: [...warmups, ...p.sets].map((s, i) => ({ ...s, position: i })) };
}

/** A first session's sets from `startingWeight`, or nothing without it. */
function firstSession(input: ProgressionInput, exercise: ProgressionExercise, rule: LoadRule, range: Range): Progression {
  if (!input.starting) return { outcome: "first-session", ...EMPTY };
  const parsed = parseRepTarget(input.target?.reps);
  const cold = coldStartSuggestion(exercise);
  const reps = parsed?.kind === "range" ? parsed.low : parsed?.kind === "fixed" ? parsed.reps : cold.reps;
  const targetSets = input.target?.sets != null && input.target.sets > 0 ? input.target.sets : cold.sets;
  const start = startingWeight(exercise, {
    unit: input.unit,
    sex: input.starting.sex,
    bodyweightKg: input.starting.bodyweightKg,
    age: input.starting.age,
    reps,
    sets: targetSets,
    siblings: input.starting.siblings,
    barWeight: input.barWeight ?? BAR_WEIGHT_OPTIONS[input.unit][0],
    dumbbellLadder: input.dumbbellLadder,
  });
  if (!start) return { outcome: "first-session", ...EMPTY };
  const count = input.setCount > 0 ? input.setCount : start.sets;
  return {
    outcome: "first-session",
    sets: Array.from({ length: count }, (_, position) => ({
      position,
      role: "working",
      weight: { value: start.weight, stored: null },
      reps: start.reps,
      last: null,
    })),
    reason: startingReason(start.source, start.siblingName, exercise, start.reps).toLowerCase(),
    missStreak: 0,
    basis: null,
    detail: {
      why: "starting-weight",
      rule: rule.kind,
      range,
      weeksOff: null,
      lastWorkingSets: 0,
      source: start.source,
      ...(start.siblingName ? { siblingName: start.siblingName } : {}),
    },
  };
}

/**
 * Where a starting weight came from, as the chip and the sheet say it:
 * "From your strength level", "From your bench press", "Empty bar, add
 * weight when 10 feel easy".
 */
export function startingReason(
  source: StartingWeightSource,
  siblingName: string | undefined,
  exercise: { equipment: string | null },
  reps: number,
): string {
  if (source === "standards") return "From your strength level";
  if (source === "sibling" && siblingName) return `From your ${siblingName.toLowerCase()}`;
  const when = `add weight when ${reps} feel easy`;
  switch ((exercise.equipment ?? "").trim().toLowerCase()) {
    case "dumbbell":
      return `Lightest dumbbells, ${when}`;
    case "kettlebells":
      return `Lightest kettlebell, ${when}`;
    case "machine":
    case "cable":
      return `Lightest plate on the stack, ${when}`;
    default:
      return `Empty bar, ${when}`;
  }
}

function progressionFrom(input: ProgressionInput): Progression {
  const { exercise, unit } = input;
  if (!exercise) return { outcome: "unsupported", ...EMPTY };
  const parsed = parseRepTarget(input.target?.reps);
  if (parsed?.kind === "timed" || targetSeconds(input.target?.reps) != null) {
    return { outcome: "unsupported", ...EMPTY };
  }
  let rule = loadRuleFor(exercise, unit, input.dumbbellLadder);
  if (rule.kind === "none") return { outcome: "unsupported", ...EMPTY };
  if (rule.kind === "sets" && hasLoggedLoad(input.history)) rule = { kind: "bodyweight", step: rule.firstLoad };

  const range = toRange(parsed ?? PROGRESSION_RULES.defaultRange);
  // The rep trigger needs a load to raise; body-only reps-and-sets and the
  // reps-only rules keep their own ladders.
  const trigger =
    input.repTrigger != null && (rule.kind === "linear" || rule.kind === "ladder" || rule.kind === "bodyweight")
      ? input.repTrigger
      : null;
  const needsLoad = rule.kind === "linear" || rule.kind === "ladder";
  const bodyLoad = rule.kind === "bodyweight";
  const sessions = input.history
    .map((s) => readSession(s, unit, needsLoad, bodyLoad))
    .filter((s) => s.working.length > 0);
  if (sessions.length === 0) return firstSession(input, exercise, rule, range);

  const last = sessions[0];
  const basis = { workoutId: last.session.workoutId, date: last.session.date };
  const count = input.setCount > 0 ? input.setCount : last.sets.length;
  const at = (i: number) => last.sets[Math.min(i, last.sets.length - 1)];
  const positions = Array.from({ length: count }, (_, i) => i);
  const repsOnly = rule.kind === "sets";
  const targetSets = input.target?.sets != null && input.target.sets > 0 ? input.target.sets : null;
  const expected = (i: number) => targetSets ?? sessions[i + 1]?.working.length ?? 0;
  const days = daysBetween(last.session.date, input.today);
  const weeksOff = days != null && days > PROGRESSION_RULES.layoffDays ? Math.round(days / 7) : null;

  /** Attaches last session's set to each row and the detail to the result. */
  const finish = (
    outcome: ProgressionOutcome,
    planned: Planned[],
    reason: string,
    why: ProgressionWhy,
    missStreak = 0,
  ): Progression => ({
    outcome,
    sets: planned.map((p) => {
      const s = p.position < last.sets.length ? last.sets[p.position] : null;
      return {
        ...p,
        last: s
          ? { weight: repsOnly || s.load == null ? null : { value: s.load, stored: s.stored }, reps: s.reps }
          : null,
      };
    }),
    reason,
    missStreak,
    basis,
    detail: {
      why,
      rule: rule.kind,
      range,
      weeksOff: why === "layoff" ? weeksOff : null,
      lastWorkingSets: last.working.length,
      ...(trigger != null ? { repTrigger: trigger, firstSetReps: last.working[0].reps } : {}),
    },
  });

  const sameAsLast = (reason: string, why: ProgressionWhy): Progression =>
    finish(
      "hold",
      positions.map((i) => held(at(i), i, at(i).reps, repsOnly)),
      reason,
      why,
    );

  if (weeksOff != null) {
    return sameAsLast(`same as last time, ${weeksOff} weeks off`, "layoff");
  }

  // The same number of working sets in a session and the one before it is
  // the user's normal, so that count is what's expected, over the routine's
  // target and any rows left unticked: 2 of 3 twice running is not partial.
  // Otherwise a session with rows left unticked was cut short, whatever
  // the target.
  const resultAt = (i: number): SessionResult => {
    const { working, session } = sessions[i];
    const before = sessions[i + 1];
    if (before && working.length === before.working.length) {
      return sessionResult(working, range, working.length);
    }
    if (session.plannedSets != null && session.plannedSets > session.sets.length) return "incomplete";
    return sessionResult(working, range, expected(i));
  };
  const result = resultAt(0);
  const nextReps = (reps: number) => Math.min(Math.max(reps + 1, range.low), range.high);

  if (rule.kind === "sets") {
    const high = range.high;
    const done = last.working.length;
    if (!last.working.every((s) => s.reps >= high)) {
      return finish(
        "add-reps",
        positions.map((i) => {
          const s = at(i);
          return held(s, i, s.role === "working" ? Math.max(Math.min(s.reps + 1, high), s.reps) : s.reps, true);
        }),
        "beat last time's reps",
        "bodyweight-reps",
      );
    }
    const atTop = (count: number, weight: Planned["weight"], reps: number): Planned[] =>
      Array.from({ length: count }, (_, i) => ({ position: i, role: "working", weight, reps }));
    if (done < PROGRESSION_RULES.bodyweightMaxSets) {
      return finish("add-set", atTop(done + 1, null, high), `add a set at ${high}`, "add-set");
    }
    return finish(
      "increase",
      atTop(done, { value: rule.firstLoad, stored: null }, range.low),
      `add ${formatNumber(rule.firstLoad)} ${unitLabel(unit)}`,
      "add-load",
    );
  }

  if (rule.kind === "reps") {
    if (result === "incomplete") return sameAsLast("same as last time", "partial");
    if (result === "top") return sameAsLast(topOfRangeReason(exercise.equipment), "top-of-range");
    return finish(
      "add-reps",
      positions.map((i) => held(at(i), i, at(i).role === "working" ? nextReps(at(i).reps) : at(i).reps, false)),
      "same weight, beat last time's reps",
      "beat-reps",
    );
  }

  // With the rep trigger, a short session can still move up.
  if (trigger == null && result === "incomplete") return sameAsLast("same as last time", "partial");

  // A partial session at the same weight is neutral: it neither counts as a
  // miss nor breaks the streak. With the rep trigger there is no rep-based
  // deload: low reps on any set never lower the weight.
  let missStreak = 0;
  for (let i = 0; trigger == null && i < sessions.length; i += 1) {
    if (!sameLoad(sessions[i].top, last.top)) break;
    const r = resultAt(i);
    if (r === "incomplete") continue;
    if (r !== "miss") break;
    missStreak += 1;
  }

  if (missStreak >= PROGRESSION_RULES.deloadAfterMisses) {
    let anyLower = false;
    const planned = positions.map((i) => {
      const s = at(i);
      if (s.role !== "working") return held(s, i, s.reps, false);
      const v = lower(s, rule);
      if (v == null || sameLoad(v, s.load)) return held(s, i, range.low, false);
      anyLower = true;
      return moved(s, i, v, range.low);
    });
    return anyLower
      ? finish("deload", planned, `lighter after ${missStreak} sessions short of ${range.low}`, "deload", missStreak)
      : finish("hold", planned, `same weight, aim for ${range.low} reps`, "missed", missStreak);
  }

  // The bump reads the trigger when set, the range otherwise.
  const bump = trigger == null ? result : sessionResult(last.working, range, 0, trigger);

  if (bump === "top") {
    const planned = positions.map((i) => {
      const s = at(i);
      if (s.role !== "working") return held(s, i, s.reps, false);
      const v = raise(s, rule);
      // With the trigger, each set aims for last time's reps at the new weight.
      const reps = trigger == null ? range.low : s.reps;
      return v == null ? held(s, i, s.reps, false) : moved(s, i, v, reps);
    });
    const loadOf = (s: ReadSet) => s.load ?? (bodyLoad ? 0 : null);
    const topSet = last.working.find((s) => sameLoad(loadOf(s), last.top));
    const raised = topSet && last.top != null ? raise(topSet, rule) : null;
    // Every rule that reaches here can raise its top set.
    if (raised == null || topSet == null || last.top == null) {
      return finish("hold", planned, "same as last time", "partial", missStreak);
    }
    let reason: string;
    if (topSet.stored) {
      reason = `up from ${formatNumber(topSet.stored.weight_value)} ${unitLabel(topSet.stored.weight_unit)} last time`;
    } else if (last.top < 0) {
      reason = `${formatNumber(raised - last.top)} less assist than last time`;
    } else {
      reason = `Add ${formatNumber(raised - last.top)} more ${unitLabel(unit)} than last time`;
    }
    return finish("increase", planned, reason, "increase", missStreak);
  }

  if (trigger != null) {
    return finish(
      "hold",
      positions.map((i) => held(at(i), i, at(i).reps, false)),
      `same weight, aim for ${trigger} on your first set`,
      "below-trigger",
      missStreak,
    );
  }

  const planned = positions.map((i) => {
    const s = at(i);
    return held(s, i, s.role === "working" ? nextReps(s.reps) : s.reps, false);
  });
  if (result === "miss") {
    return finish("hold", planned, `same weight, aim for ${range.low} reps`, "missed", missStreak);
  }
  return finish("add-reps", planned, "same weight, beat last time's reps", "beat-reps", missStreak);
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/** What the labels need to know about an exercise. */
export type LabelExercise = { weight_type: string | null; equipment: string | null };

/**
 * A suggested weight as the set row and the summary print it, without the
 * unit (the column header carries it). A bodyweight-type or body-only
 * exercise prints "BW", "BW +10" or "BW −15" (formatBodyweight), and "BW"
 * for a reps-only suggestion too. Null for a reps-only suggestion on
 * anything else.
 */
export function formatSuggestedWeight(
  weight: SuggestedSet["weight"],
  exercise: LabelExercise,
  unit: WeightUnit,
): string | null {
  if (isBodyweightLoad(exercise)) return formatBodyweight(weight?.value ?? null, unit);
  if (weight == null) return null;
  return String(tidyWeight(weight.value, unit));
}

/** "75 × 8" or "BW × 12", weight left and reps right, or "11 reps" with no weight. */
export function formatSuggestedSet(
  set: SuggestedSet,
  exercise: LabelExercise,
  unit: WeightUnit,
): string {
  const w = formatSuggestedWeight(set.weight, exercise, unit);
  return w == null ? `${set.reps} reps` : `${w} × ${set.reps}`;
}

/**
 * The summary's "Next time" figure for an exercise, from its working sets:
 * "75 × 8" when every set matches, "70 × 10, 10, 9" when only the reps
 * differ, and the first working set alone when the weights differ (a top
 * set with back-off sets). Null when there are no working sets.
 */
export function nextTimeLabel(
  progression: Progression,
  exercise: LabelExercise,
  unit: WeightUnit,
): string | null {
  const working = progression.sets.filter((s) => s.role === "working");
  if (working.length === 0) return null;
  const first = working[0];
  const sameWeight = working.every((s) =>
    s.weight == null || first.weight == null
      ? s.weight == null && first.weight == null
      : sameLoad(s.weight.value, first.weight.value),
  );
  if (!sameWeight) return formatSuggestedSet(first, exercise, unit);
  const reps = working.map((s) => s.reps);
  const repsText = reps.every((r) => r === reps[0]) ? String(reps[0]) : reps.join(", ");
  const w = formatSuggestedWeight(first.weight, exercise, unit);
  return w == null ? `${repsText} reps` : `${w} × ${repsText}`;
}

/** `sets.set_type` as a progression set type, or null for untyped and anything unknown. */
export function asSetType(value: string | null | undefined): SetType | null {
  return value === "warmup" || value === "normal" || value === "drop" || value === "failure" ? value : null;
}

/**
 * The suggestion for each row of a card. Rows saved as warm-ups (generated
 * ones, inserted above the working rows) take the generated warm-ups in
 * order, and every other row takes the rest of the suggestion in order,
 * so deleting a warm-up row never shifts the working sets. A row past the
 * end of its kind gets null. Without `rows`, by index, as before.
 */
export function suggestionsForRows(
  progression: Progression | null | undefined,
  rows?: readonly { set_type?: string | null }[],
): (SuggestedSet | null)[] {
  const sets = progression?.sets ?? [];
  if (!rows) return sets;
  const generated = sets.filter((s) => s.generated);
  const rest = sets.filter((s) => !s.generated);
  let g = 0;
  let r = 0;
  return rows.map((row) =>
    row.set_type === "warmup" ? (generated[g++] ?? null) : (rest[r++] ?? null),
  );
}

/**
 * The progression as `setPlaceholders`' `suggested` source, so a Pro
 * user's tick on an empty row logs the suggestion. With `rows`, matched to
 * them by `suggestionsForRows`; without, by index. A reps-only set's
 * weight is null and falls through to the prior session. Warmup rows, and
 * rows saved as warm-ups, are marked so the rows below them look past what
 * was logged there.
 */
export function placeholderSuggestions(
  progression: Progression | null | undefined,
  rows?: readonly { set_type?: string | null }[],
): { weight_value: number | null; reps: number | null; stored: StoredWeight | null; warmup: boolean }[] {
  return suggestionsForRows(progression, rows).map((s, i) => ({
    weight_value: s?.weight?.value ?? null,
    reps: s?.reps ?? null,
    stored: s?.weight?.stored ?? null,
    warmup: s?.role === "warmup" || rows?.[i]?.set_type === "warmup",
  }));
}

/** The suggestion columns a Pro tick writes on `sets`. */
export type SuggestionWrite = {
  suggested_weight_value: number | null;
  suggested_weight_unit: WeightUnit | null;
  suggested_reps: number;
};

/**
 * A set's suggestion as the tick writes it, in the form a weight is
 * written: a held weight keeps its stored value and unit (225 lb stays
 * 225 lb for a kg user), anything else is the value in `unit`. Logged
 * unchanged, the set then matches it exactly in `suggestion_matched`.
 * A reps-only suggestion writes no weight. Null with no suggestion, which
 * is every free user's tick.
 */
export function suggestionToWrite(
  set: SuggestedSet | null | undefined,
  unit: WeightUnit,
): SuggestionWrite | null {
  if (!set) return null;
  const weight = set.weight == null ? null : (set.weight.stored ?? { weight_value: set.weight.value, weight_unit: unit });
  return {
    suggested_weight_value: weight?.weight_value ?? null,
    suggested_weight_unit: weight?.weight_unit ?? null,
    suggested_reps: set.reps,
  };
}

// ---------------------------------------------------------------------------
// Chip and sheet
// ---------------------------------------------------------------------------

/** Units as the chip and the sheet print them: "+5 lbs", "+2.5 kg", like the rest of the app. */
function chipUnit(unit: WeightUnit): string {
  return unitLabel(unit);
}

/** The heaviest working weight among `sets`, or null with none. */
function topWorking(weights: ({ value: number } | null)[]): number | null {
  let top: number | null = null;
  for (const w of weights) if (w != null && (top == null || w.value > top)) top = w.value;
  return top;
}

/** The most reps any working set adds over last time, at least 1. */
function repGain(progression: Progression): number {
  let gain = 0;
  for (const s of progression.sets) {
    if (s.role === "working" && s.last) gain = Math.max(gain, s.reps - s.last.reps);
  }
  return Math.max(gain, 1);
}

/** The weight change behind an increase, in the user's unit, signed. */
function weightGain(progression: Progression): number | null {
  const working = progression.sets.filter((s) => s.role === "working");
  const today = topWorking(working.map((s) => s.weight));
  const before = topWorking(working.map((s) => s.last?.weight ?? null));
  if (today == null || before == null) return null;
  return today - before;
}

function topOfRangeLabel(equipment: string | null): string {
  switch ((equipment ?? "").trim().toLowerCase()) {
    case "bands":
      return "Harder band";
    case "medicine ball":
      return "Heavier ball";
    default:
      return "Harder variation";
  }
}

export type ProgressionChip = {
  /** `up` is the blue chip, `neutral` the warm gray one. */
  tone: "up" | "neutral";
  icon: "up" | "equal" | "down";
  /** "+5 lbs", "+1 rep", "Hold". */
  label: string;
  /** The first-appearance suffix, shown as "· beat last time". */
  short: string;
};

/**
 * The chip under the exercise name. Null for unsupported and for a first
 * session without a starting weight, which get no chip.
 */
export function progressionChip(
  progression: Progression,
  exercise: { equipment: string | null },
  unit: WeightUnit,
): ProgressionChip | null {
  const d = progression.detail;
  if (!d || progression.sets.length === 0) return null;
  const reps = (n: number) => `+${n} ${n === 1 ? "rep" : "reps"}`;
  switch (d.why) {
    case "increase": {
      const gain = weightGain(progression);
      const before = topWorking(progression.sets.filter((s) => s.role === "working").map((s) => s.last?.weight ?? null));
      const amount = gain == null ? null : formatNumber(Math.abs(tidyWeight(gain, unit) as number));
      const label =
        amount == null
          ? "Up"
          : before != null && before < 0
            ? `−${amount} ${chipUnit(unit)} assist`
            : `+${amount} ${chipUnit(unit)}`;
      const n = d.lastWorkingSets;
      if (d.repTrigger != null) return { tone: "up", icon: "up", label, short: `first set hit ${d.firstSetReps}` };
      return { tone: "up", icon: "up", label, short: n === 1 ? `your set hit ${d.range.high}` : `all ${n} sets hit ${d.range.high}` };
    }
    case "below-trigger":
      return { tone: "neutral", icon: "equal", label: "Same weight", short: `aim for ${d.repTrigger} on set 1` };
    case "beat-reps":
      return { tone: "up", icon: "up", label: reps(repGain(progression)), short: "beat last time" };
    case "bodyweight-reps":
      return { tone: "up", icon: "up", label: reps(repGain(progression)), short: "beat last time" };
    case "add-set": {
      const n = d.lastWorkingSets;
      return { tone: "up", icon: "up", label: "+1 set", short: n === 1 ? `your set hit ${d.range.high}` : `all ${n} sets hit ${d.range.high}` };
    }
    case "add-load": {
      const w = progression.sets.find((s) => s.weight != null)?.weight;
      const label = w ? `+${formatNumber(tidyWeight(w.value, unit) as number)} ${chipUnit(unit)}` : "Add weight";
      return { tone: "up", icon: "up", label, short: `${d.lastWorkingSets} sets at ${d.range.high}` };
    }
    case "top-of-range":
      return { tone: "up", icon: "up", label: topOfRangeLabel(exercise.equipment), short: "top of range" };
    case "missed":
      return { tone: "neutral", icon: "equal", label: "Same weight", short: `aim for ${d.range.low}` };
    case "partial":
      return { tone: "neutral", icon: "equal", label: "Same weight", short: "repeat last time" };
    case "layoff":
      return {
        tone: "neutral",
        icon: "equal",
        label: "Welcome back",
        short: d.weeksOff != null ? `${d.weeksOff} weeks off` : "repeat last time",
      };
    case "deload":
      return {
        tone: "neutral",
        icon: "down",
        label: "Deload",
        short: `${progression.missStreak} misses in a row`,
      };
    case "starting-weight": {
      const first = progression.sets.find((s) => s.role === "working") ?? progression.sets[0];
      return {
        tone: "up",
        icon: "up",
        label: `Start at ${formatSuggestedSet(first, { weight_type: null, ...exercise }, unit)}`,
        short: progression.reason,
      };
    }
  }
}

export type ProgressionSheetRow = {
  /** "1", "2", or "W" for a warmup and "D" for a drop set. */
  set: string;
  /** "70 × 10", or "—" past the end of last session. */
  last: string;
  today: string;
  /** True when today differs from last time, to tint the change. Never for a generated warm-up. */
  changed: boolean;
};

export type ProgressionSheet = {
  kicker: string;
  title: string;
  body: string;
  rows: ProgressionSheetRow[];
  /** False for a first session: there is no Last column to show. */
  showLast: boolean;
  /** The line over generated warm-up rows, which the screen shows the first time only. Null without them. */
  warmupNote: string | null;
  /** Null where there is no weight jump to work towards. */
  progress: {
    /** "Next weight increase", over the bar on the left. */
    label: string;
    /** "8 of 12 reps", over the bar on the right. */
    valueText: string;
    /** "Hit 12 on every set and the weight goes up.", under the bar. */
    hint: string;
    value: number;
    max: number;
  } | null;
};

/** "All three sets reached ...", or "Your set reached ..." for one: never "every set" over a count it does not know. */
function allSets(n: number, rest: string): string {
  return n === 1 ? `Your set ${rest}` : `All ${proseNumber(n)} sets ${rest}`;
}

function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The sheet a chip opens: a title, a plain explanation, the sets against
 * last time, and how far the reps are from the next weight jump. Null
 * where the chip is null.
 *
 * With `cardRows`, the card's rows, it lists only as many generated
 * warm-ups as the card has warm-up rows, the ones `suggestionsForRows`
 * gives those rows. A warm-up row switched to a working set or deleted
 * leaves the list with it.
 */
export function progressionSheet(
  progression: Progression,
  exercise: LabelExercise,
  unit: WeightUnit,
  cardRows?: readonly { set_type?: string | null }[],
): ProgressionSheet | null {
  const d = progression.detail;
  if (!d || progression.sets.length === 0) return null;
  const { low, high } = d.range;
  const u = chipUnit(unit);
  const working = progression.sets.filter((s) => s.role === "working");

  let title: string;
  let body: string;
  switch (d.why) {
    case "increase": {
      const gain = weightGain(progression);
      const amount = gain == null ? null : formatNumber(Math.abs(tidyWeight(gain, unit) as number));
      const assist = (topWorking(working.map((s) => s.last?.weight ?? null)) ?? 0) < 0;
      title =
        amount == null
          ? sentence(progression.reason)
          : assist
            ? `${amount} ${u} less assist than last time`
            : `Add ${amount} more ${u} than last time`;
      const reached = allSets(d.lastWorkingSets, `reached ${high} reps last time`);
      if (d.repTrigger != null) {
        body = `Your first working set hit ${d.firstSetReps} reps last time. When you hit ${d.repTrigger} or more reps, move the weight up next time, aiming for last time's rep count at the new weight.`;
        break;
      }
      body = assist
        ? `${reached}, so you take a little less help today and the reps start again at ${low}.`
        : `${reached}, so the weight goes up and the reps start again at ${low}. Build back to ${high} and it goes up again.`;
      break;
    }
    case "beat-reps":
      title = "One more rep than last time";
      body = `Same weight as last time. Beat last time's reps on each set. When every set reaches ${high}, the weight goes up.`;
      break;
    case "bodyweight-reps": {
      const next = d.lastWorkingSets >= PROGRESSION_RULES.bodyweightMaxSets ? "you add weight" : "you add a set";
      title = "One more rep than last time";
      body = `Bodyweight stays the same. Beat last time's reps on each set. When every set reaches ${high}, ${next}.`;
      break;
    }
    case "add-set":
      title = "Add a set today";
      body = `${d.lastWorkingSets === 1 ? "Your set" : "Every set"} hit ${high} last time. Do one more set at ${high}.`;
      break;
    case "add-load":
      title = "Ready to add weight";
      body =
        unit === "kg"
          ? "Hold a dumbbell or wear a vest, then log the extra kilograms in +KG."
          : "Hold a dumbbell or wear a vest, then log the extra pounds in +LBS.";
      break;
    case "top-of-range": {
      const label = topOfRangeLabel(exercise.equipment).toLowerCase();
      title = "Top of range";
      body = `${allSets(d.lastWorkingSets, `reached ${high} reps last time`)}. There is no weight to add, so try a ${label} and start again at ${low}.`;
      break;
    }
    case "missed":
      title = `Same weight, aim for ${low} reps`;
      body = `A set fell short of ${low} reps last time. Stay at this weight and aim for ${low} or more on each set.`;
      break;
    case "below-trigger":
      title = `Same weight, aim for ${d.repTrigger} reps`;
      body = `Your first working set reached ${d.firstSetReps} reps last time. Hit ${d.repTrigger} or more on it and the weight goes up.`;
      break;
    case "partial":
      title = "Same as last time";
      body = "Last session had fewer sets than usual, so today repeats it before anything goes up.";
      break;
    case "layoff":
      title = "Welcome back";
      body = `It has been ${d.weeksOff ?? "a few"} weeks since you last did this, so today repeats your last session.`;
      break;
    case "deload":
      title = `Lighter after ${progression.missStreak} short sessions`;
      body = `${progression.missStreak} sessions in a row came up short of ${low} reps at this weight. A lighter weight today lets you build back up with good reps.`;
      break;
    case "starting-weight": {
      const first = working[0] ?? progression.sets[0];
      title = `Start at ${formatSuggestedSet(first, exercise, unit)}`;
      body = `${startingReason(d.source ?? "floor", d.siblingName, exercise, first.reps)}. ${STARTING_WEIGHT_INSTRUCTION}`;
      break;
    }
  }

  let warmupRows = cardRows ? cardRows.filter((r) => r.set_type === "warmup").length : Infinity;
  const listed = progression.sets.filter((s) => {
    if (!s.generated) return true;
    warmupRows -= 1;
    return warmupRows >= 0;
  });

  let workingNumber = 0;
  const rows = listed.map((s): ProgressionSheetRow => {
    const set = s.role === "warmup" ? "W" : s.role === "drop" ? "D" : String((workingNumber += 1));
    const today = formatSuggestedSet(s, exercise, unit);
    const last = s.last ? formatSuggestedSet({ ...s, weight: s.last.weight, reps: s.last.reps }, exercise, unit) : "—";
    return { set, last, today, changed: !s.generated && last !== today };
  });

  // Last time's working sets at the top of the range, out of all of them.
  const lastWorking = working.filter((s) => s.last != null);
  const total = d.lastWorkingSets;
  const value = Math.min(lastWorking.filter((s) => (s.last as { reps: number }).reps >= high).length, total);
  const setsAtTop = `${value} of ${total} sets at ${high}`;

  let progress: ProgressionSheet["progress"] = null;
  const hasWeight = d.rule === "linear" || d.rule === "ladder" || d.rule === "bodyweight";
  // Only where there is a gap to the next step; the other titles say it.
  if (hasWeight && total > 0 && (d.why === "beat-reps" || d.why === "missed" || d.why === "partial")) {
    progress = {
      label: "Next weight increase",
      valueText: setsAtTop,
      hint: `Hit ${high} on every set and the weight goes up.`,
      value,
      max: total,
    };
  }
  if (d.why === "below-trigger" && d.repTrigger != null && d.firstSetReps != null) {
    progress = {
      label: "Next weight increase",
      valueText: `${d.firstSetReps} of ${d.repTrigger} reps`,
      hint: `Hit ${d.repTrigger} on your first set and the weight goes up.`,
      value: Math.min(d.firstSetReps, d.repTrigger),
      max: d.repTrigger,
    };
  }
  if (d.why === "bodyweight-reps" && total > 0) {
    const toWeight = total >= PROGRESSION_RULES.bodyweightMaxSets;
    progress = {
      label: toWeight ? "Adding weight" : "Next extra set",
      valueText: setsAtTop,
      hint: toWeight ? `Hit ${high} on every set and you add weight.` : `Hit ${high} on every set and you add a set.`,
      value,
      max: total,
    };
  }

  return {
    kicker: d.why === "starting-weight" ? "STARTING WEIGHT" : "TODAY'S PROGRESSION",
    title,
    body,
    rows,
    showLast: d.why !== "starting-weight",
    warmupNote: listed.some((s) => s.generated) ? WARMUP_NOTE : null,
    progress,
  };
}

/** The sheet's instruction under a starting weight. */
export const STARTING_WEIGHT_INSTRUCTION =
  "Treat this as a guess. If every rep felt easy, go up a step on the next set and we'll start from there next time.";

/** The sheet's line over generated warm-up rows. */
export const WARMUP_NOTE = "Warm-up sets get you to the working weight safely. They don't count toward progress.";
