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
  it("are the six slugs, each at /compare/<slug>", () => {
    expect(COMPARE_PAGES.map((p) => p.slug)).toEqual([
      "hevy",
      "strong",
      "fitbod",
      "hevy-vs-strong",
      "hevy-vs-fitbod",
      "best-workout-app-for-beginners",
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
    expect(COMPARE_PAGES.map(liftCampColumn)).toEqual([1, 1, 1, undefined, undefined, undefined]);
  });

  it("keeps titles under 60 characters and descriptions under 155", () => {
    for (const p of COMPARE_PAGES) {
      expect(p.title.length, p.slug).toBeLessThanOrEqual(60);
      expect(p.description.length, p.slug).toBeLessThanOrEqual(155);
    }
  });

  it("states LiftCamp Pro's price wherever LiftCamp has a column", () => {
    for (const p of COMPARE_PAGES) {
      const col = liftCampColumn(p);
      if (col === undefined) continue;
      const price = p.table.rows.find((r) => r[0] === "Price");
      expect(price?.[col], p.slug).toContain("$9.99 a year");
    }
  });

  it("links internally only to pages that exist", () => {
    const slugs = new Set(COMPARE_PAGES.map((p) => p.path));
    for (const p of COMPARE_PAGES) {
      for (const l of p.links ?? []) {
        if (l.href.startsWith("/compare/"))
          expect(slugs.has(l.href), `${p.slug} -> ${l.href}`).toBe(true);
      }
    }
  });

  it("dates the prices", () => {
    expect(COMPARE_CHECKED).toBe("16 November 2026");
  });
});
