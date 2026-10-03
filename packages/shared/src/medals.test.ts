import { describe, expect, it } from "vitest";

import { isoFromLocalDate } from "./birthday";
import {
  isMedalRung,
  MEDAL_LADDER,
  medalCabinet,
  medalEarnEvents,
  medalEarnsFromDates,
  medalKey,
  medalLine,
  medalRungsThrough,
  nextMedalRung,
  type MedalEarn,
} from "./medals";
import { weekResults } from "./streak-walk";
import { streakShareLine } from "./week-card";
import { WORKOUT_EMOJI } from "./workout-subtitle";

// Wednesday 30 September 2026; its week starts Monday 28 September.
const WED = new Date(2026, 8, 30);
const MONDAY = new Date(2026, 8, 28);

/** A date `weeksAgo` weeks before this week, `dayOfWeek` days after that week's Monday. */
function day(weeksAgo: number, dayOfWeek: number): string {
  const d = new Date(MONDAY);
  d.setDate(MONDAY.getDate() - 7 * weeksAgo + dayOfWeek);
  return isoFromLocalDate(d);
}

/** Three training days (Mon, Wed, Fri) in each of these weeks ago. Hits a target of 3. */
function hits(...weeksAgo: number[]): string[] {
  return weeksAgo.flatMap((w) => [day(w, 0), day(w, 2), day(w, 4)]);
}

/** Weeks ago, newest last, from `from` down to `to`. */
function range(from: number, to: number): number[] {
  return Array.from({ length: from - to + 1 }, (_, i) => from - i);
}

const earned = (dates: string[], target = 3, today = WED) =>
  medalEarnsFromDates(dates, target, today).map((e) => [e.weeks, e.weekStart] as const);

describe("the ladder", () => {
  it("has the fixed rungs, then one every 52 weeks", () => {
    expect(medalRungsThrough(260)).toEqual([2, 4, 8, 12, 26, 52, 78, 104, 156, 208, 260]);
    expect(MEDAL_LADDER.every(isMedalRung)).toBe(true);
    for (const n of [0, 1, 3, 5, 13, 51, 53, 100, 130, 155, 157]) expect(isMedalRung(n)).toBe(false);
  });

  it("finds the next rung above any streak", () => {
    expect(nextMedalRung(0)).toBe(2);
    expect(nextMedalRung(2)).toBe(4);
    expect(nextMedalRung(30)).toBe(52);
    expect(nextMedalRung(78)).toBe(104);
    expect(nextMedalRung(104)).toBe(156);
    expect(nextMedalRung(200)).toBe(208);
  });

  it("gives each fixed rung its exact line", () => {
    expect(MEDAL_LADDER.map((r) => medalLine(r))).toEqual([
      "Two weeks in a row. You've started a streak.\u00A0🔥",
      "Four weeks straight. You've earned a rest week.\u00A0⚡️",
      "Eight weeks running. You've made this a habit.\u00A0🚀",
      "That's 12 weeks straight. Three months of you showing up.\u00A0👏",
      "That's 26 weeks in a row. Half a year of you putting in the work.\u00A0🦾",
      "That's 52 weeks. You showed up for a full year.\u00A0🎯",
      "That's 78 weeks in a row. You've kept it going for a year and a half.\u00A0😤",
      "That's 104 weeks. You've shown up for two full years.\u00A0🙌",
    ]);
  });

  it("ends every streak line with a workout emoji behind a no-break space", () => {
    const lines = [...medalRungsThrough(520).map((r) => medalLine(r)!), streakShareLine(1), streakShareLine(60)];
    for (const line of lines) {
      const parts = line.split("\u00A0");
      expect(parts).toHaveLength(2);
      expect(WORKOUT_EMOJI as readonly string[]).toContain(parts[1]);
    }
  });

  it("has a line for every rung, none starting with a digit and none with a colon or em dash", () => {
    for (const r of medalRungsThrough(520)) {
      const line = medalLine(r);
      expect(line).toBeTruthy();
      expect(line).not.toMatch(/^\d/);
      expect(line).not.toMatch(/[:—]/);
    }
    expect(medalLine(208)).toBe("That's 208 weeks. You've shown up for four full years.\u00A0🙌");
    expect(medalLine(3)).toBeNull();
  });
});

