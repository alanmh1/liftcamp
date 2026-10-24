import { describe, expect, it } from "vitest";

import {
  lastDoneDetailLine,
  routineExerciseLine,
  shortDateLabel,
  topWeightsByExercise,
  type RoutineLastDone,
} from "./routine-last-done";

const last = (extra: Partial<RoutineLastDone> = {}): RoutineLastDone => ({
  workoutId: "w1",
  workoutDate: "2026-10-17",
  createdAt: "2026-10-17T16:00:00Z",
  finishedAt: "2026-10-17T16:52:00Z",
  volume: 7820,
  cardioSeconds: 0,
  topWeights: new Map(),
  ...extra,
});

describe("shortDateLabel", () => {
  it("reads the date as a local calendar day", () => {
    expect(shortDateLabel("2026-10-17")).toBe("Sat, Oct 17");
    expect(shortDateLabel("2026-01-01")).toBe("Thu, Jan 1");
  });
});

describe("lastDoneDetailLine", () => {
  it("is Not done yet with no history", () => {
    expect(lastDoneDetailLine(null, "lbs")).toBe("Not done yet");
  });

  it("gives the date, duration and volume", () => {
    expect(lastDoneDetailLine(last(), "lbs")).toBe("Last done Sat, Oct 17 · 52 min · 7,820 lbs");
  });

  it("gives cardio time when there is no volume", () => {
    expect(lastDoneDetailLine(last({ volume: 0, cardioSeconds: 1500 }), "kg")).toBe(
      "Last done Sat, Oct 17 · 52 min · 25:00",
    );
  });

  it("leaves the work off when there is neither", () => {
    expect(lastDoneDetailLine(last({ volume: 0 }), "lbs")).toBe("Last done Sat, Oct 17 · 52 min");
  });
});

describe("topWeightsByExercise", () => {
  const set = (weight_value: number | null, completed = true) => ({ weight_value, completed });

  it("takes the heaviest completed set of each exercise", () => {
    const top = topWeightsByExercise([
      { exercise: { id: "squat", weight_type: "standard" }, sets: [set(185), set(205), set(225, false)] },
      { exercise: { id: "row", weight_type: "standard" }, sets: [set(95), set(null), set(90)] },
    ]);
    expect([...top]).toEqual([
      ["squat", 205],
      ["row", 95],
    ]);
  });

  it("leaves out bodyweight, cardio and exercises with no weight logged", () => {
    const top = topWeightsByExercise([
      { exercise: { id: "pullup", weight_type: "bodyweight" }, sets: [set(25)] },
      { exercise: { id: "bike", weight_type: "standard", set_type: "cardio" }, sets: [set(0)] },
      { exercise: { id: "plank", weight_type: "standard" }, sets: [set(null), set(0)] },
      { exercise: null, sets: [set(100)] },
    ]);
    expect(top.size).toBe(0);
  });
});

describe("routineExerciseLine", () => {
  const target = { sets: 3, reps: "10" };

  it("gives the scheme and last time's top weight", () => {
    expect(routineExerciseLine(target, 120, "lb", "lbs")).toBe("3 × 10 · 120 lbs last time");
  });

  it("rounds a converted weight for printing", () => {
    expect(routineExerciseLine(target, 102.0582, "kg", "kg")).toBe("3 × 10 · 102.1 kg last time");
  });

  it("gives the scheme alone with no weight from last time", () => {
    expect(routineExerciseLine(target, undefined, "lb", "lbs")).toBe("3 × 10");
    expect(routineExerciseLine(target, null, "lb", "lbs")).toBe("3 × 10");
  });

  it("gives the weight alone with no target", () => {
    expect(routineExerciseLine({ sets: null, reps: null }, 135, "lb", "lbs")).toBe("135 lbs last time");
  });

  it("is null with neither", () => {
    expect(routineExerciseLine({ sets: null, reps: null }, undefined, "lb", "lbs")).toBeNull();
  });
});
