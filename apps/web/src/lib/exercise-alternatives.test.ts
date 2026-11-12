import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALTERNATIVES_PAGES,
  alternativesPageFor,
  alternativesProblems,
  pageSlugs,
  swapSlugs,
} from "./exercise-alternatives";
import { getGuide } from "@/content/guides";
import { REGIONS } from "./muscle-regions";
import { EQUIPMENT_PAGES } from "./equipment-pages";
import { SUBMUSCLE_PAGES } from "./submuscle-pages";

const JSON_PATH = path.resolve(import.meta.dirname, "../../../../docs/exercise-alternatives.json");

describe("exercise alternatives content", () => {
  it("matches docs/exercise-alternatives.json exactly", () => {
    const doc = JSON.parse(readFileSync(JSON_PATH, "utf8")) as { pages: unknown };
    expect(JSON.stringify(ALTERNATIVES_PAGES)).toBe(JSON.stringify(doc.pages));
  });

  it("has the nineteen bases, each once", () => {
    expect(ALTERNATIVES_PAGES.map((p) => p.base)).toEqual([
      "leg-press",
      "barbell-hip-thrust",
      "barbell-deadlift",
      "wide-grip-lat-pulldown",
      "barbell-squat",
      "barbell-bench-press",
      "face-pull",
      "leg-extensions",
      "bulgarian-split-squat",
      "pullups",
      "seated-cable-rows",
      "lying-hamstring-curl",
      "romanian-deadlift",
      "bent-over-barbell-row",
      "hack-squat",
      "triceps-pushdown",
      "barbell-shoulder-press",
      "parallel-bar-dip",
      "dumbbell-flyes",
    ]);
  });

  it("compares only the page's own swaps, one cell per column", () => {
    for (const page of ALTERNATIVES_PAGES) {
      const swaps = new Set(swapSlugs(page));
      for (const row of page.compare.rows) {
        expect(swaps.has(row.slug), `${page.base}: ${row.slug}`).toBe(true);
        expect(row.cells.length, `${page.base}: ${row.slug}`).toBe(page.compare.columns.length);
      }
    }
  });

  it("has 3 keeps, 2 or 3 variations, 3+ picks and 4 FAQs on every page", () => {
    for (const page of ALTERNATIVES_PAGES) {
      expect(page.keeps.length, page.base).toBe(3);
      expect([2, 3], page.base).toContain(page.variations.length);
      expect(page.how_to_pick.length, page.base).toBeGreaterThanOrEqual(3);
      expect(page.faq.length, page.base).toBe(4);
    }
  });

  it("shares no more than 3 swaps between any two pages", () => {
    for (const [i, a] of ALTERNATIVES_PAGES.entries()) {
      const mine = new Set(swapSlugs(a));
      for (const b of ALTERNATIVES_PAGES.slice(i + 1)) {
        const shared = swapSlugs(b).filter((s) => mine.has(s));
        expect(shared.length, `${a.base} and ${b.base}: ${shared.join(", ")}`).toBeLessThanOrEqual(
          3,
        );
      }
    }
  });

  it("links only guides the registry has", () => {
    for (const page of ALTERNATIVES_PAGES)
      for (const slug of page.guides) expect(getGuide(slug), `${page.base}: ${slug}`).toBeDefined();
  });

  it("has no em or en dash anywhere in the copy", () => {
    const strings: string[] = [];
    const walk = (v: unknown): void => {
      if (typeof v === "string") strings.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(ALTERNATIVES_PAGES);
    for (const s of strings) expect(/[\u2013\u2014]/.test(s), s).toBe(false);
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
    expect(problems).toContain("leg-extensions: swap hack-squat is not in the catalog");
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
