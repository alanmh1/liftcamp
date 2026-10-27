import { describe, expect, it } from "vitest";
import { equipmentGroups, muscleRows } from "./catalog-grouping";
import type { CatalogRow } from "./public-catalog.functions";

function row(slug: string, over: Partial<CatalogRow> = {}): CatalogRow {
  return {
    slug,
    name: slug,
    equipment: "barbell",
    level: "beginner",
    primary_muscle: "lats",
    all_primary_muscles: "lats",
    secondary_muscles: null,
    has_notes: false,
    alias_text: null,
    image_url: null,
    ...over,
  };
}

describe("muscleRows", () => {
  it("takes every row with the muscle among its primaries, explained first", () => {
    const rows = [
      row("a-row"),
      row("b-row", { has_notes: true }),
      row("c-row", { all_primary_muscles: "upper back|lats" }),
      row("d-row", { all_primary_muscles: "upper back" }),
    ];
    expect(muscleRows(rows, "lats").map((r) => r.slug)).toEqual(["b-row", "a-row", "c-row"]);
  });
});

describe("equipmentGroups", () => {
  it("orders groups, drops empty ones and buckets the rest as Other", () => {
    const groups = equipmentGroups([
      row("cable-1", { equipment: "cable" }),
      row("ez-1", { equipment: "e-z curl bar" }),
      row("bar-1", { equipment: "barbell" }),
      row("ball-1", { equipment: "exercise ball" }),
      row("none-1", { equipment: null }),
      row("bw-1", { equipment: "body only" }),
    ]);
    expect(groups.map((g) => [g.label, g.rows.map((r) => r.slug)])).toEqual([
      ["Barbell", ["ez-1", "bar-1"]],
      ["Cable", ["cable-1"]],
      ["Bodyweight", ["bw-1"]],
      ["Other", ["ball-1", "none-1"]],
    ]);
  });
});
