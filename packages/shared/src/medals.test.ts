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
  medalProgress,
  medalRungsThrough,
  nextMedalRung,
  workoutMedal,
  type MedalEarn,
} from "./medals";
import { weekResults } from "./streak-walk";
import { streakShareLine, type WeekCardState } from "./week-card";
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

describe("workoutMedal", () => {
  it("names the medal the workout that hit the week earned", () => {
    // Weeks 1 ago and this week hit; this week's third day, Wednesday, is the hit.
    const dates = [...hits(1), day(0, 0), day(0, 1), day(0, 2)];
    expect(workoutMedal(dates, 3, day(0, 2))).toBe(2);
  });

  it("is null for the week's other workouts and for an open week", () => {
    const dates = [...hits(1), day(0, 0), day(0, 1), day(0, 2), day(0, 3)];
    expect(workoutMedal(dates, 3, day(0, 1))).toBeNull();
    // Over the target, after the medal day.
    expect(workoutMedal(dates, 3, day(0, 3))).toBeNull();
    expect(workoutMedal([...hits(1), day(0, 0), day(0, 1)], 3, day(0, 1))).toBeNull();
  });

  it("is null when the hit takes the streak to a number off the ladder", () => {
    expect(workoutMedal([...hits(2, 1), day(0, 0), day(0, 1), day(0, 2)], 3, day(0, 2))).toBeNull();
  });

  it("finds 26 and the rungs past 104", () => {
    const at = (weeks: number) => [...hits(...range(weeks - 1, 1)), day(0, 0), day(0, 1), day(0, 2)];
    expect(workoutMedal(at(26), 3, day(0, 2))).toBe(26);
    expect(workoutMedal(at(156), 3, day(0, 2))).toBe(156);
  });

  it("finds a re-earn after a break", () => {
    // 2 and 4 earned, then two misses reset it; last week and this week earn 2 again.
    const dates = [...hits(13, 12, 11, 10, 9, 8, 1), day(0, 0), day(0, 1), day(0, 2)];
    expect(workoutMedal(dates, 3, day(0, 2))).toBe(2);
  });

  it("reads the history as of the workout's day, for a backdated one", () => {
    // Hitting week 3 ago made the 2; later weeks do not change that.
    const dates = [...hits(4, 3, 2, 1)];
    expect(workoutMedal(dates, 3, day(3, 4))).toBe(2);
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

describe("medalProgress", () => {
  /** A card state with only what medalProgress reads. */
  function at(current: number, opts: { hit?: boolean; remaining?: number } = {}): WeekCardState {
    const hit = opts.hit ?? false;
    return {
      done: hit ? 3 : 3 - (opts.remaining ?? 2),
      target: 3,
      remaining: hit ? 0 : (opts.remaining ?? 2),
      daysLeft: 4,
      trainedToday: false,
      phase: hit ? "hit" : "going",
      atRisk: false,
      streak: { current, longest: current, restBanked: false, restUsedLastWeek: false, resetLastWeekFrom: 0 },
      weekStart: "2026-09-28",
    };
  }

  it("has no medal behind a streak under 2", () => {
    expect(medalProgress(at(0))).toMatchObject({ prev: null, next: 2, toGo: 2 });
    expect(medalProgress(at(1))).toMatchObject({ prev: null, next: 2, toGo: 1 });
  });

  it("takes the highest rung at or below the streak", () => {
    expect(medalProgress(at(2))).toMatchObject({ prev: 2, next: 4, toGo: 2 });
    expect(medalProgress(at(5))).toMatchObject({ prev: 4, next: 8, toGo: 3 });
    expect(medalProgress(at(26))).toMatchObject({ prev: 26, next: 52 });
    expect(medalProgress(at(110))).toMatchObject({ prev: 104, next: 156, toGo: 46 });
  });

  it("counts ticks from the medal behind, this week the next one until it is hit", () => {
    expect(medalProgress(at(5)).ticks).toEqual({ on: 1, now: true, total: 4 });
    expect(medalProgress(at(6, { hit: true })).ticks).toEqual({ on: 2, now: false, total: 4 });
    expect(medalProgress(at(0)).ticks).toEqual({ on: 0, now: true, total: 2 });
  });

  it("draws a bar past eight ticks", () => {
    expect(medalProgress(at(9)).bar).toBeNull();
    expect(medalProgress(at(12)).ticks.total).toBe(14);
    expect(medalProgress(at(19)).bar).toBeCloseTo(7 / 14);
    expect(medalProgress(at(30)).bar).toBeCloseTo(4 / 26);
    expect(medalProgress(at(4)).bar).toBeNull();
  });

  it("is one workout from the medal with one week and one workout to go", () => {
    const p = medalProgress(at(3, { remaining: 1 }));
    expect(p.line).toBe("One workout from your 4-week medal");
    expect(p.urgent).toBe(true);
  });

  it("asks for this week with one week and more workouts to go", () => {
    const p = medalProgress(at(7, { remaining: 2 }));
    expect(p.line).toBe("Hit this week for your 8-week medal");
    expect(p.urgent).toBe(true);
  });

  it("counts the weeks otherwise", () => {
    expect(medalProgress(at(5)).line).toBe("Three weeks to your 8-week medal");
    expect(medalProgress(at(1, { hit: true })).line).toBe("One week to your 2-week medal");
    expect(medalProgress(at(1, { hit: true })).urgent).toBe(false);
    expect(medalProgress(at(0)).line).toBe("Two weeks to your 2-week medal");
    expect(medalProgress(at(14)).line).toBe("12 weeks to your 26-week medal");
  });
});
