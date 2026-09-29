import { describe, expect, it } from "vitest";

import { proseCount, proseNumber, proseOrdinal } from "./copy-numbers";

describe("proseNumber", () => {
  it("spells out zero through nine and uses digits from 10", () => {
    expect([0, 1, 5, 9].map(proseNumber)).toEqual(["zero", "one", "five", "nine"]);
    expect([10, 11, 250].map(proseNumber)).toEqual(["10", "11", "250"]);
  });

  it("leaves anything that is not a whole number alone", () => {
    expect(proseNumber(2.5)).toBe("2.5");
    expect(proseNumber(-3)).toBe("-3");
  });
});

describe("proseOrdinal", () => {
  it("spells out first through ninth", () => {
    expect([1, 2, 3, 4, 9].map(proseOrdinal)).toEqual(["first", "second", "third", "fourth", "ninth"]);
  });

  it("uses digits with the right suffix from 10", () => {
    expect([10, 11, 12, 13, 21, 22, 23, 101, 111, 112, 1000].map(proseOrdinal)).toEqual([
      "10th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "23rd",
      "101st",
      "111th",
      "112th",
      "1000th",
    ]);
  });
});

describe("proseCount", () => {
  it("counts with the noun", () => {
    expect(proseCount(1, "workout")).toBe("one workout");
    expect(proseCount(3, "workout")).toBe("three workouts");
    expect(proseCount(12, "workout")).toBe("12 workouts");
    expect(proseCount(2, "week")).toBe("two weeks");
  });

  it("takes an irregular plural", () => {
    expect(proseCount(2, "person", "people")).toBe("two people");
  });
});
