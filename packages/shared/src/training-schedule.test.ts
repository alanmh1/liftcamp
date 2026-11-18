import { describe, expect, it } from "vitest";

import {
  daysPerWeekLine,
  isoWeekday,
  isTrainingTime,
  normalizeTrainingDays,
  reminderLine,
  remindButtonLabel,
  scheduleSummary,
  toggleTrainingDay,
  TRAINING_WINDOW_START,
  weeklyTargetForDays,
} from "./training-schedule";

describe("isTrainingTime", () => {
  it("accepts the three windows only", () => {
    expect(isTrainingTime("morning")).toBe(true);
    expect(isTrainingTime("midday")).toBe(true);
    expect(isTrainingTime("evening")).toBe(true);
    expect(isTrainingTime("night")).toBe(false);
    expect(isTrainingTime(null)).toBe(false);
  });
});

describe("TRAINING_WINDOW_START", () => {
  it("is 07:30, 11:30 and 17:00", () => {
    expect(TRAINING_WINDOW_START).toEqual({
      morning: { hour: 7, minute: 30 },
      midday: { hour: 11, minute: 30 },
      evening: { hour: 17, minute: 0 },
    });
  });
});

describe("isoWeekday", () => {
  it("counts Monday as 1 and Sunday as 7", () => {
    expect(isoWeekday(new Date(2026, 10, 16))).toBe(1); // Monday 16 Nov 2026
    expect(isoWeekday(new Date(2026, 10, 22))).toBe(7);
  });
});

describe("normalizeTrainingDays", () => {
  it("sorts, drops repeats and anything outside 1 to 7", () => {
    expect(normalizeTrainingDays([5, 1, 3, 3, 0, 8, 2.5])).toEqual([1, 3, 5]);
  });
  it("keeps null as never answered and an empty list as empty", () => {
    expect(normalizeTrainingDays(null)).toBeNull();
    expect(normalizeTrainingDays([])).toEqual([]);
  });
  it("reads numeric strings, as a smallint[] can arrive", () => {
    expect(normalizeTrainingDays(["2", "4"])).toEqual([2, 4]);
  });
});

describe("toggleTrainingDay", () => {
  it("adds in order and removes", () => {
    expect(toggleTrainingDay([1, 5], 3)).toEqual([1, 3, 5]);
    expect(toggleTrainingDay([1, 3, 5], 3)).toEqual([1, 5]);
  });
});

describe("scheduleSummary", () => {
  it("lists short day names Monday first", () => {
    expect(scheduleSummary([5, 1, 3])).toBe("Mon, Wed, Fri");
    expect(scheduleSummary([6, 7])).toBe("Sat, Sun");
  });
  it("is null with no days", () => {
    expect(scheduleSummary([])).toBeNull();
    expect(scheduleSummary(null)).toBeNull();
  });
});

describe("weeklyTargetForDays", () => {
  it("is the count inside 2 to 5", () => {
    expect(weeklyTargetForDays(1)).toBe(2);
    expect(weeklyTargetForDays(3)).toBe(3);
    expect(weeklyTargetForDays(5)).toBe(5);
    expect(weeklyTargetForDays(6)).toBe(5);
    expect(weeklyTargetForDays(7)).toBe(5);
  });
});

describe("daysPerWeekLine", () => {
  it("spells the number out", () => {
    expect(daysPerWeekLine(1)).toBe("One day a week");
    expect(daysPerWeekLine(3)).toBe("Three days a week");
    expect(daysPerWeekLine(7)).toBe("Seven days a week");
  });
  it("asks for days with none", () => {
    expect(daysPerWeekLine(0)).toBe("Pick the days you usually train");
  });
});

describe("remindButtonLabel", () => {
  it("names up to three days", () => {
    expect(remindButtonLabel([1, 3, 5])).toBe("Remind me Mon, Wed, Fri");
    expect(remindButtonLabel([2])).toBe("Remind me Tue");
  });
  it("counts four or more", () => {
    expect(remindButtonLabel([1, 2, 3, 4])).toBe("Remind me four days a week");
    expect(remindButtonLabel([1, 2, 3, 4, 5, 6, 7])).toBe("Remind me seven days a week");
  });
  it("is Continue with none", () => {
    expect(remindButtonLabel([])).toBe("Continue");
  });
});

describe("reminderLine", () => {
  const monday = new Date(2026, 10, 16, 9, 0);
  it("names the day and window", () => {
    expect(reminderLine(new Date(2026, 10, 18, 17, 0), "evening", monday)).toBe("Reminder Wednesday evening");
    expect(reminderLine(new Date(2026, 10, 18, 7, 30), "morning", monday)).toBe("Reminder Wednesday morning");
    expect(reminderLine(new Date(2026, 10, 18, 11, 30), "midday", monday)).toBe("Reminder Wednesday at midday");
  });
  it("says this evening for today", () => {
    expect(reminderLine(new Date(2026, 10, 16, 17, 0), "evening", monday)).toBe("Reminder this evening");
    expect(reminderLine(new Date(2026, 10, 16, 11, 30), "midday", monday)).toBe("Reminder today at midday");
  });
});
