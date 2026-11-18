// Profile's progress sections and Pro Trends (docs/profile-progress-spec.md).
// Pure, no React, no Supabase. Everything derives from the account-wide scan
// the Profile already reads (one row per workout_exercises row, with its
// sets, already in the user's unit), so there is no new query.
//
// Only finished workouts and counted (completed, working) sets go in, as in
// profileStatsFromScan. `buildProgressIndex` walks the scan once; the per
// range functions below then read the index, so switching ranges does not
// rescan thousands of sets.

import { isoFromLocalDate } from "./birthday";
import { MUSCLE_REGIONS, type BodyHighlights, type BodyRegion } from "./body-layers";
import { isCardio } from "./cardio";
import { isRepBased, summarizeSession, type SessionSummary } from "./exercise-progress";
import { canonMuscle, isCanonicalMuscle, type CanonicalMuscle } from "./muscle-vocab";
import { computePrSetIds, setsInLoggedOrder } from "./pr";
import { effectiveLoad } from "./set-weight";
import {
  STRENGTH_LEVELS,
  strengthBarPosition,
  strengthLevel,
  type StrengthLevelName,
  type StrengthThresholds,
} from "./strength-standards";
import type { WeightUnit } from "./units";
import { countedSets } from "./working-sets";

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type ProgressSetRow = {
  id: string;
  weight: string | null;
  weight_value: number | null;
  reps: number | null;
  completed: boolean;
  created_at: string | null;
  position: number;
  set_type: string | null;
};

/** The scan's row shape (ScanRow in apps/mobile data/history.ts). */
export type ProgressScanRow = {
  workout_id: string;
  exercise_id: string;
  exercises: {
    id: string;
    name: string;
    equipment: string | null;
    weight_type: string | null;
    is_unilateral: boolean | null;
    set_type: string | null;
    primary_muscle: string | null;
  } | null;
  workouts: { workout_date: string; finished_at: string | null } | null;
  sets: ProgressSetRow[] | null;
};

/**
 * The ids of every set that was a personal record when it was logged.
 * Every workout counts, finished or not, and only completed sets, so a set
 * here is one the user saw a ribbon for. History's `markPrs` is this.
 */
export function markPrSets<R extends ProgressScanRow>(
  rows: readonly R[],
  bodyweight: number | null,
): { prSetIds: Set<string>; workoutOfSet: Map<string, string> } {
  const workoutOfSet = new Map<string, string>();
  const byExercise = new Map<string, { exercise: R["exercises"]; sets: ProgressSetRow[] }>();
  for (const row of rows) {
    let group = byExercise.get(row.exercise_id);
    if (!group) {
      group = { exercise: row.exercises, sets: [] };
      byExercise.set(row.exercise_id, group);
    }
    const completed = (row.sets ?? []).filter((s) => s.completed);
    for (const s of setsInLoggedOrder(completed)) {
      workoutOfSet.set(s.id, row.workout_id);
      group.sets.push(s);
    }
  }
  const prSetIds = new Set<string>();
  for (const { exercise, sets } of byExercise.values()) {
    sets.sort((a, b) => a.position - b.position);
    for (const id of computePrSetIds(sets, exercise, bodyweight)) prSetIds.add(id);
  }
  return { prSetIds, workoutOfSet };
}

// ---------------------------------------------------------------------------
// Dates and ranges
// ---------------------------------------------------------------------------

/** Local midnight of a YYYY-MM-DD. */
function dateOf(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** The day `n` days after `iso` (before, when negative). */
export function addDays(iso: string, n: number): string {
  const d = dateOf(iso);
  return isoFromLocalDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** Days from `a` to `b`, `b` later. Whole days, safe across a clock change. */
function daysBetween(a: string, b: string): number {
  return Math.round((dateOf(b).getTime() - dateOf(a).getTime()) / 86_400_000);
}

/** Inclusive day count of a range. */
export function rangeDays(range: { start: string; end: string }): number {
  return daysBetween(range.start, range.end) + 1;
}

/** The Monday of the week holding `iso`. */
function weekStartOf(iso: string): string {
  const d = dateOf(iso);
  return addDays(iso, -((d.getDay() + 6) % 7));
}

export const PROFILE_PRESETS = ["7D", "30D", "3M", "1Y", "All"] as const;
export const TRENDS_PRESETS = ["1M", "3M", "6M", "1Y", "All"] as const;
export type ProfilePreset = (typeof PROFILE_PRESETS)[number];
export type TrendsPreset = (typeof TRENDS_PRESETS)[number];
export type RangePreset = ProfilePreset | TrendsPreset;
export const PROFILE_DEFAULT_PRESET: ProfilePreset = "30D";
export const TRENDS_DEFAULT_PRESET: TrendsPreset = "3M";

export type CustomRange = { start: string; end: string };
/** What a range control holds: a preset, or a custom range from the sheet. */
export type RangeChoice = RangePreset | CustomRange;

/** Inclusive local dates. `preset` is null for a custom range. */
export type DateRange = { start: string; end: string; preset: RangePreset | null };

/** The date `months` calendar months before `iso`, held to the month's last day. */
function monthsBefore(iso: string, months: number): string {
  const d = dateOf(iso);
  const target = new Date(d.getFullYear(), d.getMonth() - months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return isoFromLocalDate(new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), lastDay)));
}

