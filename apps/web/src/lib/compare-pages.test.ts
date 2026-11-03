import { describe, expect, it } from "vitest";
import {
  COMPARE_CHECKED,
  COMPARE_PAGES,
  COMPARE_SOURCES,
  comparePageFor,
  liftCampColumn,
  pageSources,
} from "./compare-pages";

describe("compare pages", () => {
  it("are the four slugs, each at /compare/<slug>", () => {
    expect(COMPARE_PAGES.map((p) => p.slug)).toEqual([
      "hevy",
      "strong",
      "fitbod",
      "hevy-vs-strong",
    ]);
    for (const p of COMPARE_PAGES) expect(p.path).toBe(`/compare/${p.slug}`);
  });

  it("404s any other slug", () => {
    expect(comparePageFor("compare")).toBeUndefined();
    expect(comparePageFor("myfitnesspal")).toBeUndefined();
  });

  it("names a source that exists for every key", () => {
    for (const p of COMPARE_PAGES) {
      for (const k of p.sources) expect(COMPARE_SOURCES[k], `${p.slug}: ${k}`).toBeDefined();
      expect(pageSources(p)).toHaveLength(p.sources.length);
    }
  });

  it("has rows as wide as the columns", () => {
    for (const p of COMPARE_PAGES) {
      for (const row of p.table.rows) expect(row).toHaveLength(p.table.columns.length);
    }
  });

  it("highlights LiftCamp where it appears", () => {
    expect(COMPARE_PAGES.map(liftCampColumn)).toEqual([1, 1, 1, undefined]);
  });

  it("dates the prices", () => {
    expect(COMPARE_CHECKED).toBe("2 November 2026");
  });
});
