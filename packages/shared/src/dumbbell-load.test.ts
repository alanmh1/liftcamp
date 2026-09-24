import { describe, expect, it } from "vitest";

import { ONE_DUMBBELL_EXERCISES, weightIsPerDumbbell } from "./dumbbell-load";

describe("weightIsPerDumbbell", () => {
  it("is true for a two-dumbbell exercise and for a unilateral one", () => {
    expect(weightIsPerDumbbell({ id: "05510482-9385-455f-85b4-96aef279939c", equipment: "dumbbell" })).toBe(true);
    expect(weightIsPerDumbbell({ id: "ba04d7e5-70a6-4031-a941-12238aef452d", equipment: "dumbbell" })).toBe(true);
  });

  it("is false for a one-dumbbell, two-hand movement", () => {
    for (const id of ONE_DUMBBELL_EXERCISES) {
      expect(weightIsPerDumbbell({ id, equipment: "dumbbell" })).toBe(false);
    }
  });

  it("is false for anything that is not a dumbbell", () => {
    expect(weightIsPerDumbbell({ id: "85495e85-bd72-445d-a6c8-5961f17ec2e5", equipment: "barbell" })).toBe(false);
    expect(weightIsPerDumbbell({ id: "43284cd1-4bb4-44c7-87b6-617ed5f03dbf", equipment: "kettlebells" })).toBe(false);
  });
});
