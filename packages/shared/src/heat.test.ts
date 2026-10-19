import { describe, expect, it } from "vitest";

import { HEAT_STOPS, heatColor, heatInk } from "./heat";

function channels(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Every channel within one step, for the colors the spec gives as "about". */
function near(actual: string, expected: string) {
  const a = channels(actual);
  channels(expected).forEach((v, i) => expect(Math.abs(a[i] - v)).toBeLessThanOrEqual(1));
}

describe("heatColor", () => {
  it("returns each stop exactly", () => {
    expect(heatColor(0)).toBe("#4FAEE8");
    expect(heatColor(0.3)).toBe("#8DD3E0");
    expect(heatColor(0.6)).toBe("#FFD166");
    expect(heatColor(1)).toBe("#F2602B");
    for (const s of HEAT_STOPS) expect(heatColor(s.t)).toBe(s.color);
  });

  it("interpolates a third and two thirds", () => {
    near(heatColor(1 / 3), "#9AD3D3");
    near(heatColor(2 / 3), "#FDBE5C");
  });

  it("clamps outside 0 to 1", () => {
    expect(heatColor(-0.5)).toBe("#4FAEE8");
    expect(heatColor(4 / 3)).toBe("#F2602B");
    expect(heatColor(Number.NaN)).toBe("#4FAEE8");
  });

  it("gives #RRGGBB, upper case", () => {
    for (let i = 0; i <= 20; i += 1) expect(heatColor(i / 20)).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe("heatInk", () => {
  it("is graphite on the light colors and white on the dark ones", () => {
    expect(heatInk("#FFD166")).toBe("#221F1B");
    expect(heatInk("#8DD3E0")).toBe("#221F1B");
    expect(heatInk("#FDBE5C")).toBe("#221F1B");
    expect(heatInk("#F2602B")).toBe("#FFFFFF");
    expect(heatInk("#4FAEE8")).toBe("#FFFFFF");
  });

  it("switches at a luminance of 0.45", () => {
    expect(heatInk("#FFFFFF")).toBe("#221F1B");
    expect(heatInk("#000000")).toBe("#FFFFFF");
    // #B4B4B4 is about 0.456, #B2B2B2 about 0.445.
    expect(heatInk("#B4B4B4")).toBe("#221F1B");
    expect(heatInk("#B2B2B2")).toBe("#FFFFFF");
  });
});
