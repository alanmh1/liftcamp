// The workout summary's personal records (docs/summary-prs-spec.md, section 1).
// Pure, no React, no Supabase. The history comes from the account-wide scan
// the History and Profile screens already read, so there is no new query.
//
// This is the summary's rule only. The History ribbons keep computePrSetIds,
// where a first-ever session marks its best set; here a first session marks
// nothing, because there is nothing to beat.

import { formatCardioSet } from "./cardio";
import { oneRepMaxNumeric } from "./one-rep-max";
import { effectiveLoad, formatSetWeight } from "./set-weight";
import { asWeightUnit, tidyWeight } from "./units";
import { isWarmupSet } from "./working-sets";

/** One set as the summary and the scan both hold it, already in the user's unit. */
export type SummaryPrSet = {
  id: string;
  weight: string | null;
  weight_value: number | null;
  reps: number | null;
  completed: boolean;
  set_type?: string | null;
  position?: number;
};

type PrExercise = { weight_type?: string | null; set_type?: string | null };

/** One `workout_exercises` row of the workout just finished. */
export type SummaryPrRow = {
  exerciseId: string;
  exercise: PrExercise;
  sets: readonly SummaryPrSet[];
};

/** One scan row (ScanRow in apps/mobile data/history.ts), for the history before this workout. */
export type SummaryPrHistoryRow = {
  workout_id: string;
  exercise_id: string;
  exercises: PrExercise | null;
  workouts: { finished_at: string | null } | null;
  sets: readonly SummaryPrSet[] | null;
};

/** A set as the PR row prints it. */
export type PrSetFigures = {
  setId: string;
  /** The legacy text weight, for a set with no numeric one. */
  weight: string | null;
  /** The logged weight in the user's unit (the added load for a bodyweight exercise). */
  weightValue: number | null;
  /** What the 1RM was scored on: the weight, or bodyweight plus it. */
  load: number;
  reps: number;
  estimatedMax: number;
};

export type PrGain = { kind: "weight"; amount: number } | { kind: "reps"; amount: number };

export type SummaryPr = {
  exerciseId: string;
  /** This workout's best set: the one the row shows and Copy text marks. */
  best: PrSetFigures;
  /** The set that held the record before this workout. */
  previous: PrSetFigures;
  /** Gain in estimated 1RM over the previous best, as a fraction (0.05 is 5%). */
  gain: number;
  /** The chip: heavier, or the same weight for more reps. Null otherwise. */
  chip: PrGain | null;
};

/** Floating point slack for "the same weight". */
const EPSILON = 1e-6;

/** The highest estimated 1RM among `sets`, first in order on a tie. Warm-ups and unfinished sets skipped. */
function bestOf(
  sets: readonly SummaryPrSet[],
  exercise: PrExercise | null,
  bodyweight: number | null,
): PrSetFigures | null {
  let best: PrSetFigures | null = null;
  for (const s of sets) {
    if (!s.completed || isWarmupSet(s)) continue;
    const load = effectiveLoad({ weight: s.weight, weight_value: s.weight_value }, exercise, bodyweight);
    const orm = oneRepMaxNumeric(load, s.reps);
    if (orm == null || load == null || s.reps == null) continue;
    if (!best || orm > best.estimatedMax) {
      best = { setId: s.id, weight: s.weight, weightValue: s.weight_value, load, reps: s.reps, estimatedMax: orm };
    }
  }
  return best;
}

