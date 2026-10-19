import { describe, expect, it } from "vitest";

import { computePrSetIds } from "./pr";
import { normalizePriorSets } from "./prior-session";
import {
  convertWeight,
  roundForDisplay,
  storedWeightOf,
  tidyWeight,
  toUserUnit,
  weightToWrite,
} from "./units";

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
  it("shows a converted weight rounded to 0.1", () => {
    expect(tidyWeight(convertWeight(225, "lb", "kg"), "kg")).toBe(102.1);
  });

  it("keeps a typed or stepped weight", () => {
    expect(tidyWeight(26.25, "kg")).toBe(26.25);
    expect(tidyWeight(135, "lb")).toBe(135);
    expect(tidyWeight(null, "lb")).toBeNull();
  });

  it("drops float noise from a sum", () => {
    expect(String(tidyWeight(68.1 + 0.1, "kg"))).toBe("68.2");
    expect(String(tidyWeight(0.1 + 0.2, "kg"))).toBe("0.3");
  });
});

describe("storedWeightOf and weightToWrite", () => {
  it("keeps the stored weight only when it was converted", () => {
    expect(storedWeightOf(225, "lb", "kg")).toEqual({ weight_value: 225, weight_unit: "lb" });
    expect(storedWeightOf(225, "lb", "lb")).toBeNull();
    expect(storedWeightOf(null, "lb", "kg")).toBeNull();
  });

  it("writes the stored weight when unedited and the typed one when edited", () => {
    const stored = storedWeightOf(225, "lb", "kg");
    const shown = convertWeight(225, "lb", "kg");
    expect(weightToWrite(shown, stored, "kg")).toEqual({ weight_value: 225, weight_unit: "lb" });
    expect(weightToWrite(102.5, null, "kg")).toEqual({ weight_value: 102.5, weight_unit: "kg" });
  });
});

describe("a seeded set on a kg account", () => {
  // The source: 225 x 5 logged in lb. The account has since switched to kg.
  const source = { id: "source", weight: "", weight_value: 225, weight_unit: "lb", reps: 5, created_at: "2026-09-20T10:00:00Z" };

  /** The seed as the data layer builds it: prior read, converted, written back. */
  function seedFrom(unit: "kg") {
    const [prior] = normalizePriorSets([{ created_at: source.created_at, sets: [{ ...source, position: 0, completed: true }] }]);
    const shown = toUserUnit(prior, unit).weight_value;
    const stored = storedWeightOf(prior.weight_value, prior.weight_unit, unit);
    return { shown, write: weightToWrite(shown, stored, unit) };
  }

  it("shows the source converted", () => {
    expect(tidyWeight(seedFrom("kg").shown, "kg")).toBe(102.1);
  });

  it("is not a PR against its source when completed unedited", () => {
    const { write } = seedFrom("kg");
    const seeded = { id: "seeded", weight: "", ...write, reps: 5, created_at: "2026-09-24T10:00:00Z" };
    const sets = [source, seeded].map((s) => toUserUnit(s, "kg"));
    expect([...computePrSetIds(sets)]).toEqual(["source"]);
  });

  it("would be a PR if the rounded conversion were written instead", () => {
    const seeded = { id: "seeded", weight: "", weight_value: 102.1, weight_unit: "kg", reps: 5, created_at: "2026-09-24T10:00:00Z" };
    const sets = [source, seeded].map((s) => toUserUnit(s, "kg"));
    expect([...computePrSetIds(sets)]).toEqual(["source", "seeded"]);
  });
});
