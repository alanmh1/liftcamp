import { describe, expect, it } from "vitest";

import { copyPlan, copyRoutineName, copySkippedLine, isCardioSet, type CopySourceSet } from "./copy-workout";

const set = (position: number, reps: number | null, completed = true, extra: Partial<CopySourceSet> = {}): CopySourceSet => ({
  position,
  reps,
  completed,
  ...extra,
});

describe("copyPlan", () => {
  it("keeps the order, the completed working sets and the most common reps", () => {
    const plan = copyPlan([
      { exerciseId: "pullup", sets: [set(0, 4), set(1, 4), set(2, 3)] },
      { exerciseId: "row", sets: [set(0, 10), set(1, 10), set(2, 8), set(3, 8, false)] },
    ]);
    expect(plan).toEqual({
      exercises: [
        { exerciseId: "pullup", workingSets: 3, warmupSets: 0, targetReps: "4" },
        { exerciseId: "row", workingSets: 3, warmupSets: 0, targetReps: "10" },
      ],
      skippedCustom: 0,
    });
  });

  it("counts completed warm-ups apart from the working sets", () => {
    const plan = copyPlan([
      {
        exerciseId: "squat",
        sets: [
          set(0, 8, true, { set_type: "warmup" }),
          set(1, 5, true, { set_type: "warmup" }),
          set(2, 5, false, { set_type: "warmup" }),
          set(3, 5),
          set(4, 5),
        ],
      },
    ]);
    expect(plan.exercises[0]).toEqual({ exerciseId: "squat", workingSets: 2, warmupSets: 2, targetReps: "5" });
  });

  it("skips custom exercises and counts them", () => {
    const plan = copyPlan([
      { exerciseId: "mine", isCustom: true, sets: [set(0, 10)] },
      { exerciseId: "bench", isCustom: false, sets: [set(0, 8)] },
    ]);
    expect(plan.exercises.map((e) => e.exerciseId)).toEqual(["bench"]);
    expect(plan.skippedCustom).toBe(1);
  });

  it("leaves out exercises with no completed working set, custom or not", () => {
    const plan = copyPlan([
      { exerciseId: "a", sets: [set(0, 10, false)] },
      { exerciseId: "b", isCustom: true, sets: [set(0, 10, true, { set_type: "warmup" })] },
    ]);
    expect(plan).toEqual({ exercises: [], skippedCustom: 0 });
  });

  it("gives cardio no target reps", () => {
    const plan = copyPlan([{ exerciseId: "run", sets: [set(0, null, true, { duration_seconds: 1500, distance_meters: 4000 })] }]);
    expect(plan.exercises[0]).toEqual({ exerciseId: "run", workingSets: 1, warmupSets: 0, targetReps: null });
    expect(isCardioSet({ duration_seconds: null, distance_meters: null })).toBe(false);
  });
});

describe("copySkippedLine", () => {
  it("says nothing when no custom exercise was skipped", () => {
    expect(copySkippedLine({ exercises: [], skippedCustom: 0 })).toBeNull();
  });

  it("counts the skipped ones", () => {
    const one = { exerciseId: "x", workingSets: 3, warmupSets: 0, targetReps: "8" };
    expect(copySkippedLine({ exercises: [one], skippedCustom: 1 })).toBe("1 custom exercise won't copy.");
    expect(copySkippedLine({ exercises: [one], skippedCustom: 2 })).toBe("2 custom exercises won't copy.");
  });

  it("says there is nothing to copy when every exercise was custom", () => {
    expect(copySkippedLine({ exercises: [], skippedCustom: 1 })).toMatch(/nothing to copy/);
    expect(copySkippedLine({ exercises: [], skippedCustom: 3 })).toMatch(/^Every exercise/);
  });
});

describe("copyRoutineName", () => {
  it("names the workout and the friend", () => {
    expect(copyRoutineName("Pull", "will")).toBe("Pull from @will");
    expect(copyRoutineName("  ", "will")).toBe("Workout from @will");
    expect(copyRoutineName("Pull", null)).toBe("Pull from a friend");
  });

  it("cuts a long name and keeps the handle", () => {
    const name = copyRoutineName("x".repeat(80), "will");
    expect(name).toHaveLength(60);
    expect(name.endsWith(" from @will")).toBe(true);
  });
});
