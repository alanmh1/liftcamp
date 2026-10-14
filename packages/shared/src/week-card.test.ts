import { describe, expect, it } from "vitest";

import { isoFromLocalDate } from "./birthday";
import { MEDAL_LADDER, medalLine } from "./medals";
import {
  streakShare,
  streakShareLine,
  WEEK_CARD_POOLS,
  weekCardLine,
  weekCardState,
  weekMedal,
  weekStreak,
  type WeekCardState,
} from "./week-card";

// Wednesday 30 September 2026; its week starts Monday 28 September.
const WED = new Date(2026, 8, 30);
const MONDAY = new Date(2026, 8, 28);

/** A date `weeksAgo` weeks before this week, `day` days after that week's Monday. */
function day(weeksAgo: number, dayOfWeek: number): string {
  const d = new Date(MONDAY);
  d.setDate(MONDAY.getDate() - 7 * weeksAgo + dayOfWeek);
  return isoFromLocalDate(d);
}

/** Three training days (Mon, Wed, Fri) in each of these weeks ago. Hits a target of 3. */
function hits(...weeksAgo: number[]): string[] {
  return weeksAgo.flatMap((w) => [day(w, 0), day(w, 2), day(w, 4)]);
}

/** A date on a given weekday of this week. */
function thisWeek(dayOfWeek: number): Date {
  const d = new Date(MONDAY);
  d.setDate(MONDAY.getDate() + dayOfWeek);
  return d;
}

describe("weekStreak", () => {
  it("is all zeros with no dates", () => {
    expect(weekStreak([], 3, WED)).toEqual({
      current: 0,
      longest: 0,
      restBanked: false,
      restUsedLastWeek: false,
      resetLastWeekFrom: 0,
    });
  });

  it("counts three hit weeks while this week is still open", () => {
    expect(weekStreak(hits(3, 2, 1), 3, WED).current).toBe(3);
  });

  it("adds this week once it is hit", () => {
    const dates = [...hits(3, 2, 1), day(0, 0), day(0, 1), day(0, 2)];
    expect(weekStreak(dates, 3, WED).current).toBe(4);
  });

  it("banks a rest week after four hits in a row", () => {
    expect(weekStreak(hits(4, 3, 2, 1), 3, WED).restBanked).toBe(true);
    expect(weekStreak(hits(3, 2, 1), 3, WED).restBanked).toBe(false);
  });

  it("spends the rest week on a miss and keeps the streak", () => {
    const s = weekStreak(hits(6, 5, 4, 3, 2), 3, WED);
    expect(s).toMatchObject({ current: 5, restBanked: false, restUsedLastWeek: true, resetLastWeekFrom: 0 });
  });

  it("resets on a miss with no rest week, and remembers what was lost", () => {
    const s = weekStreak(hits(3, 2), 3, WED);
    expect(s).toMatchObject({ current: 0, resetLastWeekFrom: 2, restUsedLastWeek: false });
  });

  it("starts again after a reset and keeps the longest", () => {
    const s = weekStreak(hits(4, 3, 1), 3, WED);
    expect(s).toMatchObject({ current: 1, longest: 2 });
  });

  it("never spends a rest week twice in a row", () => {
    // Four hits bank one, a miss spends it, the next miss resets.
    const s = weekStreak(hits(7, 6, 5, 4), 3, WED);
    expect(s.current).toBe(0);
    expect(s.longest).toBe(4);
  });

  it("banks again after four more hits once the first is spent", () => {
    const s = weekStreak(hits(9, 8, 7, 6, 4, 3, 2, 1), 3, WED);
    expect(s).toMatchObject({ current: 8, restBanked: true });
  });

  it("never spends a rest week on the current week", () => {
    const s = weekStreak(hits(4, 3, 2, 1), 3, WED);
    expect(s).toMatchObject({ current: 4, restBanked: true, restUsedLastWeek: false });
  });

  it("is all zeros for a target of zero", () => {
    expect(weekStreak(hits(2, 1), 0, WED)).toMatchObject({ current: 0, longest: 0 });
  });

  it("reads history older than 52 weeks", () => {
    expect(weekStreak(hits(60, 59, 58), 3, WED)).toMatchObject({ current: 0, longest: 3 });
  });

  it("counts a run past 52 weeks", () => {
    const all = hits(...Array.from({ length: 80 }, (_, i) => i));
    expect(weekStreak(all, 3, WED)).toMatchObject({ current: 80, longest: 80 });
  });

  it("ignores dates more than ten years back", () => {
    expect(weekStreak([...hits(600, 599), ...hits(1)], 3, WED)).toMatchObject({ current: 1, longest: 1 });
  });

  it("counts two workouts on one day as one day", () => {
    const dates = [day(1, 0), day(1, 0), day(1, 2)];
    expect(weekStreak(dates, 2, WED).current).toBe(1);
    expect(weekStreak(dates, 3, WED).current).toBe(0);
  });

  it("ignores a workout dated after this Sunday", () => {
    const dates = [day(0, 0), day(0, 1), day(-1, 0)];
    expect(weekStreak(dates, 3, WED).current).toBe(0);
  });

  it("buckets weeks across New Year and a daylight saving change", () => {
    // Sunday 3 Jan 2027 closes the week of Monday 28 Dec 2026.
    const newYear = weekStreak(["2026-12-28", "2026-12-30", "2027-01-03"], 3, new Date(2027, 0, 6));
    expect(newYear.current).toBe(1);
    // US clocks go back on Sunday 1 Nov 2026; that Sunday belongs to the week of 26 Oct.
    const dst = weekStreak(["2026-10-26", "2026-10-28", "2026-11-01"], 3, new Date(2026, 10, 4));
    expect(dst.current).toBe(1);
  });

  it("counts the current week in the longest run once it is hit", () => {
    const dates = [...hits(2, 1), day(0, 0), day(0, 1), day(0, 2)];
    expect(weekStreak(dates, 3, WED).longest).toBe(3);
  });
});

