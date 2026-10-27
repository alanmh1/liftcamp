import { describe, expect, it } from "vitest";
import { howToStepName } from "./exercise-meta";

describe("howToStepName", () => {
  it("takes the clause before the first comma or period", () => {
    expect(howToStepName("Lie back on a flat bench, feet flat on the floor.", 1)).toBe(
      "Lie back on a flat bench",
    );
    expect(howToStepName("Unrack the bar. Hold it over your chest.", 2)).toBe("Unrack the bar");
  });

  it("caps at 60 characters on a word boundary", () => {
    const name = howToStepName(
      "Keeping your back straight and your core braced throughout the whole movement lower the weight",
      3,
    );
    expect(name.length).toBeLessThanOrEqual(60);
    expect(name).toBe("Keeping your back straight and your core braced throughout");
  });

  it("falls back to Step N for an empty step", () => {
    expect(howToStepName("  ", 4)).toBe("Step 4");
  });
});