/**
 * The inclusive dates a choice covers on `today`. A preset of N days ends
 * today and holds N days; a preset of N months starts the day after the
 * same date N months back. All runs from the first finished workout
 * (today without one). A custom range is used as given, ordered.
 */
export function rangeFor(choice: RangeChoice, today: Date, firstWorkoutDate: string | null = null): DateRange {
  const end = isoFromLocalDate(today);
  if (typeof choice !== "string") {
    const [start, last] = choice.start <= choice.end ? [choice.start, choice.end] : [choice.end, choice.start];
    return { start, end: last, preset: null };
  }
  const preset = choice;
  switch (preset) {
    case "7D":
      return { start: addDays(end, -6), end, preset };
    case "30D":
      return { start: addDays(end, -29), end, preset };
    case "1M":
      return { start: addDays(monthsBefore(end, 1), 1), end, preset };
    case "3M":
      return { start: addDays(monthsBefore(end, 3), 1), end, preset };
    case "6M":
      return { start: addDays(monthsBefore(end, 6), 1), end, preset };
    case "1Y":
      return { start: addDays(monthsBefore(end, 12), 1), end, preset };
    case "All":
      return { start: firstWorkoutDate && firstWorkoutDate < end ? firstWorkoutDate : end, end, preset };
  }
}

const PRESET_LABELS: Record<RangePreset, string> = {
  "7D": "Last 7 days",
  "30D": "Last 30 days",
  "1M": "Last month",
  "3M": "Last 3 months",
  "6M": "Last 6 months",
  "1Y": "Last year",
  All: "All time",
};

/** "Nov 3", or "Nov 3, 2025" when the year is not `thisYear`. */
export function shortDay(iso: string, thisYear?: number): string {
  const d = dateOf(iso);
  const withYear = thisYear != null && d.getFullYear() !== thisYear;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

/**
 * "Last 30 days" for a preset; "Aug 25 to Nov 17" for a custom range,
 * with the year on a date outside the current one.
 */
export function rangeLabel(range: DateRange, today: Date = new Date()): string {
  if (range.preset) return PRESET_LABELS[range.preset];
  const year = today.getFullYear();
  if (range.start === range.end) return shortDay(range.start, year);
  return `${shortDay(range.start, year)} to ${shortDay(range.end, year)}`;
}

/** Weeks in a range for a per-week average, never under one. */
export function weeksInRange(range: { start: string; end: string }): number {
  return Math.max(1, rangeDays(range) / 7);
}

function inRange(date: string, range: { start: string; end: string }): boolean {
  return date >= range.start && date <= range.end;
}

// ---------------------------------------------------------------------------
// Custom range selection (the sheet)
// ---------------------------------------------------------------------------

export type RangeDraft = { start: string | null; end: string | null };
export const EMPTY_RANGE_DRAFT: RangeDraft = { start: null, end: null };

/**
 * One tap on a day. The first sets the start, the second the end (the two
 * swap when the second is earlier), a third starts over from the tapped day.
 */
export function tapRangeDay(draft: RangeDraft, iso: string): RangeDraft {
  if (draft.start == null || draft.end != null) return { start: iso, end: null };
  return iso < draft.start ? { start: iso, end: draft.start } : { start: draft.start, end: iso };
}

/** Whether a day can be tapped: from the first workout's day (when known) to today. */
export function rangeDayEnabled(iso: string, today: Date, firstWorkoutDate: string | null): boolean {
  if (iso > isoFromLocalDate(today)) return false;
  return firstWorkoutDate == null || iso >= firstWorkoutDate;
}

/** The draft as a range, or null until both ends are set. */
export function draftRange(draft: RangeDraft): CustomRange | null {
  return draft.start && draft.end ? { start: draft.start, end: draft.end } : null;
}

/** The sheet's live line: "Nov 3 to Nov 17 · 15 days", "Nov 3", or "Pick a start date". */
export function draftLabel(draft: RangeDraft, today: Date = new Date()): string {
  const year = today.getFullYear();
  if (!draft.start) return "Pick a start date";
  if (!draft.end) return `${shortDay(draft.start, year)} · pick an end date`;
  const days = rangeDays({ start: draft.start, end: draft.end });
  const span = draft.start === draft.end ? shortDay(draft.start, year) : `${shortDay(draft.start, year)} to ${shortDay(draft.end, year)}`;
  return `${span} · ${days} ${days === 1 ? "day" : "days"}`;
}

export type RangeShortcut = "last7" | "thisMonth" | "lastMonth" | "all";
export const RANGE_SHORTCUTS: readonly { id: RangeShortcut; label: string }[] = [
  { id: "last7", label: "Last 7 days" },
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "all", label: "All time" },
];

/** The custom range a shortcut chip applies. */
export function shortcutRange(id: RangeShortcut, today: Date, firstWorkoutDate: string | null): CustomRange {
  const end = isoFromLocalDate(today);
  switch (id) {
    case "last7":
      return { start: addDays(end, -6), end };
    case "thisMonth":
      return { start: `${end.slice(0, 7)}-01`, end };
    case "lastMonth": {
      const first = isoFromLocalDate(new Date(today.getFullYear(), today.getMonth() - 1, 1));
      const last = isoFromLocalDate(new Date(today.getFullYear(), today.getMonth(), 0));
      return { start: first, end: last };
    }
    case "all":
      return { start: firstWorkoutDate && firstWorkoutDate < end ? firstWorkoutDate : end, end };
  }
}

