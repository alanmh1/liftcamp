import { describe, expect, it } from "vitest";

import { lastDoneLabel, routineMuscleSummary, routineProgram } from "./templates";

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

describe("routineMuscleSummary", () => {
  const te = (position: number, primary_muscle: string | null) => ({
    exercise_id: `e${position}`,
    position,
    exercises: { equipment: null, primary_muscle },
  });

  it("lists the muscles hit most, then in exercise order", () => {
    const t = {
      template_exercises: [
        te(1, "chest"),
        te(2, "shoulders"),
        te(3, "chest"),
        te(4, "triceps"),
        te(5, "triceps"),
        te(6, "abs"),
      ],
    };
    expect(routineMuscleSummary(t)).toBe("Chest, Triceps, Shoulders");
  });

  it("reads the exercises by position, whatever order they arrive in", () => {
    const t = { template_exercises: [te(3, "quads"), te(1, "hamstrings"), te(2, "glutes")] };
    expect(routineMuscleSummary(t)).toBe("Hamstrings, Glutes, Quads");
  });

  it("folds old spellings into one muscle", () => {
    const t = { template_exercises: [te(1, "quadriceps"), te(2, "quads"), te(3, "calves")] };
    expect(routineMuscleSummary(t)).toBe("Quads, Calves");
  });

  it("is empty when the exercises were not joined", () => {
    expect(routineMuscleSummary({ template_exercises: [{ exercise_id: "a", position: 1 }] })).toBe("");
    expect(routineMuscleSummary({ template_exercises: [] })).toBe("");
  });
});
