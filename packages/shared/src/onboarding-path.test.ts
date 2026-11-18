import { describe, expect, it } from "vitest";

import { forkTrainingLevel, onboardingDotCount, onboardingPages, onboardingPathName } from "./onboarding-path";

describe("onboardingPages", () => {
  it("stops at the fork until it is answered", () => {
    expect(onboardingPages({ returning: false, fork: null, pickRoutine: false })).toEqual(["welcome", "fork"]);
  });
  it("walks a new lifter through schedule, equipment and the plan", () => {
    expect(onboardingPages({ returning: false, fork: "new", pickRoutine: false })).toEqual([
      "welcome",
      "fork",
      "schedule",
      "prefs",
      "routines",
    ]);
  });
  it("ends an experienced lifter on the start page until Pick a routine", () => {
    expect(onboardingPages({ returning: false, fork: "experienced", pickRoutine: false })).toEqual([
      "welcome",
      "fork",
      "schedule",
      "start",
    ]);
    expect(onboardingPages({ returning: false, fork: "experienced", pickRoutine: true })).toEqual([
      "welcome",
      "fork",
      "schedule",
      "start",
      "prefs",
      "routines",
    ]);
  });
  it("opens a returning user on the schedule, with no fork or start page", () => {
    for (const fork of [null, "new", "experienced"] as const) {
      expect(onboardingPages({ returning: true, fork, pickRoutine: true })).toEqual(["schedule", "prefs", "routines"]);
    }
  });
});

describe("onboardingDotCount", () => {
  it("counts the current path", () => {
    expect(onboardingDotCount({ returning: true, fork: null, pickRoutine: false })).toBe(3);
    expect(onboardingDotCount({ returning: false, fork: null, pickRoutine: false })).toBe(5);
    expect(onboardingDotCount({ returning: false, fork: "new", pickRoutine: false })).toBe(5);
    expect(onboardingDotCount({ returning: false, fork: "experienced", pickRoutine: false })).toBe(4);
    expect(onboardingDotCount({ returning: false, fork: "experienced", pickRoutine: true })).toBe(6);
  });
});

describe("onboardingPathName", () => {
  it("is returning before the fork answer", () => {
    expect(onboardingPathName(true, "new")).toBe("returning");
    expect(onboardingPathName(false, "experienced")).toBe("experienced");
    expect(onboardingPathName(false, null)).toBeNull();
  });
});

describe("forkTrainingLevel", () => {
  it("saves beginner for new and intermediate for experienced", () => {
    expect(forkTrainingLevel("new")).toBe("beginner");
    expect(forkTrainingLevel("experienced")).toBe("intermediate");
  });
});