/** The custom range as a draft, so the sheet opens on what is applied. */
export function draftFromChoice(choice: RangeChoice): RangeDraft {
  return typeof choice === "string" ? EMPTY_RANGE_DRAFT : { start: choice.start, end: choice.end };
}

export type RangeCell = {
  /** Inside the band, ends included, with both ends set. */
  inBand: boolean;
  isStart: boolean;
  isEnd: boolean;
  /** The band's left end is rounded here: its start, or the first band day of a row. */
  roundLeft: boolean;
  roundRight: boolean;
};

/**
 * Per cell of one grid row (monthGrid's week, nulls for days outside the
 * month): where the continuous band runs and where it rounds. The band
 * rounds at the range's ends and where it wraps to the next row or stops
 * at the month's edge.
 */
export function rangeRowCells(week: readonly (string | null)[], draft: RangeDraft): RangeCell[] {
  const range = draftRange(draft);
  const flags = week.map((iso) => iso != null && range != null && iso >= range.start && iso <= range.end);
  return week.map((iso, i) => ({
    inBand: flags[i],
    isStart: iso != null && iso === draft.start,
    isEnd: iso != null && iso === (draft.end ?? null),
    roundLeft: flags[i] && (i === 0 || !flags[i - 1]),
    roundRight: flags[i] && (i === week.length - 1 || !flags[i + 1]),
  }));
}

// ---------------------------------------------------------------------------
// Muscle groups
// ---------------------------------------------------------------------------

export const DISPLAY_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "abs",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
] as const;
export type DisplayGroup = (typeof DISPLAY_GROUPS)[number];

export const DISPLAY_GROUP_LABELS: Record<DisplayGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  abs: "Abs",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
};

/** Canonical muscle to its display group. Forearms, adductors, abductors and neck have none. */
export function displayGroupOf(muscle: CanonicalMuscle): DisplayGroup | null {
  switch (muscle) {
    case "lats":
    case "upper back":
    case "traps":
    case "lower back":
      return "back";
    case "chest":
    case "shoulders":
    case "biceps":
    case "triceps":
    case "abs":
    case "quads":
    case "hamstrings":
    case "glutes":
    case "calves":
      return muscle;
    default:
      return null;
  }
}

function canonicalPrimary(raw: string | null | undefined): CanonicalMuscle | null {
  const m = canonMuscle(raw);
  return isCanonicalMuscle(m) ? m : null;
}

// ---------------------------------------------------------------------------
// The index
// ---------------------------------------------------------------------------

export type ProgressSession = {
  workoutId: string;
  /** YYYY-MM-DD. */
  date: string;
  summary: SessionSummary;
};

export type TrackedExercise = {
  id: string;
  name: string;
  equipment: string | null;
  weightType: string | null;
  /** Rep-based, not cardio, not bodyweight or assisted: it has a weight to chart. */
  weighted: boolean;
  /** Finished sessions, oldest first. */
  sessions: ProgressSession[];
};

/** One counted set in a finished workout, for the muscle counts. */
type SetDay = { date: string; muscle: CanonicalMuscle | null };

export type TimelineEntry = {
  setId: string;
  exerciseId: string;
  exerciseName: string;
  weightType: string | null;
  weight: string | null;
  weight_value: number | null;
  reps: number | null;
  /** YYYY-MM-DD. */
  date: string;
  /** "First 135 lb deadlift", or null for a plain PR. */
  milestone: string | null;
};

export type ProgressIndex = {
  exercises: Map<string, TrackedExercise>;
  setDays: SetDay[];
  /** Every finished workout's date, one per workout, sorted. */
  workoutDates: string[];
  firstWorkoutDate: string | null;
  /** PR and milestone sets, newest first, across all time. */
  timeline: TimelineEntry[];
};

/** Plate milestones on a barbell lift, in each unit. */
export const PLATE_MILESTONES: Record<WeightUnit, readonly number[]> = {
  lb: [135, 225, 315, 405],
  kg: [60, 100, 140, 180],
};

/** The lifts whose first set at or above bodyweight is a milestone. */
export const BODYWEIGHT_MILESTONE_LIFTS: Readonly<Record<string, string>> = {
  "85495e85-bd72-445d-a6c8-5961f17ec2e5": "squat", // Barbell Squat
  "034ebb98-56b3-4073-a726-1709d14b4455": "deadlift", // Barbell Deadlift
};

/** A tolerance for weights converted between units (61.235 kg is 135 lb). */
const EPS = 0.05;

/** "deadlift" from "Barbell Deadlift", the lift's word in a milestone. */
function liftWord(name: string): string {
  const stripped = name.replace(/^barbell\s+/i, "").trim();
  return stripped.charAt(0).toLowerCase() + stripped.slice(1);
}

/** 135, 102.5: a weight in copy, without float noise. */
function weightText(v: number): string {
  return String(Math.round(v * 10) / 10);
}

function isWeightedExercise(
  exercise: NonNullable<ProgressScanRow["exercises"]>,
  bodyweight: number | null,
  sets: readonly ProgressSetRow[],
): boolean {
  if (isCardio(exercise)) return false;
  if (exercise.weight_type === "bodyweight" || exercise.weight_type === "assisted") return false;
  return !isRepBased(exercise, bodyweight, sets);
}

