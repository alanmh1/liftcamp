import { describe, expect, it } from "vitest";

import { loadRuleFor, type ProgressionExercise } from "./progression";
import type { WeightUnit } from "./units";
import { warmupSets } from "./warmups";

const exercise = (over: Partial<ProgressionExercise> = {}): ProgressionExercise => ({
  id: "ex",
  equipment: "barbell",
  weight_type: "standard",
  mechanic: "compound",
  primary_muscle: "chest",
  ...over,
});

/** `[weight, reps]` for each generated warm-up. */
function warmups(ex: ProgressionExercise, weight: number, unit: WeightUnit = "lb", bar = unit === "kg" ? 20 : 45) {
  return warmupSets({ weight, reps: 8 }, loadRuleFor(ex, unit), ex, unit, bar).map((s) => {
    expect(s.role).toBe("warmup");
    expect(s.generated).toBe(true);
    return [s.weight?.value, s.reps];
  });
}

const bench = exercise();
const squat = exercise({ primary_muscle: "quads" });

describe("warmupSets on a bar", () => {
  it("gives none at or under the empty bar", () => {
    expect(warmups(bench, 45)).toEqual([]);
    expect(warmups(bench, 40)).toEqual([]);
  });

  it("gives one set at 50% up to twice the bar, never under the bar", () => {
    // 50% of 65 rounds to 35, under the bar.
    expect(warmups(bench, 65)).toEqual([[45, 8]]);
    expect(warmups(bench, 90)).toEqual([[45, 8]]);
  });

  it("gives two sets over twice the bar", () => {
    expect(warmups(bench, 135)).toEqual([
      [70, 6],
      [100, 3],
    ]);
  });

  it("gives three sets over three times the bar, the first the empty bar", () => {
    expect(warmups(bench, 185)).toEqual([
      [45, 8],
      [100, 5],
      [150, 2],
    ]);
  });

  it("rounds to the lift's step", () => {
    // Lower-body barbell compounds step by 10.
    expect(warmups(squat, 125)).toEqual([
      [60, 6],
      [90, 3],
    ]);
  });

  it("uses the bar weight setting", () => {
    expect(warmups(bench, 65, "lb", 35)).toEqual([[35, 8]]);
    expect(warmups(bench, 75, "lb", 35)).toEqual([
      [40, 6],
      [55, 3],
    ]);
  });

  it("uses 25 lb for an EZ bar", () => {
    expect(warmups(exercise({ equipment: "e-z curl bar" }), 60)).toEqual([
      [30, 6],
      [45, 3],
    ]);
  });

  it("works in kg", () => {
    expect(warmups(bench, 60, "kg")).toEqual([
      [30, 6],
      [45, 3],
    ]);
    expect(warmups(bench, 20, "kg")).toEqual([]);
  });
});

describe("warmupSets on dumbbells, kettlebells, machines and cables", () => {
  const db = exercise({ equipment: "dumbbell" });

  it("gives none for dumbbells under 20 lb or 10 kg", () => {
    expect(warmups(db, 15)).toEqual([]);
    expect(warmups(db, 8, "kg")).toEqual([]);
  });

  it("rounds 50% onto the dumbbell ladder", () => {
    expect(warmups(db, 20)).toEqual([[10, 8]]);
    // 12.5 is nearer 12 than 15.
    expect(warmups(db, 25)).toEqual([[12, 8]]);
    // 5 kg sits between 4 and 6: the lighter one.
    expect(warmups(db, 10, "kg")).toEqual([[4, 8]]);
  });

  it("gives kettlebells the same", () => {
    expect(warmups(exercise({ equipment: "kettlebells" }), 20)).toEqual([[10, 8]]);
  });

  it("gives a machine or cable compound one set at 50%", () => {
    expect(warmups(exercise({ equipment: "machine" }), 100)).toEqual([[50, 8]]);
    expect(warmups(exercise({ equipment: "cable", primary_muscle: "lats" }), 60)).toEqual([[30, 8]]);
  });

  it("drops a warm-up that would reach the working weight", () => {
    // 50% of 10 rounds up to the 10 lb floor.
    expect(warmups(exercise({ equipment: "machine" }), 10)).toEqual([]);
  });
});

describe("warmupSets gives none", () => {
  it("for isolation exercises", () => {
    expect(warmups(exercise({ mechanic: "isolation", equipment: "dumbbell" }), 30)).toEqual([]);
    expect(warmups(exercise({ mechanic: "isolation" }), 95)).toEqual([]);
  });

  it("for bodyweight, reps-only and cardio rules", () => {
    expect(warmups(exercise({ equipment: "body only" }), 20)).toEqual([]);
    expect(warmups(exercise({ weight_type: "bodyweight", equipment: "other" }), 20)).toEqual([]);
    expect(warmups(exercise({ equipment: "bands" }), 20)).toEqual([]);
    expect(warmups(exercise({ equipment: "machine", set_type: "cardio" }), 100)).toEqual([]);
  });

  it("for a missing working weight", () => {
    expect(warmups(bench, 0)).toEqual([]);
  });
});
