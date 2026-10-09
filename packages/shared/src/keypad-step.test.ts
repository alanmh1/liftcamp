import { describe, expect, it } from "vitest";

import { KEYPAD_REPS_STEP, keypadWeightStep } from "./keypad-step";
import type { ProgressionExercise } from "./progression";
import { TIMED_EXERCISES } from "./set-weight";

const exercise = (over: Partial<ProgressionExercise> = {}): ProgressionExercise => ({
  id: "ex",
  equipment: "barbell",
  weight_type: "standard",
  mechanic: "compound",
  primary_muscle: "chest",
  is_unilateral: false,
  ...over,
});

/** [label, exercise, lb step, kg step] */
const cases: [string, ProgressionExercise, number, number][] = [
  ["upper-body barbell", exercise(), 5, 2.5],
  ["lower-body barbell compound", exercise({ primary_muscle: "quads" }), 5, 2.5],
  ["barbell deadlift (lower back)", exercise({ primary_muscle: "lower back" }), 5, 2.5],
  ["barbell isolation on the legs", exercise({ primary_muscle: "quads", mechanic: "isolation" }), 5, 2.5],
  ["EZ bar", exercise({ equipment: "e-z curl bar", mechanic: "isolation", primary_muscle: "biceps" }), 5, 2.5],
  ["Smith machine squat", exercise({ equipment: "smith machine", primary_muscle: "quads" }), 5, 2.5],
  ["machine", exercise({ equipment: "machine" }), 10, 5],
  ["cable", exercise({ equipment: "cable" }), 5, 2.5],
  ["dumbbell", exercise({ equipment: "dumbbell" }), 2.5, 1],
  ["kettlebell", exercise({ equipment: "kettlebells" }), 5, 2],
  ["body only", exercise({ equipment: "body only" }), 5, 2.5],
  ["bodyweight type", exercise({ equipment: "body only", weight_type: "bodyweight" }), 5, 2.5],
  ["assisted machine", exercise({ equipment: "machine", weight_type: "bodyweight" }), 5, 2.5],
  ["bands", exercise({ equipment: "bands" }), 2.5, 2.5],
  ["medicine ball", exercise({ equipment: "medicine ball" }), 2.5, 2.5],
  ["other", exercise({ equipment: "other" }), 2.5, 2.5],
  ["foam roll", exercise({ equipment: "foam roll" }), 2.5, 2.5],
  ["no equipment recorded", exercise({ equipment: null }), 2.5, 2.5],
  ["timed exercise", exercise({ id: TIMED_EXERCISES[0], equipment: "body only", weight_type: "bodyweight" }), 2.5, 2.5],
];

describe("keypadWeightStep", () => {
  it.each(cases)("%s: %d lb, %d kg", (_label, ex, lb, kg) => {
    expect(keypadWeightStep(ex, "lb")).toBe(lb);
    expect(keypadWeightStep(ex, "kg")).toBe(kg);
  });

  it("steps dumbbells by 2.5 lb, finer than the progression ladder's 5", () => {
    expect(keypadWeightStep(exercise({ equipment: "dumbbell" }), "lb")).toBe(2.5);
  });

  it("steps barbells by the smallest plate pair, not the progression increment of 10 lb", () => {
    expect(keypadWeightStep(exercise({ primary_muscle: "glutes" }), "lb")).toBe(5);
    expect(keypadWeightStep(exercise({ equipment: "Smith Machine", primary_muscle: "hamstrings" }), "kg")).toBe(2.5);
  });

  it("reads equipment regardless of case and padding", () => {
    expect(keypadWeightStep(exercise({ equipment: " Machine " }), "lb")).toBe(10);
    expect(keypadWeightStep(exercise({ equipment: "Kettlebells" }), "kg")).toBe(2);
  });

  it("steps reps by one", () => {
    expect(KEYPAD_REPS_STEP).toBe(1);
  });
});
