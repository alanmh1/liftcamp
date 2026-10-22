import { describe, expect, it } from "vitest";

import { keypadWeightStep } from "./keypad-step";
import { PERCENT_STEPS, percentWeight } from "./percent-adjust";
import type { ProgressionExercise } from "./progression";

const exercise = (over: Partial<ProgressionExercise> = {}): ProgressionExercise => ({
  id: "ex",
  equipment: "barbell",
  weight_type: "standard",
  mechanic: "compound",
  primary_muscle: "chest",
  is_unilateral: false,
  ...over,
});

describe("percentWeight", () => {
  it("takes 25% off 77 kg to 57.5", () => {
    expect(percentWeight(77, null, -0.25, "kg")).toBe(57.5);
  });

  it("takes 25% off 100 lb to 75", () => {
    expect(percentWeight(100, null, -0.25, "lb")).toBe(75);
  });

  it("rounds to the nearest 2.5 with no step given", () => {
    // 77 × 0.7 = 53.9, 77 × 0.8 = 61.6
    expect(percentWeight(77, null, -0.3, "kg")).toBe(55);
    expect(percentWeight(77, null, -0.2, "kg")).toBe(62.5);
    // 135 × 0.75 = 101.25, 135 × 0.7 = 94.5
    expect(percentWeight(135, null, -0.25, "lb")).toBe(102.5);
    expect(percentWeight(135, null, -0.3, "lb")).toBe(95);
  });

  it("rounds to the equipment step", () => {
    const barbell = exercise();
    const dumbbell = exercise({ equipment: "dumbbell" });
    const machine = exercise({ equipment: "machine" });
    // Barbell: 5 lb, 2.5 kg.
    expect(percentWeight(135, null, -0.25, "lb", keypadWeightStep(barbell, "lb"))).toBe(100);
    expect(percentWeight(77, null, -0.25, "kg", keypadWeightStep(barbell, "kg"))).toBe(57.5);
    // Dumbbell: 2.5 lb, 1 kg. 77 × 0.75 = 57.75.
    expect(percentWeight(77, null, -0.25, "kg", keypadWeightStep(dumbbell, "kg"))).toBe(58);
    expect(percentWeight(45, null, -0.2, "lb", keypadWeightStep(dumbbell, "lb"))).toBe(35);
    // Machine: 10 lb, 5 kg. 150 × 0.7 = 105, 150 × 0.75 = 112.5.
    expect(percentWeight(150, null, -0.3, "lb", keypadWeightStep(machine, "lb"))).toBe(110);
    expect(percentWeight(150, null, -0.25, "lb", keypadWeightStep(machine, "lb"))).toBe(110);
    expect(percentWeight(60, null, -0.25, "kg", keypadWeightStep(machine, "kg"))).toBe(45);
  });

  it("works from the placeholder when the box is empty", () => {
    expect(percentWeight(null, 100, -0.25, "lb")).toBe(75);
  });

  it("works from the value, not the placeholder, when the box is filled", () => {
    expect(percentWeight(80, 100, -0.25, "lb")).toBe(60);
  });

  it("is null with no value at all", () => {
    expect(percentWeight(null, null, -0.25, "kg")).toBeNull();
  });

  it("is null for a weight of 0", () => {
    expect(percentWeight(0, 100, -0.25, "lb")).toBeNull();
  });

  it("works from a converted weight as the box prints it", () => {
    // 46.3 kg is 102.074 lb; the box prints 102.1. 102.1 × 0.75 = 76.575.
    expect(percentWeight(102.074, null, -0.25, "lb")).toBe(77.5);
  });

  it("has three chips, -30%, -25%, -20%", () => {
    expect(PERCENT_STEPS).toEqual([-0.3, -0.25, -0.2]);
  });
});
