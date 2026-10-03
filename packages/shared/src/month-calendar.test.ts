import { describe, expect, it } from "vitest";

import {
  addMonths,
  calendarRange,
  calendarTitle,
  monthCountLine,
  monthGrid,
  monthKeyOf,
  workoutsByDay,
  workoutsInMonth,
} from "./month-calendar";

describe("monthGrid", () => {
  it("starts on Monday: September 2026 opens on a Tuesday", () => {
    const weeks = monthGrid("2026-09");
    expect(weeks[0]).toEqual([null, "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"]);
    expect(weeks).toHaveLength(5);
    expect(weeks[4]).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", null, null, null, null]);
  });

  it("puts a Sunday first of the month in the last column, with six weeks when needed", () => {
    // 1 November 2026 is a Sunday.
    const weeks = monthGrid("2026-11");
    expect(weeks[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(weeks).toHaveLength(6);
  });

  it("fits a Monday-first 28-day February in four weeks", () => {
    // 1 February 2027 is a Monday.
    const weeks = monthGrid("2027-02");
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]).toBe("2027-02-01");
    expect(weeks[3][6]).toBe("2027-02-28");
  });

  it("includes 29 February in a leap year", () => {
    expect(monthGrid("2028-02").flat()).toContain("2028-02-29");
  });

  it("has every day of the month exactly once", () => {
    const days = monthGrid("2026-10").flat().filter(Boolean);
    expect(days).toHaveLength(31);
    expect(new Set(days).size).toBe(31);
  });
});

describe("addMonths and monthKeyOf", () => {
  it("crosses year boundaries both ways", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-09", 0)).toBe("2026-09");
  });

  it("takes the month of a date", () => {
    expect(monthKeyOf("2026-09-14")).toBe("2026-09");
  });
});

describe("workoutsByDay and workoutsInMonth", () => {
  const dates = ["2026-09-01", "2026-09-01", "2026-09-03", "2026-08-31", "2026-10-02"];

  it("counts two workouts on one day as two", () => {
    expect(workoutsByDay(dates).get("2026-09-01")).toBe(2);
  });

  it("counts workouts, not days, in a month", () => {
    const byDay = workoutsByDay(dates);
    expect(workoutsInMonth(byDay, "2026-09")).toBe(3);
    expect(workoutsInMonth(byDay, "2026-08")).toBe(1);
    expect(workoutsInMonth(byDay, "2026-07")).toBe(0);
  });
});

describe("calendarRange", () => {
  const today = new Date(2026, 9, 3, 12);

  it("runs from the first workout's month to this month", () => {
    expect(calendarRange(["2026-09-10", "2026-06-02", "2026-08-01"], today)).toEqual({ first: "2026-06", last: "2026-10" });
  });

  it("is only this month with no workouts", () => {
    expect(calendarRange([], today)).toEqual({ first: "2026-10", last: "2026-10" });
  });

  it("never reaches a future month", () => {
    expect(calendarRange(["2026-11-02", "2026-09-01"], today)).toEqual({ first: "2026-09", last: "2026-10" });
  });
});

describe("copy", () => {
  it("titles the month with its year", () => {
    expect(calendarTitle("2026-09")).toBe("September 2026");
  });

  it("spells out one through nine and capitalizes the start", () => {
    expect(monthCountLine(12, "2026-09")).toBe("12 workouts in September");
    expect(monthCountLine(3, "2026-09")).toBe("Three workouts in September");
    expect(monthCountLine(1, "2026-09")).toBe("One workout in September");
    expect(monthCountLine(0, "2026-08")).toBe("No workouts in August");
  });
});
