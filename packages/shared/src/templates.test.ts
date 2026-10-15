import { describe, expect, it } from "vitest";

import { lastDoneLabel, routineProgram } from "./templates";

describe("routineProgram", () => {
  it("is the program when there is one", () => {
    expect(routineProgram({ program: "Bro Split", name: "Chest & Triceps" })).toBe("Bro Split");
    expect(routineProgram({ program: "  PHUL ", name: "Upper Power" })).toBe("PHUL");
  });

  it("reads an older copy's routine from the name before ' · '", () => {
    expect(routineProgram({ program: null, name: "Bro Split · Shoulders & Traps" })).toBe("Bro Split");
    expect(routineProgram({ program: "", name: "Arnold Split · Day 1 Chest & Back" })).toBe("Arnold Split");
  });

  it("is null for a routine of its own", () => {
    expect(routineProgram({ program: null, name: "My leg day" })).toBeNull();
    expect(routineProgram({ program: null, name: " · Legs" })).toBeNull();
    expect(routineProgram({ program: null, name: "Legs · " })).toBeNull();
  });
});

describe("lastDoneLabel", () => {
  // Wednesday 30 September 2026, 2:45 pm local.
  const afternoon = new Date(2026, 8, 30, 14, 45);

  it("calls a workout done earlier today today, at any hour", () => {
    expect(lastDoneLabel("2026-09-30", afternoon)).toBe("Done today");
    expect(lastDoneLabel("2026-09-30", new Date(2026, 8, 30, 23, 59))).toBe("Done today");
    expect(lastDoneLabel("2026-09-30", new Date(2026, 8, 30, 0, 1))).toBe("Done today");
  });

  it("counts calendar days before that", () => {
    expect(lastDoneLabel("2026-09-29", afternoon)).toBe("Done yesterday");
    expect(lastDoneLabel("2026-09-29", new Date(2026, 8, 30, 0, 1))).toBe("Done yesterday");
    expect(lastDoneLabel("2026-09-27", afternoon)).toBe("Done three days ago");
    expect(lastDoneLabel("2026-09-16", afternoon)).toBe("Done two weeks ago");
  });

  it("says not done yet with no date", () => {
    expect(lastDoneLabel(null, afternoon)).toBe("Not done yet");
  });
});