describe("weekCardState", () => {
  const base = { target: 3, finishedCount: 10 };

  it("is first for someone who has never finished a workout", () => {
    expect(weekCardState({ ...base, dates: [], finishedCount: 0, today: WED }).phase).toBe("first");
  });

  it("is zero-early through Wednesday and zero-late from Thursday", () => {
    expect(weekCardState({ ...base, dates: [], today: WED }).phase).toBe("zero-early");
    expect(weekCardState({ ...base, dates: [], today: thisWeek(3) }).phase).toBe("zero-late");
  });

  it("uses the zero phases for a target of one", () => {
    expect(weekCardState({ ...base, target: 1, dates: [], today: WED }).phase).toBe("zero-early");
  });

  it("walks going, one-left, hit and over", () => {
    expect(weekCardState({ ...base, target: 4, dates: [day(0, 0)], today: WED }).phase).toBe("going");
    expect(weekCardState({ ...base, dates: [day(0, 0), day(0, 1)], today: WED }).phase).toBe("one-left");
    expect(weekCardState({ ...base, dates: [day(0, 0), day(0, 1), day(0, 2)], today: WED }).phase).toBe("hit");
    expect(
      weekCardState({ ...base, dates: [day(0, 0), day(0, 1), day(0, 2), day(0, 3)], today: thisWeek(3) }).phase,
    ).toBe("over");
  });

  it("is at risk on Sunday with one to go and a streak", () => {
    const s = weekCardState({ ...base, dates: [...hits(1), day(0, 0), day(0, 1)], today: thisWeek(6) });
    expect(s.atRisk).toBe(true);
  });

  it("is not at risk with no streak", () => {
    const s = weekCardState({ ...base, dates: [day(0, 0), day(0, 1)], today: thisWeek(6) });
    expect(s.atRisk).toBe(false);
  });

  it("is not at risk on Sunday with two to go, which is out of reach", () => {
    const s = weekCardState({ ...base, dates: [...hits(1), day(0, 0)], today: thisWeek(6) });
    expect(s.atRisk).toBe(false);
  });

  it("counts days left from tomorrow when today already has a workout", () => {
    // Saturday, one done today, target 3: only Sunday is left, so it is out of reach.
    const sat = weekCardState({ ...base, dates: [...hits(1), day(0, 5)], today: thisWeek(5) });
    expect(sat).toMatchObject({ trainedToday: true, daysLeft: 1, remaining: 2, atRisk: false });
    // Sunday already trained with one to go: nothing is left.
    const sun = weekCardState({ ...base, dates: [...hits(1), day(0, 0), day(0, 6)], today: thisWeek(6) });
    expect(sun).toMatchObject({ daysLeft: 0, remaining: 1, atRisk: false });
  });

  it("is at risk on Saturday with one to go when today is done", () => {
    const s = weekCardState({ ...base, dates: [...hits(1), day(0, 0), day(0, 5)], today: thisWeek(5) });
    expect(s).toMatchObject({ daysLeft: 1, remaining: 1, atRisk: true });
  });
});

