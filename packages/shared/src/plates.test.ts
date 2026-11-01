import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLATES,
  availablePlates,
  barWeight,
  barWeightFor,
  barWeightForUnitChange,
  perSideLabel,
  plateColor,
  plateShortfall,
  platesForWeight,
  usesBar,
} from "./plates";

const lb = DEFAULT_PLATES.lb;
const kg = DEFAULT_PLATES.kg;

describe("platesForWeight", () => {
  it("puts one 45 a side for 135 on a 45 bar", () => {
    expect(platesForWeight(135, 45, lb)).toEqual({ perSide: [45], exact: true, closest: 135 });
  });

  it("uses as many pairs of a plate as it takes", () => {
    expect(platesForWeight(225, 45, lb).perSide).toEqual([45, 45]);
    expect(platesForWeight(315, 45, lb).perSide).toEqual([45, 45, 45]);
  });

  it("goes largest first", () => {
    expect(platesForWeight(205, 45, lb)).toEqual({ perSide: [45, 35], exact: true, closest: 205 });
    expect(platesForWeight(115, 45, lb).perSide).toEqual([35]);
    expect(platesForWeight(185, 45, lb).perSide).toEqual([45, 25]);
    expect(platesForWeight(140, 45, lb).perSide).toEqual([45, 2.5]);
  });

  it("loads the closest weight under a target the plates cannot make", () => {
    // The defaults have no 1.25s.
    expect(platesForWeight(137.5, 45, lb)).toEqual({ perSide: [45], exact: false, closest: 135 });
    expect(platesForWeight(137.5, 45, [...lb, 1.25])).toEqual({ perSide: [45, 1.25], exact: true, closest: 137.5 });
  });

  it("is the bar alone at or under the bar", () => {
    expect(platesForWeight(30, 45, lb)).toEqual({ perSide: [], exact: false, closest: 45 });
    expect(platesForWeight(45, 45, lb)).toEqual({ perSide: [], exact: true, closest: 45 });
  });

  it("works in kg with the kg defaults", () => {
    expect(platesForWeight(100, 20, kg)).toEqual({ perSide: [20, 20], exact: true, closest: 100 });
    expect(platesForWeight(62.5, 20, kg)).toEqual({ perSide: [20, 1.25], exact: true, closest: 62.5 });
    expect(platesForWeight(61, 20, kg)).toEqual({ perSide: [20], exact: false, closest: 60 });
  });

  it("uses only the plates given", () => {
    expect(platesForWeight(135, 45, [25, 10])).toEqual({ perSide: [25, 10, 10], exact: true, closest: 135 });
    expect(platesForWeight(150, 45, [45, 25])).toEqual({ perSide: [45], exact: false, closest: 135 });
  });
});

describe("perSideLabel", () => {
  it("lists the plates, or says it is the bar", () => {
    expect(perSideLabel(platesForWeight(205, 45, lb))).toBe("Per side 45, 35");
    expect(perSideLabel(platesForWeight(45, 45, lb))).toBe("Just the bar");
  });
});

describe("barWeight", () => {
  it("defaults to 45 lb and 20 kg", () => {
    expect(barWeight("lb", null)).toBe(45);
    expect(barWeight("kg", {})).toBe(20);
  });

  it("keeps a chip and ignores anything else", () => {
    expect(barWeight("lb", { bar_weight: 35 })).toBe(35);
    expect(barWeight("kg", { bar_weight: 10 })).toBe(10);
    expect(barWeight("lb", { bar_weight: 40 })).toBe(45);
    expect(barWeight("kg", { bar_weight: 45 })).toBe(20);
  });
});

describe("availablePlates", () => {
  it("defaults to every plate but 55 and 1.25 in lb, and 25 and 0.5 in kg", () => {
    expect(availablePlates("lb", null)).toEqual([45, 35, 25, 10, 5, 2.5]);
    expect(availablePlates("kg", null)).toEqual([20, 15, 10, 5, 2.5, 1.25]);
  });

  it("reads a stored list, heaviest first, offered plates only", () => {
    expect(availablePlates("lb", { plate_inventory: [10, 45, 25] })).toEqual([45, 25, 10]);
    expect(availablePlates("lb", { plate_inventory: [45, 7, "25"] })).toEqual([45]);
  });

  it("falls back to the defaults for an empty or unreadable list", () => {
    expect(availablePlates("lb", { plate_inventory: [] })).toEqual([...lb]);
    expect(availablePlates("lb", { plate_inventory: { "45": 4 } })).toEqual([...lb]);
    expect(availablePlates("kg", { plate_inventory: [45, 35] })).toEqual([...kg]);
  });
});

describe("barWeightFor", () => {
  it("is the user's bar on a barbell or Smith machine and 25 lb or 10 kg on an EZ bar", () => {
    expect(barWeightFor({ equipment: "barbell" }, "lb", 35)).toBe(35);
    expect(barWeightFor({ equipment: "smith machine" }, "lb", 45)).toBe(45);
    expect(barWeightFor({ equipment: "e-z curl bar" }, "lb", 45)).toBe(25);
    expect(barWeightFor({ equipment: "e-z curl bar" }, "kg", 20)).toBe(10);
    expect(barWeightFor({ equipment: "dumbbell" }, "lb", 45)).toBeNull();
  });

  it("usesBar matches the same equipment", () => {
    expect(usesBar({ equipment: "barbell" })).toBe(true);
    expect(usesBar({ equipment: "e-z curl bar" })).toBe(true);
    expect(usesBar({ equipment: "cable" })).toBe(false);
  });
});

describe("barWeightForUnitChange", () => {
  it("moves a chip to the same place in the other unit", () => {
    expect(barWeightForUnitChange(45, "lb", "kg")).toBe(20);
    expect(barWeightForUnitChange(35, "lb", "kg")).toBe(15);
    expect(barWeightForUnitChange(15, "lb", "kg")).toBe(10);
    expect(barWeightForUnitChange(20, "kg", "lb")).toBe(45);
  });

  it("keeps null, clears anything that was not a chip, and leaves a same-unit write alone", () => {
    expect(barWeightForUnitChange(null, "lb", "kg")).toBeNull();
    expect(barWeightForUnitChange(40, "lb", "kg")).toBeNull();
    expect(barWeightForUnitChange(35, "lb", "lb")).toBe(35);
  });
});

describe("plateColor", () => {
  it("follows the competition colours in lb and kg", () => {
    expect([55, 45, 35, 25, 10, 5, 2.5, 1.25].map((p) => plateColor(p, "lb"))).toEqual([
      "red", "blue", "yellow", "green", "white", "red", "small", "small",
    ]);
    expect([25, 20, 15, 10, 5, 2.5, 1.25, 0.5].map((p) => plateColor(p, "kg"))).toEqual([
      "red", "blue", "yellow", "green", "white", "red", "small", "small",
    ]);
  });
});

describe("plateShortfall", () => {
  it("names the closest weight when the plates cannot make it", () => {
    expect(plateShortfall(137.5, platesForWeight(137.5, 45, lb))).toEqual({
      before: "Your plates can't make 137.5. Closest is ",
      closest: 135,
    });
    expect(plateShortfall(135, platesForWeight(135, 45, lb))).toBeNull();
  });
});
