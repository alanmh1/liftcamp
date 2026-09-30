import { describe, expect, it } from "vitest";

import {
  bodyHighlights,
  bodyHighlightsLabel,
  CIRCLE_MIN_DIAMETER,
  CIRCLE_PADDING,
  circleCrop,
  highlightsForView,
  MUSCLE_REGIONS,
} from "./body-layers";
import { CANONICAL_MUSCLES } from "./muscle-vocab";

describe("bodyHighlights", () => {
  it("lights traps and lats for upper back and for middle back", () => {
    expect(bodyHighlights("upper back", null).primary).toEqual(["back_traps", "back_lats"]);
    expect(bodyHighlights("middle back", null).primary).toEqual(["back_traps", "back_lats"]);
  });

  it("lights a region in both lists as primary only", () => {
    const h = bodyHighlights("lats", "upper back|biceps");
    expect(h.primary).toEqual(["back_lats"]);
    expect(h.secondary).toEqual(["back_traps", "front_biceps"]);
  });

  it("lights nothing for neck or an unknown token", () => {
    const h = bodyHighlights("neck", "tail");
    expect(h.primary).toEqual([]);
    expect(h.secondary).toEqual([]);
  });

  it("covers every canonical muscle", () => {
    for (const m of CANONICAL_MUSCLES) expect(MUSCLE_REGIONS[m]).toBeDefined();
  });
});

describe("highlightsForView", () => {
  it("splits shoulders into front delts and rear delts", () => {
    const h = bodyHighlights("shoulders", "triceps");
    expect(highlightsForView(h, "anterior").primary).toEqual(["front_delts"]);
    expect(highlightsForView(h, "posterior").primary).toEqual(["back_rear_delts"]);
    expect(highlightsForView(h, "anterior").secondaryMuscles).toEqual([]);
    expect(bodyHighlightsLabel(highlightsForView(h, "posterior"))).toBe(
      "Body diagram. Primary shoulders. Secondary triceps",
    );
  });
});

describe("circleCrop", () => {
  it("is null with nothing lit", () => {
    expect(circleCrop([])).toBeNull();
  });

  it("fits the union's diagonal plus padding, centred on it", () => {
    const crop = circleCrop([
      [400, 200, 600, 300],
      [450, 250, 700, 500],
    ]);
    expect(crop).toEqual({ cx: 550, cy: 350, diameter: Math.hypot(300, 300) + CIRCLE_PADDING * 2 });
  });

  it("caps the zoom for a small muscle", () => {
    expect(circleCrop([[500, 500, 540, 520]])?.diameter).toBe(CIRCLE_MIN_DIAMETER);
  });

  it("keeps the circle on the canvas", () => {
    const crop = circleCrop([[0, 980, 40, 1024]])!;
    expect(crop.cx).toBe(CIRCLE_MIN_DIAMETER / 2);
    expect(crop.cy).toBe(1024 - CIRCLE_MIN_DIAMETER / 2);
    expect(circleCrop([[0, 0, 1024, 1024]])!.diameter).toBe(1024);
  });
});
