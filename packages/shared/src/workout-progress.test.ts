import { describe, expect, it } from "vitest";

import { mixHex, progressWidths, workoutProgress } from "./workout-progress";

const ex = (checked: number, sets: number) => ({
  sets: Array.from({ length: sets }, (_, i) => ({ completed: i < checked })),
});

describe("workoutProgress", () => {
  it("is empty with no exercises", () => {
    expect(workoutProgress([])).toEqual({ total: 0, done: 0, setFraction: 0 });
    expect(progressWidths(workoutProgress([]))).toEqual({ solid: 0, tint: 0 });
  });

  it("gives solid 40% and tint 46.7% for the spec's example", () => {
    // Five exercises, two done, the third one of three.
    const p = workoutProgress([ex(3, 3), ex(4, 4), ex(1, 3), ex(0, 3), ex(0, 2)]);
    expect(p).toMatchObject({ total: 5, done: 2 });
    const w = progressWidths(p);
    expect(w.solid).toBeCloseTo(0.4);
    expect(w.tint).toBeCloseTo(0.4667, 3);
  });

  it("leaves exercises with no sets out of the total", () => {
    const p = workoutProgress([ex(3, 3), ex(0, 0)]);
    expect(p).toEqual({ total: 1, done: 1, setFraction: 1 });
    expect(progressWidths(p)).toEqual({ solid: 1, tint: 1 });
  });

  it("shrinks when an exercise is added", () => {
    const before = progressWidths(workoutProgress([ex(3, 3), ex(3, 3)]));
    const after = progressWidths(workoutProgress([ex(3, 3), ex(3, 3), ex(0, 3)]));
    expect(before.solid).toBe(1);
    expect(after.solid).toBeCloseTo(2 / 3);
  });

  it("grows the tint, not the solid, for a set on an unfinished exercise", () => {
    const w = progressWidths(workoutProgress([ex(1, 3), ex(0, 3)]));
    expect(w.solid).toBe(0);
    expect(w.tint).toBeCloseTo(1 / 6);
  });
});

describe("mixHex", () => {
  it("matches the mock's ramp stops", () => {
    const stops = ["#B9CCEA", "#9AB4DB", "#7B9DCC", "#5C85BE", "#3D6EAF", "#1E56A0"];
    stops.forEach((hex, i) => expect(mixHex("#B9CCEA", "#1E56A0", i / 5)).toBe(hex));
  });

  it("mixes half with the card for the tint", () => {
    // About #BFD0E8 at 2/5 on white, per the mock.
    expect(mixHex("#7B9DCC", "#FFFFFF", 0.5)).toBe("#BDCEE6");
  });

  it("clamps t", () => {
    expect(mixHex("#000000", "#FFFFFF", -1)).toBe("#000000");
    expect(mixHex("#000000", "#FFFFFF", 2)).toBe("#FFFFFF");
  });
});