function byPosition<T extends { position?: number }>(sets: readonly T[]): T[] {
  return [...sets].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

/**
 * The chip for a new best over an old one: `+2.5` heavier, else `+2 reps`
 * at the same weight, else none (lighter for more reps, or a higher
 * estimate any other way).
 */
export function prChip(best: Pick<PrSetFigures, "load" | "reps">, previous: Pick<PrSetFigures, "load" | "reps">): PrGain | null {
  const diff = best.load - previous.load;
  if (diff > EPSILON) return { kind: "weight", amount: diff };
  if (Math.abs(diff) <= EPSILON && best.reps > previous.reps) return { kind: "reps", amount: best.reps - previous.reps };
  return null;
}

/**
 * The personal records a finished workout set, one per exercise, biggest
 * jump first.
 *
 * - The previous best is the highest estimated 1RM (`oneRepMaxNumeric` on
 *   `effectiveLoad`, warm-ups and unfinished sets skipped, as
 *   `computePrSetIds`) across the exercise's sets in workouts finished
 *   before `finishedAt`. This workout is left out by id whatever the scan
 *   says about it.
 * - An exercise has a PR when its best working set here beats that. No
 *   previous best, no PR: a first session shows none.
 * - An exercise done in two rows of this workout is one exercise; the row
 *   shows the better set.
 * - Ordered by percentage gain in estimated 1RM, then by the workout's order.
 * - Cardio never PRs: `effectiveLoad` is null for it.
 */
export function summaryPrs({
  workoutId,
  finishedAt,
  rows,
  history,
  bodyweight,
}: {
  workoutId: string;
  finishedAt: string;
  rows: readonly SummaryPrRow[];
  history: readonly SummaryPrHistoryRow[];
  bodyweight: number | null;
}): SummaryPr[] {
  const finishedMs = Date.parse(finishedAt);

  // This workout's sets per exercise, in the workout's order.
  const current = new Map<string, { exercise: PrExercise; sets: SummaryPrSet[] }>();
  for (const row of rows) {
    const entry = current.get(row.exerciseId) ?? { exercise: row.exercise, sets: [] };
    entry.sets.push(...byPosition(row.sets));
    current.set(row.exerciseId, entry);
  }

  // Earlier finished sets per exercise this workout has.
  const earlier = new Map<string, { exercise: PrExercise | null; sets: SummaryPrSet[] }>();
  for (const row of history) {
    if (row.workout_id === workoutId || !current.has(row.exercise_id)) continue;
    const done = row.workouts?.finished_at;
    if (!done || !(Date.parse(done) < finishedMs)) continue;
    const entry = earlier.get(row.exercise_id) ?? { exercise: row.exercises, sets: [] };
    entry.sets.push(...byPosition(row.sets ?? []));
    earlier.set(row.exercise_id, entry);
  }

  const prs: (SummaryPr & { order: number })[] = [];
  let order = 0;
  for (const [exerciseId, { exercise, sets }] of current) {
    order += 1;
    const best = bestOf(sets, exercise, bodyweight);
    if (!best) continue;
    const before = earlier.get(exerciseId);
    const previous = before ? bestOf(before.sets, exercise, bodyweight) : null;
    if (!previous || !(best.estimatedMax > previous.estimatedMax)) continue;
    const gain = previous.estimatedMax > 0 ? best.estimatedMax / previous.estimatedMax - 1 : Infinity;
    prs.push({ exerciseId, best, previous, gain, chip: prChip(best, previous), order });
  }
  prs.sort((a, b) => b.gain - a.gain || a.order - b.order);
  return prs.map(({ order: _order, ...pr }) => pr);
}

/** "2 PRs", "1 PR". */
export function prCountLabel(count: number): string {
  return `${count} ${count === 1 ? "PR" : "PRs"}`;
}

/** The chip's text: "+2.5 kg", "+2 reps", "+1 rep". */
export function prChipLabel(chip: PrGain, unitLabel: string): string {
  if (chip.kind === "reps") return `+${chip.amount} ${chip.amount === 1 ? "rep" : "reps"}`;
  const unit = asWeightUnit(unitLabel);
  return `+${tidyWeight(chip.amount, unit)} ${unitLabel}`;
}

/** A set's weight and reps as the History set table prints them: "37.5 kg × 10", "BW + 10 kg × 8". */
export function setFiguresLabel(
  set: { weight: string | null; weight_value: number | null; reps: number | null },
  weightType: string | null | undefined,
  unitLabel: string,
): string {
  const unit = asWeightUnit(unitLabel);
  const weight = formatSetWeight({ ...set, weight_value: tidyWeight(set.weight_value, unit) }, weightType, unitLabel);
  return set.reps == null ? weight : `${weight} × ${set.reps}`;
}

// ---------------------------------------------------------------------------
// Copy text (section 6)
// ---------------------------------------------------------------------------

export type CopyTextSet = SummaryPrSet & {
  duration_seconds?: number | null;
  distance_meters?: number | null;
  incline_percent?: number | null;
};

export type CopyTextExercise = {
  name: string;
  weightType: string | null;
  cardio: boolean;
  sets: readonly CopyTextSet[];
};

/**
 * The workout as plain text for the clipboard: the name, a line of date,
 * time and volume (or cardio time), the note when there is one, then every
 * exercise with its completed sets, and the sign-off. The set each PR row
 * shows ends " · PR"; a warm-up ends " (warm-up)". Exercises with no
 * completed set are left out.
 */
export function workoutCopyText({
  name,
  dateLabel,
  duration,
  work,
  notes,
  exercises,
  prSetIds,
  unitLabel,
}: {
  name: string;
  /** "Friday, Nov 20". */
  dateLabel: string;
  /** "1h 06m". */
  duration: string;
  /** "6,794 kg", or the cardio time for a cardio-only workout. */
  work: string;
  notes: string | null;
  exercises: readonly CopyTextExercise[];
  /** The `best.setId` of each summary PR. */
  prSetIds: ReadonlySet<string>;
  unitLabel: string;
}): string {
  const unit = asWeightUnit(unitLabel);
  const lines: string[] = [name, [dateLabel, duration, work].filter((p) => p).join(" · ")];
  const note = notes?.trim();
  if (note) lines.push(note);

  for (const ex of exercises) {
    const done = byPosition(ex.sets).filter((s) => s.completed);
    if (done.length === 0) continue;
    lines.push("", ex.name);
    for (const s of done) {
      let line = ex.cardio ? (formatCardioSet(s, unit) ?? "—") : setFiguresLabel(s, ex.weightType, unitLabel);
      if (isWarmupSet(s)) line += " (warm-up)";
      else if (prSetIds.has(s.id)) line += " · PR";
      lines.push(line);
    }
  }

  lines.push("", "Logged with LiftCamp · liftcamp.app");
  return lines.join("\n");
}
