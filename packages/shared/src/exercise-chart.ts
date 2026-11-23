// The progress chart on the exercise screen's History tab and its
// fullscreen route: one point per workout date, the session's best
// estimated one-rep max (or heaviest weight), over a Trends range preset.
// The per-session numbers come from summarizeSession, so warm-up sets are
// already left out and every value matches Records and Trends.

import { isCardio } from "./cardio";
import type { ExerciseSession, ProgressExercise } from "./exercise-progress";
import { rangeFor, type DateRange, type TrendsPreset } from "./progress";

export const EXERCISE_CHART_PRESETS = ["3M", "6M", "1Y", "All"] as const satisfies readonly TrendsPreset[];
export type ExerciseChartPreset = (typeof EXERCISE_CHART_PRESETS)[number];
export const EXERCISE_CHART_DEFAULT_PRESET: ExerciseChartPreset = "6M";

export function isExerciseChartPreset(v: unknown): v is ExerciseChartPreset {
  return typeof v === "string" && (EXERCISE_CHART_PRESETS as readonly string[]).includes(v);
}

export type ExerciseChartMetric = "estimatedMax" | "heaviest";

/** Sessions with an estimated max the card needs, all time, before it shows. */
export const EXERCISE_CHART_MIN_SESSIONS = 2;

export type DatedValue = { date: string; value: number; workoutId: string };

/**
 * One point per workout date, oldest first: the highest value of the
 * metric among that date's sessions. Sessions without one (no working set
 * with a load and reps) are left out.
 */
export function sessionSeries(sessions: readonly ExerciseSession[], metric: ExerciseChartMetric): DatedValue[] {
  const byDate = new Map<string, DatedValue>();
  for (const s of sessions) {
    const value = metric === "estimatedMax" ? s.summary.estimatedMax : s.summary.heaviest;
    if (value == null) continue;
    const prev = byDate.get(s.workoutDate);
    if (!prev || value > prev.value) byDate.set(s.workoutDate, { date: s.workoutDate, value, workoutId: s.workoutId });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Whether the History tab shows the chart card: an exercise with a weight
 * to chart (not cardio, not bodyweight or assisted, not tracked by reps
 * alone) and at least two dates with an estimated max.
 */
export function showsExerciseChart(
  exercise: ProgressExercise & { set_type?: string | null },
  repBased: boolean,
  sessions: readonly ExerciseSession[] | null,
): boolean {
  if (!sessions || repBased || isCardio(exercise)) return false;
  if (exercise.weight_type === "bodyweight" || exercise.weight_type === "assisted") return false;
  return sessionSeries(sessions, "estimatedMax").length >= EXERCISE_CHART_MIN_SESSIONS;
}

export type ExerciseChartView = {
  range: DateRange;
  /** The points inside the range, oldest first. */
  points: DatedValue[];
  /** The latest value all time, for the header. Null with no points at all. */
  current: number | null;
  /**
   * The range's last value less its baseline: the last value before the
   * range when there is one, else the range's first. Null with no point
   * in the range.
   */
  change: number | null;
};

export function exerciseChartView(series: readonly DatedValue[], preset: ExerciseChartPreset, today: Date): ExerciseChartView {
  const range = rangeFor(preset, today, series[0]?.date ?? null);
  const points = series.filter((p) => p.date >= range.start && p.date <= range.end);
  let before: DatedValue | null = null;
  for (const p of series) {
    if (p.date >= range.start) break;
    before = p;
  }
  const last = points[points.length - 1];
  const baseline = before ?? points[0];
  return {
    range,
    points,
    current: series.length > 0 ? series[series.length - 1].value : null,
    change: last && baseline ? last.value - baseline.value : null,
  };
}

const RANGE_PHRASE: Record<ExerciseChartPreset, string> = {
  "3M": "in 3 months",
  "6M": "in 6 months",
  "1Y": "in 1 year",
  All: "since you started",
};

/** One decimal at most, with thousands separators. */
function load(v: number): string {
  return (Math.round(v * 10) / 10).toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/**
 * "+12.4 kg in 6 months", "−2.5 lbs in 3 months", "No change in 1 year",
 * "+40 lbs since you started". Null with nothing in the range.
 */
export function chartChangeLabel(change: number | null, preset: ExerciseChartPreset, unitLabel: string): string | null {
  if (change == null) return null;
  const rounded = Math.round(change * 10) / 10;
  if (rounded === 0) return `No change ${RANGE_PHRASE[preset]}`;
  const sign = rounded > 0 ? "+" : "−";
  return `${sign}${load(Math.abs(rounded))} ${unitLabel} ${RANGE_PHRASE[preset]}`;
}

/** "100.5 kg": a value for the header or a scrub readout. */
export function chartValueLabel(value: number, unitLabel: string): string {
  return `${load(value)} ${unitLabel}`;
}

/** The index in ascending `xs` closest to `x`, the earlier on a tie. -1 when empty. */
export function nearestIndex(xs: readonly number[], x: number): number {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < xs.length; i += 1) {
    const d = Math.abs(xs[i] - x);
    if (d < bestDist - 1e-9) {
      best = i;
      bestDist = d;
    }
  }
  return best;
}