describe("weekCardLine", () => {
  const none = { resetShownFor: null };
  const state = (over: Partial<WeekCardState>): WeekCardState => ({
    done: 0,
    target: 3,
    remaining: 3,
    daysLeft: 5,
    trainedToday: false,
    phase: "zero-early",
    atRisk: false,
    streak: { current: 0, longest: 0, restBanked: false, restUsedLastWeek: false, resetLastWeekFrom: 0 },
    weekStart: "2026-09-28",
    ...over,
  });
  const streak = (over: Partial<WeekCardState["streak"]>) => ({
    current: 0,
    longest: 0,
    restBanked: false,
    restUsedLastWeek: false,
    resetLastWeekFrom: 0,
    ...over,
  });

  it("shows the reset line once, then falls through to the pool", () => {
    const s = state({ streak: streak({ resetLastWeekFrom: 3 }) });
    expect(weekCardLine(s, none, WED)).toBe("Streak reset. New one starts now.");
    const after = weekCardLine(s, { resetShownFor: "2026-09-28" }, WED);
    expect(after).not.toBe("Streak reset. New one starts now.");
    expect(WEEK_CARD_POOLS["zero-early"].map((l) => l.text(s))).toContain(after);
  });

  it("puts reset before rest, rest before at-risk, and at-risk before the pool", () => {
    const both = state({ streak: streak({ resetLastWeekFrom: 2, restUsedLastWeek: true }) });
    expect(weekCardLine(both, none, WED)).toBe("Streak reset. New one starts now.");
    const rest = state({ streak: streak({ current: 5, restUsedLastWeek: true }), atRisk: true });
    expect(weekCardLine(rest, none, WED)).toBe("Rest week used. Streak safe.");
    const risk = state({ phase: "one-left", done: 2, remaining: 1, daysLeft: 1, atRisk: true, streak: streak({ current: 3 }) });
    expect(weekCardLine(risk, none, thisWeek(6))).toBe("Your three-week streak is on the line. One more today.");
  });

  it("drops the reset and rest lines once a workout is done", () => {
    const s = state({ done: 1, remaining: 2, phase: "going", streak: streak({ resetLastWeekFrom: 3, restUsedLastWeek: true }) });
    const line = weekCardLine(s, none, WED);
    expect(line).not.toMatch(/Streak reset|Rest week used/);
  });

  it("says tomorrow when today is already done", () => {
    const s = state({ phase: "one-left", done: 2, remaining: 1, daysLeft: 1, trainedToday: true, atRisk: true, streak: streak({ current: 2 }) });
    expect(weekCardLine(s, none, thisWeek(5))).toBe("Your two-week streak is on the line. One more tomorrow.");
  });

  it("asks for more by Sunday when more than one is left", () => {
    const s = state({ phase: "going", done: 1, remaining: 2, daysLeft: 2, atRisk: true, streak: streak({ current: 12 }) });
    expect(weekCardLine(s, none, thisWeek(5))).toBe("Your 12-week streak is on the line. Two more by Sunday.");
  });

  it("says 'Your streak' for a streak of one", () => {
    const s = state({ phase: "one-left", done: 2, remaining: 1, daysLeft: 1, atRisk: true, streak: streak({ current: 1 }) });
    expect(weekCardLine(s, none, thisWeek(6))).toBe("Your streak is on the line. One more today.");
  });

  it("swaps the hit line for the medal line on every rung", () => {
    for (const m of [...MEDAL_LADDER, 156, 208]) {
      const s = state({ phase: "hit", done: 3, remaining: 0, streak: streak({ current: m }) });
      expect(weekMedal(s)).toBe(m);
      expect(weekCardLine(s, none, WED)).toBe(medalLine(m));
    }
    const over = state({ phase: "over", done: 4, remaining: 0, streak: streak({ current: 4 }) });
    expect(weekCardLine(over, none, WED)).toBe(medalLine(4));
    const notOne = state({ phase: "hit", done: 3, remaining: 0, streak: streak({ current: 3 }) });
    expect(weekMedal(notOne)).toBeNull();
    expect(MEDAL_LADDER.map(medalLine)).not.toContain(weekCardLine(notOne, none, WED));
  });

  it("gives no medal while the week is open, even on a rung", () => {
    const open = state({ phase: "one-left", done: 2, remaining: 1, streak: streak({ current: 4 }) });
    expect(weekMedal(open)).toBeNull();
  });

  it("holds the same line all week and moves on the next", () => {
    const s = state({ phase: "hit", done: 3, remaining: 0 });
    const mon = weekCardLine(s, none, thisWeek(0));
    expect(weekCardLine(s, none, thisWeek(2))).toBe(mon);
    const next = state({ phase: "hit", done: 3, remaining: 0, weekStart: "2026-10-05" });
    expect(weekCardLine(next, none, thisWeek(0))).not.toBe(mon);
  });

  it("never repeats a line in neighboring weeks, on any weekday", () => {
    for (const phase of Object.keys(WEEK_CARD_POOLS) as WeekCardState["phase"][]) {
      for (let wd = 0; wd < 7; wd += 1) {
        let prev: string | null = null;
        for (let w = 0; w < 40; w += 1) {
          const monday = new Date(2026, 8, 28 + 7 * w);
          const today = new Date(monday);
          today.setDate(monday.getDate() + wd);
          const s = state({ phase, done: 1, target: 3, remaining: 2, weekStart: isoFromLocalDate(monday) });
          const line = weekCardLine(s, none, today);
          expect(line, `${phase}, weekday ${wd}, week ${w}`).not.toBe(prev);
          prev = line;
        }
      }
    }
  });

  it("never shows the weekend-only hit line on a Tuesday", () => {
    for (let w = 0; w < 30; w += 1) {
      const monday = new Date(2026, 8, 28 + 7 * w);
      const s = state({ phase: "hit", done: 3, remaining: 0, weekStart: isoFromLocalDate(monday) });
      const tuesday = new Date(monday);
      tuesday.setDate(monday.getDate() + 1);
      expect(weekCardLine(s, none, tuesday)).not.toBe("Every workout, done. Enjoy the weekend.");
    }
  });

  it("writes numbers in prose and never uses a colon or an em dash", () => {
    const s = state({ phase: "going", done: 1, remaining: 2 });
    expect(weekCardLine(s, none, WED)).not.toMatch(/\b[1-9]\b/);
    for (const [phase, pool] of Object.entries(WEEK_CARD_POOLS)) {
      for (const line of pool) {
        const text = line.text(state({ phase: phase as WeekCardState["phase"], done: 4, target: 3, remaining: 0 }));
        expect(text).not.toMatch(/[:—]/);
      }
    }
    for (const m of [...MEDAL_LADDER, 156, 260]) expect(medalLine(m)).not.toMatch(/[:—]/);
  });
});

