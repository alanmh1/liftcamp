import { describe, expect, it } from "vitest";

import { dumbbellCount } from "./dumbbell-load";
import { effectiveLoad, setVolume } from "./set-weight";

const set = (weight_value: number, reps: number) => ({ weight: "", weight_value, reps });

const DB_BENCH = { id: "05510482-9385-455f-85b4-96aef279939c", equipment: "dumbbell", weight_type: "standard", is_unilateral: false };
const ONE_ARM_ROW = { id: "5e3e2c88-2b18-42fb-b39d-c6aca546d3be", equipment: "dumbbell", weight_type: "standard", is_unilateral: true };
const BULGARIAN = { id: "c5d02e3a-8be2-47b4-bd77-dd5623e3e562", equipment: "dumbbell", weight_type: "standard", is_unilateral: true };
const GOBLET = { id: "43284cd1-4bb4-44c7-87b6-617ed5f03dbf", equipment: "dumbbell", weight_type: "standard", is_unilateral: false };
const SQUAT = { id: "85495e85-bd72-445d-a6c8-5961f17ec2e5", equipment: "barbell", weight_type: "standard", is_unilateral: false };

describe("setVolume with dumbbells", () => {
  it("counts both dumbbells on dumbbell bench: 50 x 10 is 1,000", () => {
    expect(setVolume(set(50, 10), DB_BENCH, null)).toBe(1000);
  });

  it("counts one dumbbell and both sides on a one-arm row: 50 x 10 is 1,000", () => {
    expect(setVolume(set(50, 10), ONE_ARM_ROW, null)).toBe(1000);
  });

  it("counts both dumbbells and both sides on a Bulgarian split squat: 25 x 10 is 1,000", () => {
    expect(setVolume(set(25, 10), BULGARIAN, null)).toBe(1000);
  });

  it("counts one dumbbell on a goblet squat: 50 x 10 is 500", () => {
    expect(setVolume(set(50, 10), GOBLET, null)).toBe(500);
  });

  it("leaves a barbell squat unchanged: 100 x 5 is 500", () => {
    expect(setVolume(set(100, 5), SQUAT, null)).toBe(500);
  });

  it("does not change the load that PRs and estimated max use", () => {
    expect(effectiveLoad(set(50, 10), DB_BENCH, null)).toBe(50);
    expect(effectiveLoad(set(25, 10), BULGARIAN, null)).toBe(25);
  });

  it("counts one dumbbell when the exercise's equipment is unknown", () => {
    expect(dumbbellCount({ weight_type: "standard" } as never)).toBe(1);
    expect(dumbbellCount(null)).toBe(1);
  });
});
