import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALTERNATIVES_PAGES,
  alternativesPageFor,
  alternativesProblems,
  pageSlugs,
} from "./exercise-alternatives";
import { REGIONS } from "./muscle-regions";
import { EQUIPMENT_PAGES } from "./equipment-pages";
import { SUBMUSCLE_PAGES } from "./submuscle-pages";

const JSON_PATH = path.resolve(import.meta.dirname, "../../../../docs/exercise-alternatives.json");

describe("exercise alternatives content", () => {
  it("matches docs/exercise-alternatives.json exactly", () => {
    const doc = JSON.parse(readFileSync(JSON_PATH, "utf8")) as { pages: unknown };
    expect(JSON.stringify(ALTERNATIVES_PAGES)).toBe(JSON.stringify(doc.pages));
  });

  it("has the six bases, each once", () => {
    expect(ALTERNATIVES_PAGES.map((p) => p.base)).toEqual([
      "leg-press",
      "barbell-hip-thrust",
      "barbell-deadlift",
      "wide-grip-lat-pulldown",
      "barbell-squat",
      "barbell-bench-press",
    ]);
  });

  it("never lists a swap twice on one page, or the base as its own swap", () => {
    for (const page of ALTERNATIVES_PAGES) {
      const slugs = pageSlugs(page);
      expect(new Set(slugs).size, page.base).toBe(slugs.length);
    }
  });

  it("uses no base that the /exercises/<slug> hubs claim", () => {
    const hubs = new Set<string>([
      ...REGIONS,
      ...Object.keys(EQUIPMENT_PAGES),
      ...Object.keys(SUBMUSCLE_PAGES),
      "all",
    ]);
    for (const page of ALTERNATIVES_PAGES) expect(hubs.has(page.base), page.base).toBe(false);
  });

  it("finds a page only for the six bases", () => {
    expect(alternativesPageFor("leg-press")?.h1).toBe("Leg press alternatives");
    expect(alternativesPageFor("dumbbell-curl")).toBeUndefined();
    expect(alternativesPageFor("all")).toBeUndefined();
  });
});

describe("alternativesProblems", () => {
  const every = ALTERNATIVES_PAGES.flatMap(pageSlugs).map((slug) => ({
    slug,
    starting_weight_md: "Start light.",
  }));

  it("is empty when every slug exists with notes", () => {
    expect(alternativesProblems(every)).toEqual([]);
  });

  it("flags a missing swap and a swap without notes", () => {
    const rows = every
      .filter((e) => e.slug !== "hack-squat")
      .map((e) => (e.slug === "wall-sit" ? { ...e, starting_weight_md: null } : e));
    const problems = alternativesProblems(rows);
    expect(problems).toContain("leg-press: swap hack-squat is not in the catalog");
    expect(problems).toContain("leg-press: swap wall-sit has no beginner_notes");
    expect(problems).toContain("barbell-squat: swap hack-squat is not in the catalog");
  });

  it("flags a base without notes", () => {
    const rows = every.map((e) =>
      e.slug === "barbell-deadlift" ? { ...e, starting_weight_md: null } : e,
    );
    expect(alternativesProblems(rows)).toContain(
      "barbell-deadlift: base barbell-deadlift has no beginner_notes",
    );
  });
});
