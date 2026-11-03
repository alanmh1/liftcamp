import { describe, expect, it } from "vitest";
import { DEFAULT_PLATES, platesForWeight } from "@liftcamp/shared";
import { PLATE_CALCULATOR, parseTotal, tableUnitAndBar } from "./plate-calculator";

const tables = PLATE_CALCULATOR.sections.flatMap((s) => s.tables ?? []);

describe("plate calculator common loads", () => {
  it("has the lb and kg tables", () => {
    expect(tables.map((t) => tableUnitAndBar(t.caption))).toEqual([
      { unit: "lb", bar: 45 },
      { unit: "kg", bar: 20 },
    ]);
  });

  for (const table of tables) {
    const { unit, bar } = tableUnitAndBar(table.caption)!;
    for (const [total, plates] of table.rows) {
      it(`${table.caption}: ${total} is ${plates} per side`, () => {
        const load = platesForWeight(parseTotal(total), bar, DEFAULT_PLATES[unit]);
        expect(load.exact).toBe(true);
        expect(load.perSide.join(", ")).toBe(plates);
        expect(total.endsWith(` ${unit}`)).toBe(true);
      });
    }
  }

  it("defaults to a target each unit's default plates make exactly", () => {
    for (const unit of ["lb", "kg"] as const) {
      const bar = unit === "lb" ? 45 : 20;
      expect(
        platesForWeight(PLATE_CALCULATOR.defaultTarget[unit], bar, DEFAULT_PLATES[unit]).exact,
      ).toBe(true);
    }
  });
});
