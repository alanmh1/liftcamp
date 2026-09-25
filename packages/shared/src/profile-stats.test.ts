import { describe, expect, it } from "vitest";

import { barAxis, compactNumber, recentPrsByExercise, trainingDaysByWeek, type PrCandidate } from "./profile-stats";

describe("trainingDaysByWeek", () => {
  // Friday 25 Sep 2026; its week starts Monday 21 Sep.
  const today = new Date(2026, 8, 25);

  it("returns the weeks oldest first, ending with this week", () => {
    const weeks = trainingDaysByWeek([], 3, today);
    expect(weeks.map((w) => w.weekStart)).toEqual(["2026-09-07", "2026-09-14", "2026-09-21"]);
    expect(weeks.every((w) => w.days === 0)).toBe(true);
  });

  it("counts distinct days, so two workouts on one day are one", () => {
    const weeks = trainingDaysByWeek(["2026-09-21", "2026-09-21", "2026-09-23"], 1, today);
    expect(weeks).toEqual([{ weekStart: "2026-09-21", days: 2 }]);
  });

  it("puts Sunday in the week that started the Monday before", () => {
    const weeks = trainingDaysByWeek(["2026-09-20", "2026-09-14"], 2, today);
    expect(weeks).toEqual([
      { weekStart: "2026-09-14", days: 2 },
      { weekStart: "2026-09-21", days: 0 },
    ]);
  });

  it("ignores dates outside the window and malformed dates", () => {
    const weeks = trainingDaysByWeek(["2026-08-01", "2026-10-05", "not a date"], 2, today);
    expect(weeks.every((w) => w.days === 0)).toBe(true);
  });

  it("crosses a month and a year boundary", () => {
    const weeks = trainingDaysByWeek(["2025-12-31", "2026-01-02"], 1, new Date(2026, 0, 2));
    expect(weeks).toEqual([{ weekStart: "2025-12-29", days: 2 }]);
  });
});

describe("compactNumber", () => {
  it.each([
    [0, "0"],
    [999.4, "999"],
    [1000, "1k"],
    [1500, "1.5k"],
    [9940, "9.9k"],
    [9960, "10k"],
    [214_300, "214k"],
    [999_600, "1M"],
    [1_250_000, "1.3M"],
    [-5, "0"],
  ])("%d is %s", (n, out) => {
    expect(compactNumber(n)).toBe(out);
  });
});

describe("barAxis", () => {
  it("gives whole-number ticks for small counts", () => {
    expect(barAxis(3, true)).toEqual({ top: 3, ticks: [0, 1, 2, 3] });
    expect(barAxis(2, true)).toEqual({ top: 2, ticks: [0, 1, 2] });
    expect(barAxis(7, true)).toEqual({ top: 8, ticks: [0, 2, 4, 6, 8] });
  });

  it("rounds a volume axis to round thousands", () => {
    expect(barAxis(12_340)).toEqual({ top: 15_000, ticks: [0, 5000, 10_000, 15_000] });
  });

  it("allows 2.5 steps for non-integer data", () => {
    expect(barAxis(7)).toEqual({ top: 7.5, ticks: [0, 2.5, 5, 7.5] });
  });

  it("falls back to 0 to 1 for no data", () => {
    expect(barAxis(0)).toEqual({ top: 1, ticks: [0, 1] });
  });

  it("always reaches the maximum", () => {
    for (const max of [1, 4, 11, 99, 101, 4321, 98_765]) {
      expect(barAxis(max).top).toBeGreaterThanOrEqual(max);
      expect(barAxis(max, true).top).toBeGreaterThanOrEqual(max);
    }
  });
});

describe("recentPrsByExercise", () => {
  const pr = (id: string, exerciseId: string, workoutDate: string, createdAt: string, position = 0) =>
    ({ id, exerciseId, workoutDate, createdAt, position }) satisfies PrCandidate & { id: string };
  const ids = (prs: { id: string }[]) => prs.map((p) => p.id);

  it("keeps one row per exercise when a session ramps one lift through several PRs", () => {
    const prs = [
      pr("squat-1", "squat", "2026-09-24", "2026-09-24T10:00:00Z", 0),
      pr("squat-2", "squat", "2026-09-24", "2026-09-24T10:04:00Z", 1),
      pr("squat-3", "squat", "2026-09-24", "2026-09-24T10:08:00Z", 2),
      pr("bench-1", "bench", "2026-09-20", "2026-09-20T10:00:00Z"),
    ];
    expect(ids(recentPrsByExercise(prs, 5))).toEqual(["squat-3", "bench-1"]);
  });

  it("keeps an exercise's most recent PR across sessions, not its first", () => {
    const prs = [
      pr("row-old", "row", "2026-08-01", "2026-08-01T10:00:00Z"),
      pr("press", "press", "2026-09-10", "2026-09-10T10:00:00Z"),
      pr("row-new", "row", "2026-09-15", "2026-09-15T10:00:00Z"),
    ];
    expect(ids(recentPrsByExercise(prs, 5))).toEqual(["row-new", "press"]);
  });

  it("breaks a same-date tie between exercises by created_at", () => {
    const prs = [
      pr("deadlift", "deadlift", "2026-09-24", "2026-09-24T10:00:00Z"),
      pr("rdl", "rdl", "2026-09-24", "2026-09-24T10:30:00Z"),
    ];
    expect(ids(recentPrsByExercise(prs, 5))).toEqual(["rdl", "deadlift"]);
  });

  it("breaks a shared created_at, as routine-seeded sets have, by position", () => {
    const at = "2026-09-24T10:00:00Z";
    const prs = [pr("set-1", "squat", "2026-09-24", at, 0), pr("set-3", "squat", "2026-09-24", at, 2), pr("set-2", "squat", "2026-09-24", at, 1)];
    expect(ids(recentPrsByExercise(prs, 5))).toEqual(["set-3"]);
  });

  it("returns fewer than the limit when fewer exercises have PRs", () => {
    const prs = [
      pr("a1", "a", "2026-09-01", "2026-09-01T10:00:00Z"),
      pr("a2", "a", "2026-09-02", "2026-09-02T10:00:00Z"),
      pr("b1", "b", "2026-09-03", "2026-09-03T10:00:00Z"),
    ];
    expect(ids(recentPrsByExercise(prs, 5))).toEqual(["b1", "a2"]);
    expect(recentPrsByExercise([], 5)).toEqual([]);
  });

  it("stops at the limit, newest exercises first", () => {
    const prs = ["a", "b", "c", "d", "e", "f", "g"].map((ex, i) =>
      pr(ex, ex, `2026-09-0${i + 1}`, `2026-09-0${i + 1}T10:00:00Z`),
    );
    expect(ids(recentPrsByExercise(prs, 5))).toEqual(["g", "f", "e", "d", "c"]);
  });

  it("passes the caller's own fields through and leaves the input unsorted", () => {
    const prs = [pr("old", "a", "2026-09-01", ""), pr("new", "b", "2026-09-02", "")];
    const out = recentPrsByExercise(prs, 5);
    expect(out[0]).toBe(prs[1]);
    expect(ids(prs)).toEqual(["old", "new"]);
  });
});