/**
 * One pass over the scan. `prSetIds` defaults to `markPrSets` over the same
 * rows; a caller that already has them passes them in.
 */
export function buildProgressIndex(
  rows: readonly ProgressScanRow[],
  bodyweight: number | null,
  unit: WeightUnit,
  prSetIds: ReadonlySet<string> = markPrSets(rows, bodyweight).prSetIds,
): ProgressIndex {
  type Group = {
    exercise: NonNullable<ProgressScanRow["exercises"]>;
    byWorkout: Map<string, { date: string; sets: ProgressSetRow[] }>;
  };
  const groups = new Map<string, Group>();
  const setDays: SetDay[] = [];
  const workouts = new Map<string, string>();

  for (const row of rows) {
    const date = row.workouts?.workout_date;
    if (!row.workouts?.finished_at || !date || !row.exercises) continue;
    workouts.set(row.workout_id, date);
    const done = countedSets(row.sets);
    if (done.length === 0) continue;
    const muscle = canonicalPrimary(row.exercises.primary_muscle);
    for (let i = 0; i < done.length; i += 1) setDays.push({ date, muscle });
    let g = groups.get(row.exercise_id);
    if (!g) groups.set(row.exercise_id, (g = { exercise: row.exercises, byWorkout: new Map() }));
    const session = g.byWorkout.get(row.workout_id) ?? { date, sets: [] };
    session.sets.push(...done);
    g.byWorkout.set(row.workout_id, session);
  }

  const exercises = new Map<string, TrackedExercise>();
  const timeline: (TimelineEntry & { order: string })[] = [];
  const milestones = PLATE_MILESTONES[unit];

  for (const [id, g] of groups) {
    const ordered = [...g.byWorkout].sort(([, a], [, b]) => a.date.localeCompare(b.date));
    const allSets = ordered.flatMap(([, s]) => s.sets);
    const sessions: ProgressSession[] = ordered.map(([workoutId, s]) => ({
      workoutId,
      date: s.date,
      summary: summarizeSession(
        [...s.sets].sort((a, b) => a.position - b.position),
        g.exercise,
        bodyweight,
      ),
    }));
    exercises.set(id, {
      id,
      name: g.exercise.name,
      equipment: g.exercise.equipment,
      weightType: g.exercise.weight_type,
      weighted: isWeightedExercise(g.exercise, bodyweight, allSets),
      sessions,
    });

    // PRs and milestones, walked in logged order: by date, then the order
    // the sets were logged in that workout.
    const barbell = g.exercise.equipment === "barbell";
    const bwLift = BODYWEIGHT_MILESTONE_LIFTS[id];
    let crossed = -Infinity;
    let bwDone = false;
    for (const [, s] of ordered) {
      for (const set of setsInLoggedOrder(s.sets)) {
        const load = effectiveLoad(set, g.exercise, bodyweight);
        let milestone: string | null = null;
        if (load != null && (set.reps ?? 0) > 0) {
          if (barbell) {
            const reached = milestones.filter((m) => m > crossed && load >= m - EPS);
            if (reached.length > 0) {
              const top = reached[reached.length - 1];
              crossed = top;
              milestone = `First ${top} ${unit} ${liftWord(g.exercise.name)}`;
            }
          }
          if (bwLift && !bwDone && bodyweight != null && bodyweight > 0 && load >= bodyweight - EPS) {
            bwDone = true;
            milestone ??= `First ${bwLift} at bodyweight, ${weightText(load)} ${unit}`;
          }
        }
        if (milestone == null && !prSetIds.has(set.id)) continue;
        timeline.push({
          setId: set.id,
          exerciseId: id,
          exerciseName: g.exercise.name,
          weightType: g.exercise.weight_type,
          weight: set.weight,
          weight_value: set.weight_value,
          reps: set.reps,
          date: s.date,
          milestone,
          order: `${set.created_at ?? ""}|${String(set.position).padStart(6, "0")}`,
        });
      }
    }
  }

  timeline.sort((a, b) => b.date.localeCompare(a.date) || b.order.localeCompare(a.order));
  const workoutDates = [...workouts.values()].sort();
  return {
    exercises,
    setDays,
    workoutDates,
    firstWorkoutDate: workoutDates[0] ?? null,
    timeline: timeline.map(({ order: _o, ...e }) => e),
  };
}

// ---------------------------------------------------------------------------
// Muscles worked
// ---------------------------------------------------------------------------

/** Average sets a week at or above this lights a region as primary. */
export const PRIMARY_SETS_PER_WEEK = 10;

/** Sets per canonical muscle in the range. */
function setsByMuscle(index: ProgressIndex, range: { start: string; end: string }): Map<CanonicalMuscle, number> {
  const out = new Map<CanonicalMuscle, number>();
  for (const s of index.setDays) {
    if (!s.muscle || !inRange(s.date, range)) continue;
    out.set(s.muscle, (out.get(s.muscle) ?? 0) + 1);
  }
  return out;
}

export type MusclesWorked = {
  /** Average sets a week per region. */
  perWeek: Partial<Record<BodyRegion, number>>;
  /** For BodyDiagram: 10 or more a week primary, any fewer secondary. */
  highlights: BodyHighlights;
  /** Display groups with and without sets, for the spoken label. */
  trained: DisplayGroup[];
  untrained: DisplayGroup[];
};

