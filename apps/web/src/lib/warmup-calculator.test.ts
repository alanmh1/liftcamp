import { describe, expect, it } from "vitest";
import { barbellWarmups } from "./warmup-calculator";

describe("barbellWarmups", () => {
  it("gives no warm-up sets at or under the empty bar", () => {
    expect(barbellWarmups(45, "lb", 45)).toEqual([]);
  });

  it("gives two sets between two and three times the bar", () => {
    expect(barbellWarmups(135, "lb", 45)).toEqual([
      { weight: 70, reps: 6 },
      { weight: 100, reps: 3 },
    ]);
  });

  it("starts with the empty bar past three times the bar", () => {
    expect(barbellWarmups(225, "lb", 45)).toEqual([
      { weight: 45, reps: 8 },
      { weight: 125, reps: 5 },
      { weight: 180, reps: 2 },
    ]);
  });

  it("works in kg on a 20 kg bar", () => {
    expect(barbellWarmups(100, "kg", 20)).toEqual([
      { weight: 20, reps: 8 },
      { weight: 55, reps: 5 },
      { weight: 80, reps: 2 },
    ]);
  });
});
