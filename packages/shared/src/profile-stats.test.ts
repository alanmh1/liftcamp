import { describe, expect, it } from "vitest";

import { barAxis, compactNumber, trainingDaysByWeek } from "./profile-stats";

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
