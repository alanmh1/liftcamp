import { describe, expect, it } from "vitest";

import { setPlaceholder, setPlaceholders, targetRepsNumber, type PlaceholderSource } from "./set-placeholder";

const empty: PlaceholderSource = { weight_value: null, reps: null };
const set = (weight_value: number | null, reps: number | null): PlaceholderSource => ({ weight_value, reps });

describe("targetRepsNumber", () => {
  it("takes the low end of a range", () => {
    expect(targetRepsNumber("8-10")).toBe(8);
    expect(targetRepsNumber("12-15")).toBe(12);
    expect(targetRepsNumber(" 6 - 8 ")).toBe(6);
  });

  it("reads a single count and the count before each", () => {
    expect(targetRepsNumber("5")).toBe(5);
    expect(targetRepsNumber("10-12 each")).toBe(10);
    expect(targetRepsNumber("8 each")).toBe(8);
  });

  it("skips timed targets", () => {
    expect(targetRepsNumber("30s")).toBeNull();
    expect(targetRepsNumber("45s")).toBeNull();
    expect(targetRepsNumber("45 sec")).toBeNull();
    expect(targetRepsNumber("1 min")).toBeNull();
    expect(targetRepsNumber("30-45s")).toBeNull();
  });

  it("is null for nothing, or no leading number", () => {
    expect(targetRepsNumber(null)).toBeNull();
    expect(targetRepsNumber("")).toBeNull();
    expect(targetRepsNumber("AMRAP")).toBeNull();
    expect(targetRepsNumber("0")).toBeNull();
  });
});

describe("setPlaceholder source order", () => {
  it("is blank with no history, no target and no cold-start reps", () => {
    expect(setPlaceholder({ sets: [empty, empty], prior: [] }, 1)).toEqual({ weight: null, reps: null });
  });

  it("uses the routine target reps before anything is logged", () => {
    const p = setPlaceholders({ sets: [empty, empty, empty], prior: [], targetReps: "8-10" });
    expect(p.map((x) => x.reps)).toEqual([8, 8, 8]);
    expect(p.every((x) => x.weight == null)).toBe(true);
  });

  it("uses the cold-start reps only when there is no routine target", () => {
    expect(setPlaceholder({ sets: [empty], prior: [], coldReps: 10 }, 0).reps).toBe(10);
    expect(setPlaceholder({ sets: [empty], prior: [], targetReps: "8-10", coldReps: 10 }, 0).reps).toBe(8);
    // A timed target is skipped, and does not fall back to the cold start.
    expect(setPlaceholder({ sets: [empty], prior: [], targetReps: "30s", coldReps: 10 }, 0).reps).toBeNull();
  });

  it("uses the same set number from the last session over the target", () => {
    const prior = [set(100, 8), set(105, 6), set(110, 5)];
    const p = setPlaceholders({ sets: [empty, empty, empty], prior, targetReps: "10-12" });
    expect(p.map((x) => x.weight?.value)).toEqual([100, 105, 110]);
    expect(p.map((x) => x.reps)).toEqual([8, 6, 5]);
  });

  it("repeats the last prior set past its end", () => {
    const p = setPlaceholder({ sets: [empty, empty, empty, empty], prior: [set(100, 8), set(105, 6)] }, 3);
    expect(p).toEqual({ weight: { value: 105, stored: null }, reps: 6 });
  });

  it("puts the nearest filled set above ahead of the last session", () => {
    const prior = [set(100, 8), set(105, 6), set(110, 5)];
    const p = setPlaceholders({ sets: [set(120, 5), empty, empty], prior });
    expect(p[1]).toEqual({ weight: { value: 120, stored: null }, reps: 5 });
    expect(p[2]).toEqual({ weight: { value: 120, stored: null }, reps: 5 });
  });

  it("takes the nearest filled set, not the first", () => {
    const p = setPlaceholder({ sets: [set(100, 10), set(110, 8), empty], prior: [] }, 2);
    expect(p).toEqual({ weight: { value: 110, stored: null }, reps: 8 });
  });

  it("resolves weight and reps separately", () => {
    // Set 1 has only a weight typed, so reps still come from the last session.
    const p = setPlaceholder({ sets: [set(120, null), empty], prior: [set(100, 8), set(100, 7)] }, 1);
    expect(p).toEqual({ weight: { value: 120, stored: null }, reps: 7 });
  });

  it("never looks at sets below", () => {
    const p = setPlaceholder({ sets: [empty, set(120, 5)], prior: [], targetReps: "8" }, 0);
    expect(p).toEqual({ weight: null, reps: 8 });
  });

  it("gives a body-only exercise reps only", () => {
    const p = setPlaceholder({ sets: [set(10, 12), empty], prior: [set(5, 10)], repsOnly: true }, 1);
    expect(p).toEqual({ weight: null, reps: 12 });
  });

  it("carries the stored weight so an unedited placeholder logs as it was logged", () => {
    const stored = { weight_value: 225, weight_unit: "lb" as const };
    const prior: PlaceholderSource[] = [{ weight_value: 102.058, reps: 5, stored }];
    expect(setPlaceholder({ sets: [empty], prior }, 0).weight).toEqual({ value: 102.058, stored });
    // And through a set above that was logged from it unedited.
    const sets: PlaceholderSource[] = [{ weight_value: 102.058, reps: 5, stored }, empty];
    expect(setPlaceholder({ sets, prior: [] }, 1).weight).toEqual({ value: 102.058, stored });
  });
});