/**
 * Per region, average sets a week across the range. A set counts once
 * toward each region its primary muscle lights (MUSCLE_REGIONS).
 */
export function musclesWorked(index: ProgressIndex, range: { start: string; end: string }): MusclesWorked {
  const byMuscle = setsByMuscle(index, range);
  const weeks = weeksInRange(range);
  const perRegion = new Map<BodyRegion, number>();
  for (const [muscle, n] of byMuscle) {
    for (const r of MUSCLE_REGIONS[muscle]) perRegion.set(r, (perRegion.get(r) ?? 0) + n);
  }
  const perWeek: Partial<Record<BodyRegion, number>> = {};
  const primary: BodyRegion[] = [];
  const secondary: BodyRegion[] = [];
  for (const [r, n] of perRegion) {
    const v = n / weeks;
    perWeek[r] = v;
    if (v >= PRIMARY_SETS_PER_WEEK) primary.push(r);
    else if (n > 0) secondary.push(r);
  }
  const lit = (m: CanonicalMuscle, set: BodyRegion[]) => MUSCLE_REGIONS[m].some((r) => set.includes(r));
  const muscles = [...byMuscle.keys()];
  const primaryMuscles = muscles.filter((m) => lit(m, primary));
  const secondaryMuscles = muscles.filter((m) => !primaryMuscles.includes(m) && lit(m, secondary));

  const groupSets = new Map<DisplayGroup, number>();
  for (const [m, n] of byMuscle) {
    const g = displayGroupOf(m);
    if (g) groupSets.set(g, (groupSets.get(g) ?? 0) + n);
  }
  return {
    perWeek,
    highlights: { primary, secondary, primaryMuscles, secondaryMuscles },
    trained: DISPLAY_GROUPS.filter((g) => (groupSets.get(g) ?? 0) > 0),
    untrained: DISPLAY_GROUPS.filter((g) => (groupSets.get(g) ?? 0) === 0),
  };
}

/** "Muscles worked. Trained chest, back and quads. Not trained calves." */
export function musclesWorkedLabel(m: Pick<MusclesWorked, "trained" | "untrained">): string {
  const words = (gs: readonly DisplayGroup[]) => listWords(gs.map((g) => DISPLAY_GROUP_LABELS[g].toLowerCase()));
  const parts = ["Muscles worked"];
  parts.push(m.trained.length > 0 ? `Trained ${words(m.trained)}` : "Nothing trained in this range");
  if (m.untrained.length > 0 && m.trained.length > 0) parts.push(`Not trained ${words(m.untrained)}`);
  return `${parts.join(". ")}.`;
}

