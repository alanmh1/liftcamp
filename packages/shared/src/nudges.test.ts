import { describe, expect, it } from "vitest";

import {
  firstNudgeContent,
  firstPlannedReminder,
  nudgeTime,
  PAUSE_NUDGE_CONTENT,
  plannedNudgeContent,
  planPlannedNudges,
  streakNudgeAt,
  streakNudgeContent,
} from "./nudges";
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

describe("plannedNudgeContent", () => {
  it("asks for the first workout before any finish", () => {
    expect(plannedNudgeContent("Full Body A", 0)).toEqual({
      title: "Your first workout is today",
      body: "Full Body A is ready. Tap to open it.",
    });
    expect(plannedNudgeContent(null, 0).body).toBe("Start a workout and tick a set when you've done it.");
  });
  it("names the next day after the first finish", () => {
    expect(plannedNudgeContent("Full Body B", 3)).toEqual({
      title: "Full Body B is up next",
      body: "It's one of your training days. Tap to start.",
    });
    expect(plannedNudgeContent(" ", 3)).toEqual({ title: "It's a training day", body: "Tap to start a workout." });
  });
});

describe("planPlannedNudges", () => {
  // Monday 16 November 2026.
  const mon = (day: number, hour: number, minute = 0) => new Date(2026, 10, 16 + day, hour, minute);
  const base = { dayName: "Full Body A", finishedCount: 1, trainedToday: false };

  it("schedules each planned day in the next seven, then the pause on day 8", () => {
    const { nudges, streakTaken } = planPlannedNudges({ ...base, days: [1, 3, 5], time: "evening", now: mon(0, 9) });
    expect(nudges.map((n) => [n.kind, n.key, n.at])).toEqual([
      ["planned", "2026-11-16", mon(0, 17)],
      ["planned", "2026-11-18", mon(2, 17)],
      ["planned", "2026-11-20", mon(4, 17)],
      ["pause", "2026-11-23", mon(7, 17)],
    ]);
    expect(nudges[3]!.content).toEqual(PAUSE_NUDGE_CONTENT);
    expect(streakTaken).toBe(false);
  });

  it("leaves today out once its window has started", () => {
    const { nudges } = planPlannedNudges({ ...base, days: [1, 3], time: "morning", now: mon(0, 8) });
    expect(nudges.map((n) => n.key)).toEqual(["2026-11-18", "2026-11-23"]);
    expect(nudges[1]!.at).toEqual(mon(7, 7, 30));
  });

  it("leaves today out when today is trained", () => {
    const { nudges } = planPlannedNudges({ ...base, trainedToday: true, days: [1], time: "evening", now: mon(0, 9) });
    expect(nudges.map((n) => n.kind)).toEqual(["pause"]);
  });

  it("takes next week's same weekday only as the pause, never twice", () => {
    const { nudges } = planPlannedNudges({ ...base, days: [1, 2, 3, 4, 5, 6, 7], time: "midday", now: mon(0, 12) });
    expect(nudges.filter((n) => n.kind === "planned").map((n) => n.key)).toEqual([
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);
  });

  it("schedules nothing with no days", () => {
    expect(planPlannedNudges({ ...base, days: [], time: "evening", now: mon(0, 9) }).nudges).toEqual([]);
    expect(planPlannedNudges({ ...base, days: null, time: "evening", now: mon(0, 9) }).nudges).toEqual([]);
  });

  it("gives the streak copy to the planned reminder on the streak nudge's day", () => {
    const streakContent = { title: "Your streak is on the line", body: "Two more by Sunday." };
    const { nudges, streakTaken } = planPlannedNudges({
      ...base,
      days: [1, 5],
      time: "evening",
      now: mon(0, 9),
      streak: { at: mon(4, 9), content: streakContent },
    });
    expect(streakTaken).toBe(true);
    expect(nudges.find((n) => n.key === "2026-11-20")!.content).toEqual(streakContent);
    expect(nudges.find((n) => n.key === "2026-11-16")!.content).toEqual(plannedNudgeContent("Full Body A", 1));
  });

  it("leaves the streak nudge alone when no planned day falls on it", () => {
    const { streakTaken } = planPlannedNudges({
      ...base,
      days: [1],
      time: "evening",
      now: mon(0, 9),
      streak: { at: mon(4, 9), content: { title: "t", body: "b" } },
    });
    expect(streakTaken).toBe(false);
  });
});

describe("firstPlannedReminder", () => {
  it("is the first planned day from now", () => {
    expect(firstPlannedReminder([3, 5], "evening", new Date(2026, 10, 16, 9))).toEqual(new Date(2026, 10, 18, 17));
    expect(firstPlannedReminder([], "evening", new Date(2026, 10, 16, 9))).toBeNull();
  });
});
