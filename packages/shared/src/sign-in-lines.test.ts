import { describe, expect, it } from "vitest";

import { parseSignInLine, pickSignInLine, SIGN_IN_LINES } from "./sign-in-lines";

const n = SIGN_IN_LINES.length;

describe("pickSignInLine", () => {
  it("never picks the line shown last time", () => {
    for (let last = 0; last < n; last++) {
      for (let k = 0; k <= 100; k++) {
        const r = k / 100; // 0 through 1, both ends included
        const next = pickSignInLine(last, () => r);
        expect(next, `last ${last}, random ${r}`).not.toBe(last);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThan(n);
      }
    }
  });

  it("can reach every other line", () => {
    for (let last = 0; last < n; last++) {
      const seen = new Set<number>();
      for (let k = 0; k < 1000; k++) seen.add(pickSignInLine(last, () => k / 1000));
      expect(seen.size).toBe(n - 1);
    }
  });

  it("can pick any line when there is no last one", () => {
    const seen = new Set<number>();
    for (let k = 0; k < 1000; k++) seen.add(pickSignInLine(null, () => k / 1000));
    expect(seen.size).toBe(n);
  });

  it("ignores a stored value that is not an index", () => {
    for (const bad of [-1, n, 2.5, Number.NaN]) {
      const next = pickSignInLine(bad, () => 0.5);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(n);
    }
  });
});

describe("parseSignInLine", () => {
  it("reads back an index, and null for anything else", () => {
    expect(parseSignInLine("3")).toBe(3);
    expect(parseSignInLine(null)).toBeNull();
    expect(parseSignInLine("x")).toBeNull();
    expect(parseSignInLine("1.5")).toBeNull();
  });
});
