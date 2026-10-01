import { isTimedExercise } from "./set-weight";
import {
  asWeightUnit,
  convertWeight,
  storedWeightOf,
  type StoredWeight,
  type WeightUnit,
} from "./units";

/**
 * Progression guidance for Pro: the weight and reps to aim for on each set
 * of an exercise's next session, and a short reason ("up 5 from last time").
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
 * - `bodyweight`: the signed extra load of a bodyweight-type exercise.
 *   Added load goes up by `step`, assist comes down by `step` until it is
 *   gone, and bodyweight alone adds reps.
 * - `reps`: the weight holds and reps go up. `capped` stops at the top of
 *   the range (bands, balls, "other"); uncapped keeps adding (body only).
 * - `none`: no guidance (foam roll, timed, unknown equipment).
 */
export type LoadRule =
  | { kind: "linear"; step: number }
  | { kind: "ladder"; ladder: Ladder }
  | { kind: "bodyweight"; step: number }
  | { kind: "reps"; capped: boolean }
  | { kind: "none" };

export type ProgressionExercise = {
  id: string;
  equipment: string | null;
  weight_type: string | null;
  mechanic: string | null;
  primary_muscle: string | null;
  is_unilateral?: boolean | null;
};

/** Primary muscles that make a barbell compound a lower-body lift. */
const LOWER_BODY_MUSCLES: readonly string[] = ["quads", "glutes", "hamstrings", "lower back"];

function isLowerBodyCompound(ex: ProgressionExercise): boolean {
  return ex.mechanic === "compound" && LOWER_BODY_MUSCLES.includes(ex.primary_muscle ?? "");
}

/**
 * The load rule for an exercise in the user's unit. `dumbbellLadder` is in
 * that unit too; it defaults to DUMBBELL_LADDER_LB or DUMBBELL_LADDER_KG.
 */
export function loadRuleFor(
  ex: ProgressionExercise,
  unit: WeightUnit,
  dumbbellLadder?: Ladder,
): LoadRule {
  const kg = unit === "kg";
  if (isTimedExercise(ex.id)) return { kind: "none" };
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
    case "body only":
      return { kind: "reps", capped: false };
    case "bands":
    case "medicine ball":
    case "exercise ball":
    case "other":
      return { kind: "reps", capped: true };
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

function toRange(target: RepTarget): Range {
  if (target.kind === "fixed") return { low: target.reps, high: target.reps };
  if (target.kind === "range") return { low: target.low, high: target.high };
  return toRange(PROGRESSION_RULES.defaultRange);
}

// ---------------------------------------------------------------------------
// Sets and sessions
// ---------------------------------------------------------------------------

/**
 * The set types a future `sets.set_type` column will hold. Until it exists
 * every set reads as untyped and `classifySets` falls back to load.
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
export type HistorySession = { workoutId: string; date: string; sets: HistorySet[] };

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

function readSession(session: HistorySession, unit: WeightUnit, needsLoad: boolean): ReadSession {
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
  for (const s of working) if (s.load != null && (top == null || s.load > top)) top = s.load;
  return { session, sets, working, top };
}

export type SessionResult = "top" | "in-range" | "miss" | "incomplete";

/**
 * How a session went against the range. Fewer working sets than expected
 * (the routine's target sets, or else the session before) is incomplete:
 * no increase, and not a miss. Otherwise every set at the top of the range
 * is `top`, any set under the bottom is `miss`, and the rest is `in-range`.
 */
export function sessionResult(
  working: readonly { reps: number }[],
  range: Range,
  expectedSets = 0,
): SessionResult {
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
};

export type SuggestedSet = {
  position: number;
  role: SetRole;
  /** Null for reps only. `stored` is set when the weight is held from a set logged in the other unit. */
  weight: { value: number; stored: StoredWeight | null } | null;
  reps: number;
};

export type ProgressionOutcome =
  | "increase"
  | "add-reps"
  | "hold"
  | "deload"
  | "first-session"
  | "unsupported";

export type Progression = {
  outcome: ProgressionOutcome;
  /** Empty for first-session and unsupported. */
  sets: SuggestedSet[];
  /** Short, lower case, no unit unless the last session was in the other one. Empty when there are no sets. */
  reason: string;
  /** Misses in a row at the last working weight. */
  missStreak: number;
  basis: { workoutId: string; date: string } | null;
};

const EMPTY = { sets: [], reason: "", missStreak: 0, basis: null };

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

/** The load one step up, or null when the set has no load to raise. */
function raise(set: ReadSet, rule: LoadRule): number | null {
  if (set.load == null) return null;
  switch (rule.kind) {
    case "linear": {
      // A weight logged in the other unit lands on this unit's step.
      if (set.stored == null) return set.load + rule.step;
      let v = snapToStep(set.load + rule.step, rule.step);
      if (v <= set.load + EPS) v += rule.step;
      return v;
    }
    case "ladder":
      return nextOnLadder(set.load, rule.ladder);
    case "bodyweight":
      if (Math.abs(set.load) < EPS) return null;
      return set.load < 0 ? Math.min(set.load + rule.step, 0) : set.load + rule.step;
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
      const v = Math.min(snapToStep(target, rule.step), set.load - rule.step);
      return v > 0 ? v : set.load;
    }
    case "ladder":
      return lowerOnLadder(set.load, target, rule.ladder);
    case "bodyweight":
      if (Math.abs(set.load) < EPS) return set.load;
      return set.load < 0 ? set.load - rule.step : Math.max(set.load - rule.step, 0);
    default:
      return set.load;
  }
}

function held(set: ReadSet, position: number, reps: number, repsOnly: boolean): SuggestedSet {
  return {
    position,
    role: set.role,
    weight: repsOnly || set.load == null ? null : { value: set.load, stored: set.stored },
    reps,
  };
}