/** "a", "a and b", "a, b and c". */
function listWords(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export type WeeklySets = { group: DisplayGroup; label: string; perWeek: number };

/** Average sets a week per display group, in DISPLAY_GROUPS order. */
export function weeklySetsByGroup(index: ProgressIndex, range: { start: string; end: string }): WeeklySets[] {
  const byMuscle = setsByMuscle(index, range);
  const weeks = weeksInRange(range);
  const totals = new Map<DisplayGroup, number>();
  for (const [m, n] of byMuscle) {
    const g = displayGroupOf(m);
    if (g) totals.set(g, (totals.get(g) ?? 0) + n);
  }
  return DISPLAY_GROUPS.map((group) => ({
    group,
    label: DISPLAY_GROUP_LABELS[group],
    perWeek: (totals.get(group) ?? 0) / weeks,
  }));
}

/** The usual growth range of sets a week, and the bars' scale. */
export const GROWTH_BAND = { low: 10, high: 20, scale: 24 } as const;

export type SetsBand = "under" | "in" | "over";

/** Where a weekly set count sits against the growth range. */
export function setsBand(perWeek: number): SetsBand {
  if (perWeek < GROWTH_BAND.low) return "under";
  if (perWeek > GROWTH_BAND.high) return "over";
  return "in";
}

/** A weekly set count for display: whole, or "<1" between zero and one. */
export function formatPerWeek(v: number): string {
  if (v <= 0) return "0";
  if (v < 1) return "<1";
  return String(Math.round(v));
}

// ---------------------------------------------------------------------------
// The gap tip
// ---------------------------------------------------------------------------

/** The order the tip checks groups in; the first with no recent work wins. */
export const GAP_ORDER: readonly DisplayGroup[] = [
  "hamstrings",
  "glutes",
  "calves",
  "back",
  "chest",
  "shoulders",
  "quads",
];

/** Two beginner catalog exercises per group the tip can name. */
export const GAP_EXERCISES: Readonly<Partial<Record<DisplayGroup, readonly [GapExercise, GapExercise]>>> = {
  hamstrings: [
    { id: "f5521250-381d-4aec-819c-833202e1d481", name: "Dumbbell Romanian Deadlift" },
    { id: "f8fa4979-f9fa-459a-9f82-4c87ea7c6c50", name: "Standing Leg Curl" },
  ],
  glutes: [
    { id: "c67f5050-77ad-42de-8a61-36515b915869", name: "Dumbbell Hip Thrust" },
    { id: "0f2b1238-5acf-455c-9770-884152c6be7d", name: "Barbell Glute Bridge" },
  ],
  calves: [
    { id: "4433df75-1d5a-4ad1-a252-93b67398c2e5", name: "Standing Dumbbell Calf Raise" },
    { id: "935a5844-cc7b-4eb2-a8c7-cd37492d1e73", name: "Seated Calf Raise" },
  ],
  back: [
    { id: "5e3e2c88-2b18-42fb-b39d-c6aca546d3be", name: "One-Arm Dumbbell Row" },
    { id: "653288a1-8c39-4840-a2bc-c6eb64790c82", name: "Wide-Grip Lat Pulldown" },
  ],
  chest: [
    { id: "05510482-9385-455f-85b4-96aef279939c", name: "Dumbbell Bench Press" },
    { id: "9d7eb3e6-9f33-422d-b3b6-de5eaa503982", name: "Pushups" },
  ],
  shoulders: [
    { id: "6db0743b-b1be-4071-b663-af358c7f47bb", name: "Dumbbell Shoulder Press" },
    { id: "463a3682-c764-4971-a1fc-db0e925d0735", name: "Side Lateral Raise" },
  ],
  quads: [
    { id: "43284cd1-4bb4-44c7-87b6-617ed5f03dbf", name: "Goblet Squat" },
    { id: "d1d858b3-deb2-4e0d-91f6-3004a14f0f44", name: "Leg Press" },
  ],
};

export type GapExercise = { id: string; name: string };
export type GapTip = { group: DisplayGroup; muscle: string; exercises: readonly [GapExercise, GapExercise] };

/**
 * The tip under the body map, or null. Only for a range of 7 days or
 * longer, and only for someone training regularly: finished workouts in at
 * least two different weeks of the last 28 days. Then the first group in
 * GAP_ORDER with no sets in the last 14 days.
 */
export function gapTip(index: ProgressIndex, range: { start: string; end: string }, today: Date): GapTip | null {
  if (rangeDays(range) < 7) return null;
  const end = isoFromLocalDate(today);
  const last28 = { start: addDays(end, -27), end };
  const weeks = new Set(index.workoutDates.filter((d) => inRange(d, last28)).map(weekStartOf));
  if (weeks.size < 2) return null;
  const recent = new Set<DisplayGroup>();
  const last14 = { start: addDays(end, -13), end };
  for (const s of index.setDays) {
    if (!s.muscle || !inRange(s.date, last14)) continue;
    const g = displayGroupOf(s.muscle);
    if (g) recent.add(g);
  }
  for (const group of GAP_ORDER) {
    const exercises = GAP_EXERCISES[group];
    if (!recent.has(group) && exercises) {
      return { group, muscle: DISPLAY_GROUP_LABELS[group].toLowerCase(), exercises };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Strength levels, restyled
// ---------------------------------------------------------------------------

export type StrengthProgress = {
  level: StrengthLevelName;
  /** Null at Elite. */
  next: StrengthLevelName | null;
  /** How far into the current level, 0 to 1. 1 at Elite. */
  fill: number;
  /** Kg to the next level. Null at Elite. */
  toNextKg: number | null;
};

/** The row's bar: the fill within the current level, from strengthBarPosition. */
export function strengthProgress(estimatedMaxKg: number, thresholds: StrengthThresholds): StrengthProgress {
  const l = strengthLevel(estimatedMaxKg, thresholds);
  if (l.next == null) return { level: l.level, next: null, fill: 1, toNextKg: null };
  const within = strengthBarPosition(estimatedMaxKg, thresholds) * STRENGTH_LEVELS.length - l.index;
  return { level: l.level, next: l.next, fill: Math.min(1, Math.max(0, within)), toNextKg: l.toNext };
}

// ---------------------------------------------------------------------------
// Since you started
// ---------------------------------------------------------------------------

export type SinceStarted = {
  exerciseId: string;
  name: string;
  /** Top working-set weight of the first session. */
  first: number;
  /** The heaviest top set since. */
  best: number;
  gain: number;
  /** Per-session top-set weight, oldest first. */
  series: number[];
  sessions: number;
};

export const SINCE_STARTED_LIMIT = 4;
/** Sessions an exercise needs before it shows a trend anywhere. */
export const MIN_TREND_SESSIONS = 3;

/** Weighted exercises by finished sessions, most first, ties by name. */
function rankByUse(exercises: Iterable<TrackedExercise>, count: (e: TrackedExercise) => number): TrackedExercise[] {
  return [...exercises]
    .filter((e) => e.weighted && count(e) > 0)
    .sort((a, b) => count(b) - count(a) || a.name.localeCompare(b.name));
}

/**
 * Up to four weighted exercises with the most finished sessions all time,
 * three sessions at least. Not range dependent.
 */
export function sinceStarted(index: ProgressIndex, limit = SINCE_STARTED_LIMIT): SinceStarted[] {
  const out: SinceStarted[] = [];
  for (const e of rankByUse(index.exercises.values(), (x) => x.sessions.length)) {
    if (out.length >= limit) break;
    const series = e.sessions.map((s) => s.summary.heaviest).filter((v): v is number => v != null);
    if (series.length < MIN_TREND_SESSIONS) continue;
    const first = series[0];
    const best = Math.max(...series);
    out.push({ exerciseId: e.id, name: e.name, first, best, gain: best - first, series, sessions: series.length });
  }
  return out;
}

// ---------------------------------------------------------------------------
// PR timeline
// ---------------------------------------------------------------------------

/** Every PR and milestone set in the range, newest first. */
export function prTimeline(index: ProgressIndex, range: { start: string; end: string }): TimelineEntry[] {
  return index.timeline.filter((e) => inRange(e.date, range));
}

export const PR_TIMELINE_PREVIEW = 5;

// ---------------------------------------------------------------------------
// Trends (Pro)
// ---------------------------------------------------------------------------

export const TRENDS_LIMIT = 4;

function sessionsIn(e: TrackedExercise, range: { start: string; end: string }): ProgressSession[] {
  return e.sessions.filter((s) => inRange(s.date, range));
}

/** Finished sessions of an exercise inside the range. */
export function sessionCountInRange(index: ProgressIndex, exerciseId: string, range: { start: string; end: string }): number {
  const e = index.exercises.get(exerciseId);
  return e ? sessionsIn(e, range).length : 0;
}

/** The Edit sheet's list: every weighted exercise, most-logged first. */
export function weightedExercisesByUse(index: ProgressIndex): { id: string; name: string; sessions: number }[] {
  return rankByUse(index.exercises.values(), (e) => e.sessions.length).map((e) => ({
    id: e.id,
    name: e.name,
    sessions: e.sessions.length,
  }));
}

/**
 * The exercises Trends shows. Pinned ids that are still weighted exercises
 * of this user, in pin order, when there are any. Otherwise up to four
 * weighted exercises with the most finished sessions in the range, three
 * at least each.
 */
export function trendSelection(
  index: ProgressIndex,
  range: { start: string; end: string },
  pins: readonly string[] = [],
): { ids: string[]; pinned: boolean } {
  const pinned = pins.filter((id) => index.exercises.get(id)?.weighted).slice(0, TRENDS_LIMIT);
  if (pinned.length > 0) return { ids: pinned, pinned: true };
  const ids = rankByUse(index.exercises.values(), (e) => sessionsIn(e, range).length)
    .filter((e) => sessionsIn(e, range).length >= MIN_TREND_SESSIONS)
    .slice(0, TRENDS_LIMIT)
    .map((e) => e.id);
  return { ids, pinned: false };
}

/** Toggles a pin, holding at most four. A fifth is refused. */
export function togglePin(pins: readonly string[], id: string): string[] {
  if (pins.includes(id)) return pins.filter((p) => p !== id);
  if (pins.length >= TRENDS_LIMIT) return [...pins];
  return [...pins, id];
}

export type EstimatedMaxTrend = {
  exerciseId: string;
  name: string;
  /** Running-max estimated max per session in the range, oldest first. */
  points: { date: string; value: number }[];
  /** Best on or before the range start, or the first session in range. */
  start: number;
  /** Running max at the range end. */
  end: number;
  gain: number;
  /** (end - start) / start; 0 when start is 0. */
  gainPercent: number;
  /** Sessions in the range that raised the running max. */
  newBests: number;
  sessions: number;
};

/**
 * The step chart's data: the running maximum of the session best estimated
 * max (summarizeSession, the exercise screen's number), seeded with the
 * best before the range. Null when the exercise has no session in range
 * with an estimated max.
 */
export function estimatedMaxTrend(
  index: ProgressIndex,
  exerciseId: string,
  range: { start: string; end: string },
): EstimatedMaxTrend | null {
  const e = index.exercises.get(exerciseId);
  if (!e) return null;
  let prior: number | null = null;
  for (const s of e.sessions) {
    if (s.date >= range.start) break;
    const v = s.summary.estimatedMax;
    if (v != null && (prior == null || v > prior)) prior = v;
  }
  const points: { date: string; value: number }[] = [];
  let running = prior;
  let newBests = 0;
  for (const s of sessionsIn(e, range)) {
    const v = s.summary.estimatedMax;
    if (v == null) continue;
    if (running == null) running = v;
    else if (v > running + 1e-9) {
      running = v;
      newBests += 1;
    }
    points.push({ date: s.date, value: running });
  }
  if (points.length === 0 || running == null) return null;
  const start = prior ?? points[0].value;
  const end = running;
  return {
    exerciseId,
    name: e.name,
    points,
    start,
    end,
    gain: end - start,
    gainPercent: start > 0 ? (end - start) / start : 0,
    newBests,
    sessions: points.length,
  };
}

/** Strength gain rows, largest percent first. */
export function strengthGains(trends: readonly EstimatedMaxTrend[]): EstimatedMaxTrend[] {
  return [...trends].sort((a, b) => b.gainPercent - a.gainPercent || a.name.localeCompare(b.name));
}

/** "+12%", or "No change" at zero or below. */
export function gainPercentLabel(gainPercent: number): string {
  const pct = Math.round(gainPercent * 100);
  return pct > 0 ? `+${pct}%` : "No change";
}

/** "6 new bests", "1 new best", "No new bests". Digits: it is data. */
export function newBestsLabel(n: number): string {
  if (n === 0) return "No new bests";
  return `${n} new ${n === 1 ? "best" : "bests"}`;
}

/** A load for display: whole, or one decimal when it has one. */
export function formatLoad(v: number): string {
  return weightText(v);
}

// ---------------------------------------------------------------------------
// Trends chart geometry
// ---------------------------------------------------------------------------

/** Where a date falls across a range, 0 at the start and 1 at the end, clamped. */
export function dateFraction(iso: string, range: { start: string; end: string }): number {
  const span = daysBetween(range.start, range.end);
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, daysBetween(range.start, iso) / span));
}

export type ChartDomain = { min: number; max: number; ticks: [number, number] };

/** The smallest of 1, 2, 2.5 (from 25 up), 5 and 10 times a power of ten at or above `raw`. */
function niceStep(raw: number): number {
  const p = 10 ** Math.floor(Math.log10(raw));
  const steps = p >= 10 ? [1, 2, 2.5, 5, 10] : [1, 2, 5, 10];
  for (const n of steps) if (n * p >= raw - 1e-9) return n * p;
  return 10 * p;
}

/**
 * The y domain of an estimated max chart: three equal steps of a round
 * size, padded about 15% of the data's spread below the lowest value and
 * above the highest, so the line never sits on the floor or the ceiling.
 * A flat series pads 5% of its value. The two ticks are the gridlines.
 * Never below zero for data at or above zero.
 */
export function chartDomain(values: readonly number[]): ChartDomain {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo;
  const pad = span > 0 ? span * 0.15 : Math.max(Math.abs(hi) * 0.05, 1);
  const low = lo - pad;
  const high = hi + pad;
  let step = niceStep((high - low) / 3);
  for (;;) {
    let min = Math.floor(low / step + 1e-9) * step;
    if (lo >= 0) min = Math.max(0, min);
    const max = min + 3 * step;
    if (max >= high - 1e-9) return { min, max, ticks: [min + step, min + 2 * step] };
    step = niceStep(step * 1.0001);
  }
}

export type ChartPoint = { x: number; y: number };

/** Two decimals, no trailing zeros, for SVG path data. */
function num(v: number): string {
  return String(Math.round(v * 100) / 100);
}

/**
 * The corners of a running-max step line: across at the old value to each
 * session, then up to its new value. Repeated and in-line points are
 * dropped, so every inner vertex is a real corner.
 */
export function stepVertices(points: readonly ChartPoint[]): ChartPoint[] {
  const raw: ChartPoint[] = [];
  points.forEach((p, i) => {
    if (i > 0) raw.push({ x: p.x, y: points[i - 1].y });
    raw.push(p);
  });
  const out: ChartPoint[] = [];
  for (const p of raw) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 1e-6 && Math.abs(last.y - p.y) < 1e-6) continue;
    const prev = out[out.length - 2];
    if (
      prev &&
      last &&
      ((Math.abs(prev.x - last.x) < 1e-6 && Math.abs(last.x - p.x) < 1e-6) ||
        (Math.abs(prev.y - last.y) < 1e-6 && Math.abs(last.y - p.y) < 1e-6))
    ) {
      out[out.length - 1] = p;
      continue;
    }
    out.push(p);
  }
  return out;
}