describe("medalEarnEvents", () => {
  it("earns nothing with no history", () => {
    expect(earned([])).toEqual([]);
    expect(earned(hits(1))).toEqual([]);
  });

  it("earns each rung in the week the streak reaches it, on the day that week was hit", () => {
    const events = medalEarnsFromDates(hits(4, 3, 2, 1), 3, WED);
    expect(events).toEqual([
      { weeks: 2, weekStart: day(3, 0), earnedOn: day(3, 4) },
      { weeks: 4, weekStart: day(1, 0), earnedOn: day(1, 4) },
    ]);
  });

  it("counts distinct days, so the earn day is the target-th distinct day", () => {
    // Monday twice, then Tuesday and Thursday: hit on Thursday with a target of 3.
    const dates = [...hits(2), day(1, 0), day(1, 0), day(1, 1), day(1, 3)];
    expect(medalEarnsFromDates(dates, 3, WED)).toEqual([{ weeks: 2, weekStart: day(1, 0), earnedOn: day(1, 3) }]);
    // Two days, one of them twice, is not a hit.
    expect(medalEarnsFromDates([...hits(2), day(1, 0), day(1, 0), day(1, 1)], 3, WED)).toEqual([]);
  });

  it("carries a streak over a banked rest week toward its next rung", () => {
    // Four hits bank a rest week, a miss spends it, four more hits make eight.
    const events = earned(hits(9, 8, 7, 6, 4, 3, 2, 1));
    expect(events).toEqual([
      [2, day(8, 0)],
      [4, day(6, 0)],
      [8, day(1, 0)],
    ]);
  });

  it("earns the 2 and 4 again after a break and a rebuild", () => {
    // Six hits (2 and 4 earned, a rest week banked), the first miss spends
    // the rest week, the second resets. Then four hits rebuild.
    const events = earned(hits(13, 12, 11, 10, 9, 8, 4, 3, 2, 1));
    expect(events).toEqual([
      [2, day(12, 0)],
      [4, day(10, 0)],
      [2, day(3, 0)],
      [4, day(1, 0)],
    ]);
    // Same rung, different weeks: two rows, not one.
    expect(new Set(medalEarnsFromDates(hits(13, 12, 11, 10, 9, 8, 4, 3, 2, 1), 3, WED).map(medalKey)).size).toBe(4);
  });

  it("joins the current week once it is hit, and not before", () => {
    const open = [...hits(3, 2, 1), day(0, 0), day(0, 1)];
    expect(earned(open)).toEqual([[2, day(2, 0)]]);
    const hitNow = [...open, day(0, 2)];
    expect(medalEarnsFromDates(hitNow, 3, WED).at(-1)).toEqual({ weeks: 4, weekStart: day(0, 0), earnedOn: day(0, 2) });
  });

  it("never breaks the streak on the open current week", () => {
    // Three hits, nothing yet this week: the 2 is earned and nothing is lost.
    expect(earned(hits(3, 2, 1))).toEqual([[2, day(2, 0)]]);
  });

  it("earns the rungs past a year", () => {
    const weeks = earned(hits(...range(109, 0))).map(([w]) => w);
    expect(weeks).toEqual([2, 4, 8, 12, 26, 52, 78, 104]);
    expect(earned(hits(...range(155, 0))).at(-1)).toEqual([156, day(0, 0)]);
  });

  it("earns nothing with a target of zero", () => {
    expect(medalEarnsFromDates(hits(4, 3, 2, 1), 0, WED)).toEqual([]);
  });

  it("works from week results directly", () => {
    const results = weekResults(hits(2, 1), 3, WED);
    expect(results.map((r) => r.hit)).toEqual([true, true, false]);
    expect(medalEarnEvents(results)).toEqual([{ weeks: 2, weekStart: day(1, 0), earnedOn: day(1, 4) }]);
  });
});

describe("medalCabinet", () => {
  const e = (weeks: number, weekStart: string, earnedOn = weekStart): MedalEarn => ({ weeks, weekStart, earnedOn });

  it("shows every rung through 104 locked, with the 2 next, for a new user", () => {
    const c = medalCabinet([], 0);
    expect(c.rungs.map((r) => r.weeks)).toEqual([...MEDAL_LADDER]);
    expect(c.rungs.every((r) => r.count === 0 && r.firstEarnedOn === null)).toBe(true);
    expect(c.earned).toEqual([]);
    expect(c.next).toEqual({ weeks: 2, toGo: 2 });
  });

  it("counts each earn and keeps the first date", () => {
    const c = medalCabinet([e(2, "2026-08-03"), e(4, "2026-08-17"), e(2, "2026-09-14"), e(2, "2026-07-06")], 3);
    expect(c.earned).toEqual([
      { weeks: 2, count: 3, firstEarnedOn: "2026-07-06" },
      { weeks: 4, count: 1, firstEarnedOn: "2026-08-17" },
    ]);
  });

  it("counts a stored row and the same computed event once, at the earlier day", () => {
    const c = medalCabinet([e(2, "2026-09-14", "2026-09-18"), e(2, "2026-09-14", "2026-09-16")], 2);
    expect(c.earned).toEqual([{ weeks: 2, count: 1, firstEarnedOn: "2026-09-16" }]);
  });

  it("points next at the lowest rung above the streak never earned", () => {
    expect(medalCabinet([e(2, "2026-08-03")], 3).next).toEqual({ weeks: 4, toGo: 1 });
    // A rebuild after a break: 2 and 4 already earned, so 8 is next.
    expect(medalCabinet([e(2, "2026-08-03"), e(4, "2026-08-17")], 1).next).toEqual({ weeks: 8, toGo: 7 });
  });

  it("extends past 104 to the next rung and to anything earned", () => {
    const run = [2, 4, 8, 12, 26, 52, 78, 104].map((w, i) => e(w, `2025-01-${String(i + 10)}`));
    const c = medalCabinet(run, 110);
    expect(c.next).toEqual({ weeks: 156, toGo: 46 });
    expect(c.rungs.at(-1)).toEqual({ weeks: 156, count: 0, firstEarnedOn: null });
  });

  it("ignores rows that are not on a rung", () => {
    expect(medalCabinet([e(3, "2026-08-03")], 0).earned).toEqual([]);
  });
});
