import { describe, expect, it } from "vitest";
import { exercisesForGuide, guidesForExercise } from "./guide-exercises";
import { guideMetas } from "@/content/guides";

const order = guideMetas().map((m) => m.slug);

const row = (slug: string, equipment: string | null, has_notes = false) => ({
  slug,
  name: slug.replace(/-/g, " "),
  equipment,
  has_notes,
});

describe("guide-exercises", () => {
  it("only names guides that exist and are published", () => {
    const published = new Set(order);
    for (const g of guidesForExercise(
      { slug: "leg-press", equipment: "machine", indexed: true },
      order,
    )) {
      expect(published.has(g)).toBe(true);
    }
  });

  it("maps an exercise to its guides in display order", () => {
    expect(
      guidesForExercise({ slug: "leg-press", equipment: "machine", indexed: true }, order),
    ).toEqual(
      order.filter((g) =>
        [
          "picking-your-starting-weight",
          "what-to-do-when-the-machine-is-taken",
          "leg-press-setup",
        ].includes(g),
      ),
    );
  });

  it("shows the starting weight guide on indexed pages only", () => {
    expect(
      guidesForExercise({ slug: "cable-crunch", equipment: "cable", indexed: false }, order),
    ).toEqual([]);
    expect(
      guidesForExercise({ slug: "cable-crunch", equipment: "cable", indexed: true }, order),
    ).toEqual(["picking-your-starting-weight"]);
  });

  it("links every smith machine exercise to the bar weight guide", () => {
    expect(
      guidesForExercise(
        { slug: "smith-machine-shrug", equipment: "smith machine", indexed: false },
        order,
      ),
    ).toEqual(["smith-machine-bar-weight"]);
  });

  it("lists a guide's exercises in map order, skipping missing rows", () => {
    const rows = [row("goblet-squat", "dumbbell"), row("barbell-squat", "barbell")];
    expect(exercisesForGuide("squat-without-a-rack", rows).map((r) => r.slug)).toEqual([
      "barbell-squat",
      "goblet-squat",
    ]);
  });

  it("lists an equipment rule authored first, then by name", () => {
    const rows = [
      row("smith-machine-squat", "smith machine"),
      row("smith-machine-bench-press", "smith machine", true),
      row("smith-machine-calf-raise", "smith machine"),
      row("close-grip-smith-machine-bench-press", "smith machine"),
      row("leg-press", "machine", true),
    ];
    expect(exercisesForGuide("smith-machine-bar-weight", rows).map((r) => r.slug)).toEqual([
      "smith-machine-bench-press",
      "smith-machine-calf-raise",
      "smith-machine-squat",
    ]);
  });

  it("lists nothing for the indexed rule", () => {
    expect(
      exercisesForGuide("picking-your-starting-weight", [row("leg-press", "machine", true)]),
    ).toEqual([]);
  });
});
