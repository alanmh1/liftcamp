import { describe, expect, it } from "vitest";

import { currentSetFocus, formatLastLine, formatSetLine } from "./set-focus";

const s = (completed: boolean, weight_value: number | null = null, reps: number | null = null) => ({
  completed,
  weight_value,
  reps,
});
const ex = (id: string, position: number, sets: ReturnType<typeof s>[]) => ({ position, exercise: { id }, sets });

describe("currentSetFocus", () => {
  it("is null for a workout with no exercises", () => {
    expect(currentSetFocus({ exercises: [] })).toBeNull();
  });

  it("takes the first exercise by position with a set to do, and its first open set", () => {
    const w = { exercises: [ex("b", 1, [s(false), s(false)]), ex("a", 0, [s(true), s(true), s(false)])] };
    const f = currentSetFocus(w);
    expect(f?.exercise.exercise.id).toBe("a");
    expect(f?.setIndex).toBe(3);
    expect(f?.setCount).toBe(3);
    expect(f?.set).toBe(w.exercises[1].sets[2]);
  });

  it("prefers the hinted exercise while it has a set to do", () => {
    const w = { exercises: [ex("a", 0, [s(false)]), ex("b", 1, [s(true), s(false)])] };
    const f = currentSetFocus(w, "b");
    expect(f?.exercise.exercise.id).toBe("b");
    expect(f?.setIndex).toBe(2);
  });

  it("drops the hint once the hinted exercise is done", () => {
    const w = { exercises: [ex("a", 0, [s(false)]), ex("b", 1, [s(true)])] };
    expect(currentSetFocus(w, "b")?.exercise.exercise.id).toBe("a");
  });

  it("ignores a hint for an exercise not in the workout", () => {
    const w = { exercises: [ex("a", 0, [s(false)])] };
    expect(currentSetFocus(w, "gone")?.exercise.exercise.id).toBe("a");
  });

  it("falls back to the last exercise and its last set when everything is done", () => {
    const w = { exercises: [ex("a", 0, [s(true)]), ex("b", 1, [s(true), s(true)])] };
    const f = currentSetFocus(w);
    expect(f?.exercise.exercise.id).toBe("b");
    expect(f?.setIndex).toBe(2);
    expect(f?.setCount).toBe(2);
  });

  it("skips an exercise with no sets, and reports it as 0 of 0 when it is last", () => {
    expect(currentSetFocus({ exercises: [ex("a", 0, []), ex("b", 1, [s(false)])] })?.exercise.exercise.id).toBe("b");
    const f = currentSetFocus({ exercises: [ex("a", 0, [s(true)]), ex("b", 1, [])] });
    expect(f).toMatchObject({ set: null, setIndex: 0, setCount: 0 });
    expect(f?.exercise.exercise.id).toBe("b");
  });
});

describe("formatSetLine", () => {
  const standard = { weight_type: "standard", equipment: "barbell" };
  const bodyweight = { weight_type: "bodyweight", equipment: "body only" };

  it("prints weight with its unit and reps", () => {
    expect(formatSetLine({ weight_value: 90, reps: 8 }, null, "lb", standard)).toBe("90 lbs × 8");
    expect(formatSetLine({ weight_value: 40, reps: 5 }, null, "kg", standard)).toBe("40 kg × 5");
  });

  it("rounds a converted weight to 0.1", () => {
    expect(formatSetLine({ weight_value: 102.0582, reps: 5 }, null, "kg", standard)).toBe("102.1 kg × 5");
  });

  it("prints bodyweight, added and assisted load", () => {
    expect(formatSetLine({ weight_value: null, reps: 12 }, null, "lb", bodyweight)).toBe("BW × 12");
    expect(formatSetLine({ weight_value: 0, reps: 12 }, null, "lb", bodyweight)).toBe("BW × 12");
    expect(formatSetLine({ weight_value: 10, reps: 6 }, null, "lb", bodyweight)).toBe("BW +10 lbs × 6");
    expect(formatSetLine({ weight_value: -15, reps: 6 }, null, "kg", bodyweight)).toBe("BW −15 kg × 6");
  });

  it("reads a body-only exercise as bodyweight whatever its weight type", () => {
    expect(formatSetLine({ weight_value: null, reps: 10 }, null, "lb", { weight_type: "standard", equipment: "body only" })).toBe(
      "BW × 10",
    );
  });

  it("fills an empty box from the prior set", () => {
    const prior = { weight_value: 85, reps: 8 };
    expect(formatSetLine({ weight_value: null, reps: null }, prior, "lb", standard)).toBe("85 lbs × 8");
    expect(formatSetLine({ weight_value: 90, reps: null }, prior, "lb", standard)).toBe("90 lbs × 8");
    expect(formatSetLine({ weight_value: null, reps: 10 }, prior, "lb", standard)).toBe("85 lbs × 10");
  });

  it("is null when both boxes stay empty", () => {
    expect(formatSetLine({ weight_value: null, reps: null }, null, "lb", standard)).toBeNull();
    expect(formatSetLine({ weight_value: null, reps: null }, { weight_value: null, reps: null }, "lb", bodyweight)).toBeNull();
  });

  it("prints whichever half it has", () => {
    expect(formatSetLine({ weight_value: 135, reps: null }, null, "lb", standard)).toBe("135 lbs");
    expect(formatSetLine({ weight_value: null, reps: 8 }, null, "lb", standard)).toBe("8 reps");
    expect(formatSetLine({ weight_value: null, reps: 1 }, null, "lb", standard)).toBe("1 rep");
  });
});

describe("formatLastLine", () => {
  const standard = { weight_type: "standard", equipment: "barbell" };
  const bodyweight = { weight_type: "bodyweight", equipment: "body only" };
  const prior = [
    { weight_value: 85, reps: 8 },
    { weight_value: 90, reps: 6 },
  ];

  it("is null with no prior session", () => {
    expect(formatLastLine([], 0, "lb", standard)).toBeNull();
  });

  it("prints the prior set at the same position, worded like the set line", () => {
    expect(formatLastLine(prior, 0, "lb", standard)).toBe("Last time 85 lbs × 8");
    expect(formatLastLine(prior, 1, "lb", standard)).toBe("Last time 90 lbs × 6");
  });

  it("uses the last prior set past the end", () => {
    expect(formatLastLine(prior, 4, "lb", standard)).toBe("Last time 90 lbs × 6");
  });

  it("rounds a converted weight", () => {
    expect(formatLastLine([{ weight_value: 38.5554, reps: 8 }], 0, "kg", standard)).toBe("Last time 38.6 kg × 8");
  });

  it("prints bodyweight, added and assisted load", () => {
    expect(formatLastLine([{ weight_value: 0, reps: 12 }], 0, "lb", bodyweight)).toBe("Last time BW × 12");
    expect(formatLastLine([{ weight_value: null, reps: 12 }], 0, "lb", bodyweight)).toBe("Last time BW × 12");
    expect(formatLastLine([{ weight_value: 10, reps: 6 }], 0, "lb", bodyweight)).toBe("Last time BW +10 lbs × 6");
    expect(formatLastLine([{ weight_value: -20, reps: 8 }], 0, "lb", bodyweight)).toBe("Last time BW −20 lbs × 8");
  });

  it("prints whichever half it has", () => {
    expect(formatLastLine([{ weight_value: null, reps: 12 }], 0, "lb", standard)).toBe("Last time 12 reps");
    expect(formatLastLine([{ weight_value: 50, reps: null }], 0, "kg", standard)).toBe("Last time 50 kg");
    expect(formatLastLine([{ weight_value: null, reps: null }], 0, "lb", standard)).toBeNull();
  });
});
