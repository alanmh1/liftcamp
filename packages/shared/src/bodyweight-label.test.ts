import { describe, expect, it } from "vitest";

import { formatBodyweight, formatPreviousSet, isBodyweightLoad } from "./bodyweight-label";

const legRaise = { weight_type: "bodyweight", equipment: "body only" };
const pushUp = { weight_type: "standard", equipment: "body only" };
const bench = { weight_type: "standard", equipment: "barbell" };

describe("isBodyweightLoad", () => {
  it("is true for bodyweight-type and body-only exercises", () => {
    expect(isBodyweightLoad(legRaise)).toBe(true);
    expect(isBodyweightLoad(pushUp)).toBe(true);
    expect(isBodyweightLoad({ weight_type: "bodyweight", equipment: "other" })).toBe(true);
    expect(isBodyweightLoad(bench)).toBe(false);
  });
});

describe("formatBodyweight", () => {
  it("prints bodyweight alone, added load and assist", () => {
    expect(formatBodyweight(null, "lb")).toBe("BW");
    expect(formatBodyweight(0, "lb")).toBe("BW");
    expect(formatBodyweight(10, "lb")).toBe("BW +10");
    expect(formatBodyweight(-20, "lb")).toBe("BW −20");
    expect(formatBodyweight(10, "lb", true)).toBe("BW +10 lbs");
    expect(formatBodyweight(-15, "kg", true)).toBe("BW −15 kg");
    expect(formatBodyweight(4.5359237, "kg")).toBe("BW +4.5");
  });
});

describe("formatPreviousSet", () => {
  it("prints BW for a body-only set, never 0", () => {
    expect(formatPreviousSet({ weight_value: 0, reps: 12 }, "lb", legRaise)).toBe("BW × 12");
    expect(formatPreviousSet({ weight_value: null, reps: 12 }, "lb", pushUp)).toBe("BW × 12");
    expect(formatPreviousSet({ weight_value: 10, reps: 12 }, "lb", pushUp)).toBe("BW +10 × 12");
    expect(formatPreviousSet({ weight_value: -20, reps: 8 }, "lb", legRaise)).toBe("BW −20 × 8");
  });

  it("prints weight × reps for anything else", () => {
    expect(formatPreviousSet({ weight_value: 140, reps: 10 }, "lb", bench)).toBe("140 × 10");
    expect(formatPreviousSet({ weight_value: 140, reps: null }, "lb", bench)).toBe("140");
    expect(formatPreviousSet({ weight_value: null, reps: 10 }, "lb", bench)).toBe("10");
  });

  it("is a dash with nothing logged", () => {
    expect(formatPreviousSet(null, "lb", bench)).toBe("—");
    expect(formatPreviousSet({ weight_value: null, reps: null }, "lb", legRaise)).toBe("—");
  });
});
