import { describe, expect, it } from "vitest";
import { exerciseTitle, howToStepName } from "./exercise-meta";

describe("howToStepName", () => {
  it("takes the clause before the first comma or period", () => {
    expect(howToStepName("Lie back on a flat bench, feet flat on the floor.", 1)).toBe(
      "Lie back on a flat bench",
    );
    expect(howToStepName("Unrack the bar. Hold it over your chest.", 2)).toBe("Unrack the bar");
  });

  it("skips a leading From the starting position clause", () => {
    expect(
      howToStepName("From the starting position, breathe in and lower the bar to your chest.", 2),
    ).toBe("Breathe in and lower the bar to your chest");
    expect(howToStepName("From the starting position.", 3)).toBe("From the starting position");
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

describe("exerciseTitle", () => {
  it("leads with the how-to question on pages with beginner notes", () => {
    expect(exerciseTitle("Leg Press", true)).toBe("How to Do Leg Press Correctly: Muscles Worked");
    expect(exerciseTitle("Pushups", true)).toBe("How to Do Pushups Correctly: Muscles Worked");
  });

  it("drops pieces until the title fits in 60 characters", () => {
    expect(exerciseTitle("Incline Dumbbell Bench With Palms Facing In", true)).toBe(
      "How to Do Incline Dumbbell Bench With Palms Facing In",
    );
    expect(exerciseTitle("Cable Rope Overhead Triceps Extension", true)).toBe(
      "How to Do Cable Rope Overhead Triceps Extension Correctly",
    );
  });

  it("keeps the old template for names that don't read as a phrase", () => {
    expect(exerciseTitle("Walking, Treadmill", true)).toBe(
      "Walking, Treadmill: How to and Muscles Worked",
    );
    expect(exerciseTitle("Triceps Pushdown - Rope Attachment", true)).toBe(
      "Triceps Pushdown - Rope Attachment: Muscles Worked",
    );
  });

  it("keeps the old template on pages without notes", () => {
    expect(exerciseTitle("Leg Press", false)).toBe("Leg Press: How to and Muscles Worked");
  });
});