describe("setPlaceholder with a Pro suggestion", () => {
  const prior = [set(70, 10), set(70, 10), set(70, 10)];
  const suggested = [set(75, 8), set(75, 8), set(75, 8)];

  it("puts the suggestion ahead of the last session", () => {
    const p = setPlaceholders({ sets: [empty, empty, empty], prior, suggested, targetReps: "8-10" });
    expect(p.map((x) => x.weight?.value)).toEqual([75, 75, 75]);
    expect(p.map((x) => x.reps)).toEqual([8, 8, 8]);
  });

  it("keeps the nearest filled set above ahead of the suggestion", () => {
    const p = setPlaceholders({ sets: [set(80, 6), empty, empty], prior, suggested });
    expect(p[1]).toEqual({ weight: { value: 80, stored: null }, reps: 6 });
  });

  it("falls through to the last session for a field the suggestion leaves empty", () => {
    const p = setPlaceholder({ sets: [empty], prior, suggested: [set(null, 11)] }, 0);
    expect(p).toEqual({ weight: { value: 70, stored: null }, reps: 11 });
  });

  it("falls through for a set past the suggestion's end", () => {
    const p = setPlaceholder({ sets: [empty, empty], prior, suggested: [set(75, 8)] }, 1);
    expect(p).toEqual({ weight: { value: 70, stored: null }, reps: 10 });
  });

  it("carries the suggestion's stored weight", () => {
    const stored = { weight_value: 225, weight_unit: "lb" as const };
    const p = setPlaceholder({ sets: [empty], prior: [], suggested: [{ weight_value: 102.058, reps: 9, stored }] }, 0);
    expect(p.weight).toEqual({ value: 102.058, stored });
  });

  it("keeps a body-only exercise reps only", () => {
    const p = setPlaceholder({ sets: [empty], prior, suggested: [set(10, 12)], repsOnly: true }, 0);
    expect(p).toEqual({ weight: null, reps: 12 });
  });

  it("is the free order with no suggestion, null or empty", () => {
    const free = setPlaceholders({ sets: [empty, empty], prior });
    expect(setPlaceholders({ sets: [empty, empty], prior, suggested: null })).toEqual(free);
    expect(setPlaceholders({ sets: [empty, empty], prior, suggested: [] })).toEqual(free);
  });
});