describe("streakShareLine", () => {
  it("ends each medal line with its emoji", () => {
    const emoji = { 2: "🔥", 4: "⚡️", 8: "🚀", 12: "👏", 26: "🦾", 52: "🎯", 78: "😤", 104: "🙌" } as const;
    for (const m of MEDAL_LADDER) expect(streakShareLine(m).endsWith(`\u00A0${emoji[m]}`)).toBe(true);
    expect(streakShareLine(156)).toBe("That's 156 weeks. You've shown up for three full years.\u00A0🙌");
  });

  it("says keep it going off a milestone, 💪 up to a year and 🦾 past it", () => {
    expect(streakShareLine(1)).toBe("Keep it going\u00A0💪");
    expect(streakShareLine(3)).toBe("Keep it going\u00A0💪");
    expect(streakShareLine(51)).toBe("Keep it going\u00A0💪");
    expect(streakShareLine(52 + 1)).toBe("Keep it going\u00A0🦾");
    expect(streakShareLine(60)).toBe("Keep it going\u00A0🦾");
  });
});

describe("streakShare", () => {
  it("is null with no streak", () => {
    expect(streakShare([], 3, WED)).toBeNull();
    expect(streakShare(hits(3, 2), 3, WED)).toBeNull();
  });

  it("gives one column per streak week, oldest first, with distinct days", () => {
    // Week 3 ago: four days, one twice. Weeks 2 and 1: three days.
    const dates = [...hits(3, 2, 1), day(3, 6), day(3, 6)];
    expect(streakShare(dates, 3, WED)).toEqual({
      weeks: 3,
      strip: [
        { rest: false, days: 4 },
        { rest: false, days: 3 },
        { rest: false, days: 3 },
      ],
      workouts: 10,
    });
  });

  it("adds this week once it is hit, and leaves it out before", () => {
    expect(streakShare([...hits(1), day(0, 0)], 3, WED)?.strip).toHaveLength(1);
    const hitNow = streakShare([...hits(1), day(0, 0), day(0, 1), day(0, 2)], 3, WED);
    expect(hitNow?.strip).toHaveLength(2);
    expect(hitNow?.workouts).toBe(6);
  });

  it("shows a spent rest week as a rest column, and counts its days", () => {
    // Hits 6 to 3 weeks ago bank a rest; 2 weeks ago has one day, a miss; 1 week ago hit.
    const s = streakShare([...hits(6, 5, 4, 3, 1), day(2, 3)], 3, WED);
    expect(s?.weeks).toBe(5);
    expect(s?.strip.map((w) => (w.rest ? "rest" : w.days))).toEqual([3, 3, 3, 3, "rest", 3]);
    expect(s?.workouts).toBe(16);
  });

  it("starts after the last reset", () => {
    const s = streakShare(hits(5, 4, 2, 1), 3, WED);
    expect(s?.weeks).toBe(2);
    expect(s?.strip).toHaveLength(2);
    expect(s?.workouts).toBe(6);
  });

  it("keeps the last 12 weeks in the strip and counts the whole streak", () => {
    const weeks = Array.from({ length: 20 }, (_, i) => i + 1);
    const s = streakShare(hits(...weeks), 3, WED);
    expect(s?.weeks).toBe(20);
    expect(s?.strip).toHaveLength(12);
    expect(s?.workouts).toBe(60);
  });
});