function moved(set: ReadSet, position: number, value: number, reps: number): SuggestedSet {
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
 */
export function suggestProgression(input: ProgressionInput): Progression {
  const { exercise, unit } = input;
  if (!exercise) return { outcome: "unsupported", ...EMPTY };
  const parsed = parseRepTarget(input.target?.reps);
  if (parsed?.kind === "timed") return { outcome: "unsupported", ...EMPTY };
  const rule = loadRuleFor(exercise, unit, input.dumbbellLadder);
  if (rule.kind === "none") return { outcome: "unsupported", ...EMPTY };

  const range = toRange(parsed ?? PROGRESSION_RULES.defaultRange);
  const needsLoad = rule.kind === "linear" || rule.kind === "ladder";
  const sessions = input.history
    .map((s) => readSession(s, unit, needsLoad))
    .filter((s) => s.working.length > 0);
  if (sessions.length === 0) return { outcome: "first-session", ...EMPTY };

  const last = sessions[0];
  const basis = { workoutId: last.session.workoutId, date: last.session.date };
  const count = input.setCount > 0 ? input.setCount : last.sets.length;
  const at = (i: number) => last.sets[Math.min(i, last.sets.length - 1)];
  const positions = Array.from({ length: count }, (_, i) => i);
  const repsOnly = rule.kind === "reps" && !rule.capped;
  const targetSets = input.target?.sets != null && input.target.sets > 0 ? input.target.sets : null;
  const expected = (i: number) => targetSets ?? sessions[i + 1]?.working.length ?? 0;

  const sameAsLast = (reason: string, outcome: ProgressionOutcome = "hold"): Progression => ({
    outcome,
    sets: positions.map((i) => held(at(i), i, at(i).reps, repsOnly)),
    reason,
    missStreak: 0,
    basis,
  });

  const days = daysBetween(last.session.date, input.today);
  if (days != null && days > PROGRESSION_RULES.layoffDays) {
    return sameAsLast(`same as last time, ${Math.round(days / 7)} weeks off`);
  }

  const result = sessionResult(last.working, range, expected(0));
  const nextReps = (reps: number) => Math.min(Math.max(reps + 1, range.low), range.high);

  if (rule.kind === "reps") {
    if (!rule.capped) {
      return {
        outcome: "add-reps",
        sets: positions.map((i) => held(at(i), i, at(i).role === "working" ? at(i).reps + 1 : at(i).reps, true)),
        reason: "1 more rep than last time",
        missStreak: 0,
        basis,
      };
    }
    if (result === "incomplete") return sameAsLast("same as last time");
    if (result === "top") return sameAsLast(topOfRangeReason(exercise.equipment));
    return {
      outcome: "add-reps",
      sets: positions.map((i) => held(at(i), i, at(i).role === "working" ? nextReps(at(i).reps) : at(i).reps, false)),
      reason: "same weight, beat last time's reps",
      missStreak: 0,
      basis,
    };
  }

  if (result === "incomplete") return sameAsLast("same as last time");

  // A partial session at the same weight is neutral: it neither counts as a
  // miss nor breaks the streak.
  let missStreak = 0;
  for (let i = 0; i < sessions.length; i += 1) {
    if (!sameLoad(sessions[i].top, last.top)) break;
    const r = sessionResult(sessions[i].working, range, expected(i));
    if (r === "incomplete") continue;
    if (r !== "miss") break;
    missStreak += 1;
  }

  if (missStreak >= PROGRESSION_RULES.deloadAfterMisses) {
    let anyLower = false;
    const sets = positions.map((i) => {
      const s = at(i);
      if (s.role !== "working") return held(s, i, s.reps, false);
      const v = lower(s, rule);
      if (v == null || sameLoad(v, s.load)) return held(s, i, range.low, false);
      anyLower = true;
      return moved(s, i, v, range.low);
    });
    return {
      outcome: anyLower ? "deload" : "hold",
      sets,
      reason: anyLower
        ? `lighter after ${missStreak} sessions short of ${range.low}`
        : `same weight, aim for ${range.low} reps`,
      missStreak,
      basis,
    };
  }

  if (result === "top") {
    const sets = positions.map((i) => {
      const s = at(i);
      if (s.role !== "working") return held(s, i, s.reps, false);
      const v = raise(s, rule);
      // Bodyweight alone has no load to raise, so it adds a rep instead.
      return v == null ? held(s, i, s.reps + 1, false) : moved(s, i, v, range.low);
    });
    const topSet = last.working.find((s) => sameLoad(s.load, last.top));
    const raised = topSet && last.top != null ? raise(topSet, rule) : null;
    if (raised == null || topSet == null || last.top == null) {
      return { outcome: "add-reps", sets, reason: "1 more rep than last time", missStreak, basis };
    }
    let reason: string;
    if (topSet.stored) {
      reason = `up from ${formatNumber(topSet.stored.weight_value)} ${unitLabel(topSet.stored.weight_unit)} last time`;
    } else if (last.top < 0) {
      reason = `${formatNumber(raised - last.top)} less assist than last time`;
    } else {
      reason = `up ${formatNumber(raised - last.top)} from last time`;
    }
    return { outcome: "increase", sets, reason, missStreak, basis };
  }

  const sets = positions.map((i) => {
    const s = at(i);
    return held(s, i, s.role === "working" ? nextReps(s.reps) : s.reps, false);
  });
  if (result === "miss") {
    return { outcome: "hold", sets, reason: `same weight, aim for ${range.low} reps`, missStreak, basis };
  }
  return { outcome: "add-reps", sets, reason: "same weight, beat last time's reps", missStreak, basis };
}
