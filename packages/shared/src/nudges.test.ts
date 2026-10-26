import { describe, expect, it } from "vitest";

import { firstNudgeContent, nudgeTime, streakNudgeAt, streakNudgeContent } from "./nudges";
import type { StreakResult } from "./week-card";

const streak = (current: number): StreakResult => ({
  current,
  longest: current,
  restBanked: false,
  restUsedLastWeek: false,
  resetLastWeekFrom: 0,
});

// The week of Monday 28 September 2026.
const WEEK = "2026-09-28";
const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, 28 + day, hour, minute);

describe("nudgeTime", () => {
  it("is 9:00 local, days after the given day", () => {
    expect(nudgeTime(new Date(2026, 9, 26, 22, 15), 2)).toEqual(new Date(2026, 9, 28, 9, 0));
    expect(nudgeTime(new Date(2026, 9, 30, 7, 0), 6)).toEqual(new Date(2026, 10, 5, 9, 0));
  });
});

describe("firstNudgeContent", () => {
  it("names the Next up day", () => {
    expect(firstNudgeContent(1, "Full Body A")).toEqual({
      title: "Your first workout is waiting",
      body: "Full Body A is ready when you are. Tick a set when you've done it.",
    });
    expect(firstNudgeContent(2, "Full Body A")).toEqual({
      title: "Still here when you're ready",
      body: "One short session is all it takes to start. Full Body A is set up.",
    });
  });

  it("asks for any workout without one", () => {
    expect(firstNudgeContent(1, null).body).toBe("Start a workout and tick a set when you've done it.");
    expect(firstNudgeContent(2, "  ").body).toBe("Start a workout and tick a set when you've done it.");
  });
});

describe("streakNudgeAt", () => {
  const state = (remaining: number, daysLeft: number, current = 2) => ({
    remaining,
    daysLeft,
    streak: streak(current),
    weekStart: WEEK,
  });

  it("fires on the first day every remaining day must be trained", () => {
    // Monday, three to go: Friday.
    expect(streakNudgeAt(state(3, 7), at(0, 8))).toEqual(at(4, 9));
    // Wednesday, one to go: Sunday.
    expect(streakNudgeAt(state(1, 5), at(2, 12))).toEqual(at(6, 9));
  });

  it("fires today when today is the day and 9:00 is still ahead", () => {
    expect(streakNudgeAt(state(2, 2), at(5, 7, 30))).toEqual(at(5, 9));
  });

  it("schedules nothing once that moment has passed", () => {
    expect(streakNudgeAt(state(2, 2), at(5, 9, 1))).toBeNull();
  });

  it("is not moved by a workout today", () => {
    // Saturday, trained today, one to go: still Sunday.
    expect(streakNudgeAt(state(1, 1), at(5, 18))).toEqual(at(6, 9));
  });

  it("needs a streak and something left to do", () => {
    expect(streakNudgeAt(state(2, 5, 0), at(2, 8))).toBeNull();
    expect(streakNudgeAt(state(0, 5), at(2, 8))).toBeNull();
  });

  it("schedules nothing for a week already out of reach", () => {
    expect(streakNudgeAt(state(3, 2), at(5, 8))).toBeNull();
  });
});

describe("streakNudgeContent", () => {
  it("uses the card's headline and ask", () => {
    expect(streakNudgeContent({ remaining: 1, streak: streak(1) })).toEqual({
      title: "Your streak is on the line",
      body: "One more today.",
    });
    expect(streakNudgeContent({ remaining: 2, streak: streak(3) })).toEqual({
      title: "Your three-week streak is on the line",
      body: "Two more by Sunday.",
    });
    expect(streakNudgeContent({ remaining: 1, streak: streak(12) }).title).toBe("Your 12-week streak is on the line");
  });
});
