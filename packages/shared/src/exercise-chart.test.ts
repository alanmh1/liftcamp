import { describe, expect, it } from "vitest";

import type { ExerciseSession, SessionSummary } from "./exercise-progress";
import {
  chartChangeLabel,
  chartValueLabel,
  exerciseChartView,
  nearestIndex,
  sessionSeries,
  showsExerciseChart,
} from "./exercise-chart";

function session(workoutId: string, workoutDate: string, estimatedMax: number | null, heaviest = estimatedMax): ExerciseSession {
  const summary: SessionSummary = {
    estimatedMax,
    bestSet: null,
    heaviest,
    volume: 0,
    mostReps: null,
    totalReps: 0,
    sets: 1,
  };
  return { workoutId, workoutDate, summary };
}

const TODAY = new Date(2026, 10, 23);

describe("sessionSeries", () => {
  it("keeps one point per date, the best, oldest first, and drops sessions without a value", () => {
    const s = sessionSeries(
      [session("c", "2026-11-10", 100), session("a", "2026-09-01", 90), session("b", "2026-11-10", 105), session("d", "2026-10-01", null)],
      "estimatedMax",
    );
    expect(s).toEqual([
      { date: "2026-09-01", value: 90, workoutId: "a" },
      { date: "2026-11-10", value: 105, workoutId: "b" },
    ]);
  });

  it("reads the heaviest weight for that metric", () => {
    expect(sessionSeries([session("a", "2026-09-01", 120, 100)], "heaviest")[0].value).toBe(100);
  });
});

describe("showsExerciseChart", () => {
  const two = [session("a", "2026-09-01", 90), session("b", "2026-10-01", 95)];
  it("needs two dates with an estimated max", () => {
    expect(showsExerciseChart({ weight_type: "weight" }, false, two)).toBe(true);
    expect(showsExerciseChart({ weight_type: "weight" }, false, [two[0], session("c", "2026-09-01", 99)])).toBe(false);
    expect(showsExerciseChart({ weight_type: "weight" }, false, null)).toBe(false);
  });

  it("is off for cardio, bodyweight, assisted and rep-based exercises", () => {
    expect(showsExerciseChart({ set_type: "cardio" }, false, two)).toBe(false);
    expect(showsExerciseChart({ weight_type: "bodyweight" }, false, two)).toBe(false);
    expect(showsExerciseChart({ weight_type: "assisted" }, false, two)).toBe(false);
    expect(showsExerciseChart({ weight_type: "weight" }, true, two)).toBe(false);
  });
});

describe("exerciseChartView", () => {
  const series = sessionSeries(
    [session("a", "2026-01-10", 80), session("b", "2026-06-01", 90), session("c", "2026-10-01", 95), session("d", "2026-11-20", 100.5)],
    "estimatedMax",
  );

  it("measures the change from the last value before the range", () => {
    const v = exerciseChartView(series, "3M", TODAY);
    expect(v.range).toEqual({ start: "2026-08-24", end: "2026-11-23", preset: "3M" });
    expect(v.points.map((p) => p.workoutId)).toEqual(["c", "d"]);
    expect(v.current).toBe(100.5);
    expect(v.change).toBeCloseTo(10.5);
  });

  it("measures from the first point when nothing comes before", () => {
    const v = exerciseChartView(series, "All", TODAY);
    expect(v.range.start).toBe("2026-01-10");
    expect(v.change).toBeCloseTo(20.5);
  });

  it("has no change with nothing in the range", () => {
    const old = sessionSeries([session("a", "2025-01-10", 80), session("b", "2025-02-10", 85)], "estimatedMax");
    const v = exerciseChartView(old, "3M", TODAY);
    expect(v.points).toEqual([]);
    expect(v.current).toBe(85);
    expect(v.change).toBeNull();
  });
});

describe("chartChangeLabel", () => {
  it("signs the change and names the range", () => {
    expect(chartChangeLabel(12.4, "6M", "kg")).toBe("+12.4 kg in 6 months");
    expect(chartChangeLabel(-2.5, "3M", "lbs")).toBe("−2.5 lbs in 3 months");
    expect(chartChangeLabel(0.01, "1Y", "lbs")).toBe("No change in 1 year");
    expect(chartChangeLabel(1040, "All", "lbs")).toBe("+1,040 lbs since you started");
    expect(chartChangeLabel(null, "6M", "kg")).toBeNull();
  });

  it("formats a value to one decimal at most", () => {
    expect(chartValueLabel(100.46, "kg")).toBe("100.5 kg");
    expect(chartValueLabel(225, "lbs")).toBe("225 lbs");
  });
});

describe("nearestIndex", () => {
  it("finds the closest point, the earlier on a tie", () => {
    expect(nearestIndex([0, 10, 20], 14)).toBe(1);
    expect(nearestIndex([0, 10, 20], 16)).toBe(2);
    expect(nearestIndex([0, 10, 20], 5)).toBe(0);
    expect(nearestIndex([], 5)).toBe(-1);
  });
});
