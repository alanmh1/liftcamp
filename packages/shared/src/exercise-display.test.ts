import { describe, expect, it } from "vitest";

import { equipmentChipLabel, matchesEquipment, sortEquipment } from "./exercise-display";

describe("sortEquipment", () => {
  it("orders by display label with other last", () => {
    expect(
      sortEquipment(["other", "machine", "body only", "e-z curl bar", "bands", "barbell", "foam roll"]),
    ).toEqual(["bands", "barbell", "body only", "e-z curl bar", "foam roll", "machine", "other"]);
  });

  it("sorts by label, not stored value", () => {
    // "body only" is Bodyweight and "e-z curl bar" is EZ Bar.
    expect(sortEquipment(["e-z curl bar", "dumbbell", "body only", "exercise ball"])).toEqual([
      "body only",
      "dumbbell",
      "exercise ball",
      "e-z curl bar",
    ]);
  });

  it("leaves the input alone", () => {
    const input = ["machine", "bands"];
    sortEquipment(input);
    expect(input).toEqual(["machine", "bands"]);
  });
});

describe("matchesEquipment", () => {
  it("passes everything with nothing selected", () => {
    expect(matchesEquipment("barbell", [])).toBe(true);
    expect(matchesEquipment(null, [])).toBe(true);
  });

  it("passes any selected value", () => {
    expect(matchesEquipment("bands", ["barbell", "bands"])).toBe(true);
    expect(matchesEquipment("cable", ["barbell", "bands"])).toBe(false);
  });

  it("drops exercises with no equipment once a filter is on", () => {
    expect(matchesEquipment(null, ["other"])).toBe(false);
  });
});

describe("equipmentChipLabel", () => {
  it("is null with nothing selected", () => {
    expect(equipmentChipLabel([])).toBeNull();
  });

  it("shows one label", () => {
    expect(equipmentChipLabel(["e-z curl bar"])).toBe("EZ Bar");
  });

  it("shows the first in list order plus a count", () => {
    expect(equipmentChipLabel(["machine", "other", "bands"])).toBe("Bands +2");
  });
});
