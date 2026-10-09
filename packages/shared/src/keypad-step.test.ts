import { describe, expect, it } from "vitest";

import { KEYPAD_REPS_STEP, keypadWeightStep, steppedWeight } from "./keypad-step";
import type { ProgressionExercise } from "./progression";
import { setPlaceholders, type PlaceholderSource, type SuggestedSource } from "./set-placeholder";
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

describe("steppedWeight", () => {
  it("steps an empty box from its placeholder", () => {
    expect(steppedWeight(null, 115, 5, "lb")).toBe(120);
    expect(steppedWeight(null, 115, -5, "lb")).toBe(110);
  });

  it("steps a filled box from its value, not the placeholder", () => {
    expect(steppedWeight(100, 115, 5, "lb")).toBe(105);
  });

  it("starts from 0 with nothing to step from", () => {
    expect(steppedWeight(null, null, 2.5, "kg")).toBe(2.5);
  });

  it("never goes below 0", () => {
    expect(steppedWeight(2.5, null, -5, "lb")).toBe(0);
  });

  it("steps a converted weight from the value the box prints", () => {
    // 46.3 kg is 102.074 lb; the box prints 102.1.
    expect(steppedWeight(102.074, null, 2.5, "lb")).toBe(104.6);
  });
});

const empty: PlaceholderSource = { weight_value: null, reps: null };

/** The placeholders of three sets after set 1's weight becomes `weight`. */
function fillFrom(weight: number, suggested: SuggestedSource[] | null = null) {
  return setPlaceholders({
    sets: [{ weight_value: weight, reps: null, stored: null }, empty, empty],
    prior: [
      { weight_value: 115, reps: 8 },
      { weight_value: 115, reps: 8 },
      { weight_value: 115, reps: 8 },
    ],
    suggested,
  }).map((p) => p.weight?.value ?? null);
}

describe("the boxes below fill the same from a typed and a stepped weight", () => {
  it("free: set 1 stepped from its 115 placeholder fills sets 2 and 3 with 120, as typing 120 does", () => {
    const placeholder = setPlaceholders({
      sets: [empty, empty, empty],
      prior: [{ weight_value: 115, reps: 8 }],
    })[0].weight?.value ?? null;
    const stepped = steppedWeight(null, placeholder, 5, "lb");
    expect(stepped).toBe(120);
    expect(fillFrom(stepped)).toEqual(fillFrom(120));
    expect(fillFrom(stepped).slice(1)).toEqual([120, 120]);
  });

  it("guest with no history: set 1 stepped up to 120 gives sets 2 and 3 a 120 placeholder", () => {
    let weight = steppedWeight(null, null, 5, "lb");
    while (weight < 120) weight = steppedWeight(weight, null, 5, "lb");
    const placeholders = setPlaceholders({
      sets: [{ weight_value: weight, reps: null, stored: null }, empty, empty],
      prior: [],
    });
    expect(placeholders.map((p) => p.weight?.value ?? null)).toEqual([null, 120, 120]);
  });

  it("Pro: stepped off its suggestion, set 1 fills the sets below, as typed", () => {
    const suggested = [115, 115, 115].map((w) => ({ weight_value: w, reps: 8 }));
    const stepped = steppedWeight(null, 115, 5, "lb");
    expect(fillFrom(stepped, suggested)).toEqual(fillFrom(120, suggested));
    expect(fillFrom(stepped, suggested).slice(1)).toEqual([120, 120]);
  });
});
