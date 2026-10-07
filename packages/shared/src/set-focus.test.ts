import { describe, expect, it } from "vitest";

import { currentSetFocus, formatLastLine, formatSetLine, lastLineRepeats, upNextFocus, upNextLine } from "./set-focus";

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

describe("lastLineRepeats", () => {
  const standard = { weight_type: "standard", equipment: "barbell" };
  const bodyweight = { weight_type: "bodyweight", equipment: "body only" };
  const prior = [
    { weight_value: 140, reps: 10 },
    { weight_value: 145, reps: 8 },
  ];

  it("is true when the set matches last time's set at the same position", () => {
    expect(lastLineRepeats({ weight_value: 140, reps: 10 }, prior, 0, "lb", standard)).toBe(true);
    expect(lastLineRepeats({ weight_value: 145, reps: 8 }, prior, 1, "lb", standard)).toBe(true);
  });

  it("is true for an untouched set, which shows last time's values", () => {
    expect(lastLineRepeats({ weight_value: null, reps: null }, prior, 0, "lb", standard)).toBe(true);
    expect(lastLineRepeats({ weight_value: 140, reps: null }, prior, 0, "lb", standard)).toBe(true);
  });

  it("is false when the weight or reps differ", () => {
    expect(lastLineRepeats({ weight_value: 145, reps: 10 }, prior, 0, "lb", standard)).toBe(false);
    expect(lastLineRepeats({ weight_value: 140, reps: 9 }, prior, 0, "lb", standard)).toBe(false);
    expect(lastLineRepeats({ weight_value: 140, reps: 10 }, prior, 1, "lb", standard)).toBe(false);
  });

  it("uses the last prior set past the end", () => {
    expect(lastLineRepeats({ weight_value: 145, reps: 8 }, prior, 4, "lb", standard)).toBe(true);
  });

  it("treats 0 and an empty box as the same bodyweight", () => {
    expect(lastLineRepeats({ weight_value: null, reps: 12 }, [{ weight_value: 0, reps: 12 }], 0, "lb", bodyweight)).toBe(true);
    expect(lastLineRepeats({ weight_value: 10, reps: 12 }, [{ weight_value: 0, reps: 12 }], 0, "lb", bodyweight)).toBe(false);
  });

  it("is false with no prior session or no set", () => {
    expect(lastLineRepeats({ weight_value: 140, reps: 10 }, [], 0, "lb", standard)).toBe(false);
    expect(lastLineRepeats(null, prior, 0, "lb", standard)).toBe(false);
  });
});

describe("upNextFocus", () => {
  it("takes the next open set of the exercise that started the rest", () => {
    const w = { exercises: [ex("a", 0, [s(false)]), ex("b", 1, [s(true), s(true), s(false)])] };
    const f = upNextFocus(w, "b");
    expect(f?.exercise.exercise.id).toBe("b");
    expect(f).toMatchObject({ setIndex: 3, setCount: 3 });
    expect(f?.set).toBe(w.exercises[1].sets[2]);
  });

  it("moves to the next exercise by position once that exercise is done", () => {
    const w = { exercises: [ex("c", 2, [s(false), s(false)]), ex("a", 0, [s(false)]), ex("b", 1, [s(true), s(true)])] };
    const f = upNextFocus(w, "b");
    expect(f?.exercise.exercise.id).toBe("c");
    expect(f).toMatchObject({ setIndex: 1, setCount: 2 });
  });

  it("goes back to an earlier exercise with sets left when nothing after it has any", () => {
    const w = { exercises: [ex("a", 0, [s(true), s(false)]), ex("b", 1, [s(true)]), ex("c", 2, [s(true)])] };
    expect(upNextFocus(w, "b")).toMatchObject({ setIndex: 2, setCount: 2 });
    expect(upNextFocus(w, "b")?.exercise.exercise.id).toBe("a");
  });

  it("skips exercises with no sets", () => {
    const w = { exercises: [ex("a", 0, [s(true)]), ex("b", 1, []), ex("c", 2, [s(false)])] };
    expect(upNextFocus(w, "a")?.exercise.exercise.id).toBe("c");
  });

  it("takes the first open set by position with no rest exercise", () => {
    const w = { exercises: [ex("b", 1, [s(false)]), ex("a", 0, [s(true), s(false)])] };
    expect(upNextFocus(w, null)?.exercise.exercise.id).toBe("a");
    expect(upNextFocus(w, "gone")?.exercise.exercise.id).toBe("a");
  });

  it("is null when every set is done", () => {
    expect(upNextFocus({ exercises: [ex("a", 0, [s(true)])] }, "a")).toBeNull();
    expect(upNextFocus({ exercises: [] }, null)).toBeNull();
  });
});

describe("upNextLine", () => {
  it("puts the set first, then Up next and its number", () => {
    expect(upNextLine("135 lbs × 12", 3, 3)).toBe("135 lbs × 12 · Up next · set 3 of 3");
    expect(upNextLine("BW × 12", 1, 4)).toBe("BW × 12 · Up next · set 1 of 4");
    expect(upNextLine(null, 2, 3)).toBe("Up next · set 2 of 3");
  });
});
