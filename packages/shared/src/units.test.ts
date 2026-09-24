import { describe, expect, it } from "vitest";

import { tidyWeight, convertWeight, roundForDisplay, toUserUnit } from "./units";

describe("convertWeight", () => {
  it("returns the input unchanged when the units match", () => {
    expect(convertWeight(225, "lb", "lb")).toBe(225);
    expect(convertWeight(102.5, "kg", "kg")).toBe(102.5);
  });

  it("round trips lb to kg to lb within 0.001", () => {
    for (const lb of [0, 2.5, 45, 135, 225, 315.5, 700]) {
      const back = convertWeight(convertWeight(lb, "lb", "kg"), "kg", "lb");
      expect(Math.abs(back - lb)).toBeLessThan(0.001);
    }
  });

  it("shows 225 lb as 102.1 kg", () => {
    expect(roundForDisplay(convertWeight(225, "lb", "kg"), "kg")).toBe(102.1);
  });

  it("shows 100 kg as 220.5 lbs", () => {
    expect(roundForDisplay(convertWeight(100, "kg", "lb"), "lb")).toBe(220.5);
  });

  it("converts negative (assist) values", () => {
    expect(roundForDisplay(convertWeight(-50, "lb", "kg"), "kg")).toBe(-22.7);
    expect(roundForDisplay(convertWeight(-20, "kg", "lb"), "lb")).toBe(-44.1);
  });
});

describe("toUserUnit", () => {
  it("leaves a set in the user's unit alone", () => {
    const set = { weight: "", weight_value: 225, weight_unit: "lb" };
    expect(toUserUnit(set, "lb")).toBe(set);
  });

  it("converts weight_value and keeps full precision", () => {
    const out = toUserUnit({ weight: "", weight_value: 225, weight_unit: "lb" }, "kg");
    expect(out.weight_value).toBeCloseTo(102.05828, 5);
  });

  it("keeps legacy text as text in the same unit and converts it across units", () => {
    const legacy = { weight: "135", weight_value: null, weight_unit: "lb" };
    expect(toUserUnit(legacy, "lb").weight_value).toBeNull();
    expect(toUserUnit(legacy, "kg").weight_value).toBeCloseTo(61.235, 3);
  });

  it("leaves an empty weight empty", () => {
    const empty = { weight: "", weight_value: null, weight_unit: "lb" };
    expect(toUserUnit(empty, "kg").weight_value).toBeNull();
  });
});

describe("tidyWeight", () => {
  it("rounds a converted weight to 0.1", () => {
    expect(tidyWeight(convertWeight(225, "lb", "kg"), "kg")).toBe(102.1);
  });

  it("keeps a typed or stepped weight", () => {
    expect(tidyWeight(26.25, "kg")).toBe(26.25);
    expect(tidyWeight(135, "lb")).toBe(135);
    expect(tidyWeight(null, "lb")).toBeNull();
  });
});