/**
 * SVG path data for a step line with each corner rounded by a quadratic
 * curve of radius `r` (less where a segment is too short for it), and the
 * line's length for a draw-in dash. The length counts the corners square,
 * a slight overestimate, which only delays the draw-in's first pixel.
 */
export function roundedStepPath(vertices: readonly ChartPoint[], r: number): { d: string; length: number } {
  if (vertices.length === 0) return { d: "", length: 0 };
  const dist = (a: ChartPoint, b: ChartPoint) => Math.hypot(b.x - a.x, b.y - a.y);
  const toward = (a: ChartPoint, b: ChartPoint, t: number): ChartPoint => {
    const len = dist(a, b);
    return len === 0 ? a : { x: a.x + ((b.x - a.x) * t) / len, y: a.y + ((b.y - a.y) * t) / len };
  };
  let d = `M${num(vertices[0].x)},${num(vertices[0].y)}`;
  let length = 0;
  for (let i = 1; i < vertices.length; i += 1) length += dist(vertices[i - 1], vertices[i]);
  for (let i = 1; i < vertices.length - 1; i += 1) {
    const a = vertices[i - 1];
    const v = vertices[i];
    const b = vertices[i + 1];
    const rr = Math.min(r, dist(a, v) / 2, dist(v, b) / 2);
    const p1 = toward(v, a, rr);
    const p2 = toward(v, b, rr);
    d += `L${num(p1.x)},${num(p1.y)}Q${num(v.x)},${num(v.y)} ${num(p2.x)},${num(p2.y)}`;
  }
  const end = vertices[vertices.length - 1];
  if (vertices.length > 1) d += `L${num(end.x)},${num(end.y)}`;
  return { d, length };
}

/** Which points of a trend raised the best: the dots on the chart. */
export function newBestFlags(trend: { points: readonly { value: number }[]; start: number }): boolean[] {
  return trend.points.map((p, i) =>
    i === 0 ? p.value > trend.start + 1e-9 : p.value > trend.points[i - 1].value + 1e-9,
  );
}

/** The last of ascending `xs` at or before `x`, or 0 before the first: the session a scrub is on. */
export function indexAtOrBefore(xs: readonly number[], x: number): number {
  let found = 0;
  for (let i = 0; i < xs.length; i += 1) {
    if (xs[i] <= x + 1e-9) found = i;
    else break;
  }
  return found;
}
