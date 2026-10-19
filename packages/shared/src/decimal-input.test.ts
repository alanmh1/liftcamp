import { describe, expect, it } from "vitest";

import { cleanDecimal, parseDecimal } from "./decimal-input";

describe("cleanDecimal", () => {
  it("keeps digits and one separator", () => {
    expect(cleanDecimal("68.25", 2)).toBe("68.25");
    expect(cleanDecimal("68.", 2)).toBe("68.");
    expect(cleanDecimal("120", 2)).toBe("120");
    expect(cleanDecimal("", 2)).toBe("");
  });

  it("keeps a comma as typed", () => {
    expect(cleanDecimal("68,", 2)).toBe("68,");
    expect(cleanDecimal("68,2", 2)).toBe("68,2");
  });

  it("drops a second separator, whichever kind", () => {
    expect(cleanDecimal("68.2.5", 2)).toBe("68.25");
    expect(cleanDecimal("68,2.", 2)).toBe("68,2");
    expect(cleanDecimal("68..", 2)).toBe("68.");
  });

  it("caps decimals", () => {
    expect(cleanDecimal("68.255", 2)).toBe("68.25");
    expect(cleanDecimal("72.45", 1)).toBe("72.4");
    expect(cleanDecimal("72,45", 1)).toBe("72,4");
  });

  it("keeps a leading separator", () => {
    expect(cleanDecimal(".5", 2)).toBe(".5");
    expect(cleanDecimal(",5", 1)).toBe(",5");
    expect(cleanDecimal(".", 2)).toBe(".");
  });

  it("drops everything else", () => {
    expect(cleanDecimal("6a8 kg", 2)).toBe("68");
    expect(cleanDecimal("-10", 2)).toBe("10");
  });

  it("allows no separator at zero decimals", () => {
    expect(cleanDecimal("68.5", 0)).toBe("685");
  });
});

describe("parseDecimal", () => {
  it("is null for nothing or a lone separator", () => {
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal(".")).toBeNull();
    expect(parseDecimal(",")).toBeNull();
  });

  it("reads a trailing separator as the whole number", () => {
    expect(parseDecimal("68.")).toBe(68);
    expect(parseDecimal("68,")).toBe(68);
  });

  it("reads a leading separator", () => {
    expect(parseDecimal(".5")).toBe(0.5);
    expect(parseDecimal(",5")).toBe(0.5);
  });

  it("reads a comma as the decimal point", () => {
    expect(parseDecimal("68,25")).toBe(68.25);
    expect(parseDecimal("68,2")).toBe(68.2);
  });

  it("reads plain numbers", () => {
    expect(parseDecimal("120")).toBe(120);
    expect(parseDecimal("1.25")).toBe(1.25);
  });

  it("matches what cleanDecimal leaves", () => {
    for (const typed of ["68,2", "68.", ".5", "100,25"]) {
      expect(parseDecimal(cleanDecimal(typed, 2))).toBe(Number(typed.replace(",", ".")));
    }
  });
});
