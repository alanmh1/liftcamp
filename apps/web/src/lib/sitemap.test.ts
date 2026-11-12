import { describe, expect, it } from "vitest";
import { sitemapEntries, sitemapXml } from "./sitemap";
import { ALTERNATIVES_PAGES } from "./exercise-alternatives";
import {
  ALTERNATIVES_LAST_MODIFIED,
  COMPARE_LAST_MODIFIED,
  PLATE_CALCULATOR_LAST_MODIFIED,
  ROUTINE_GUIDES_LAST_MODIFIED,
  STRENGTH_LAST_MODIFIED,
} from "./page-dates";
import type { SeoCatalog, SeoExercise } from "./public-catalog.functions";

function exercise(slug: string, over: Partial<SeoExercise> = {}): SeoExercise {
  return {
    slug,
    name: slug,
    equipment: "barbell",
    primary_muscle: "chest",
    all_primary_muscles: "chest",
    updated: "2026-06-01",
    lastmod: "2026-06-01",
    starting_weight_md: null,
    ...over,
  };
}

const catalog: SeoCatalog = {
  exercises: [
    // Notes edited after the exercise row: the page takes the notes' date,
    // the hubs take the row's.
    exercise("barbell-bench-press", {
      updated: "2026-10-02",
      lastmod: "2026-10-19",
      starting_weight_md: "The empty bar.",
    }),
    exercise("barbell-squat", {
      primary_muscle: "quads",
      all_primary_muscles: "quads|glutes",
      updated: "2026-09-02",
      lastmod: "2026-09-02",
      starting_weight_md: "Start with the empty bar.",
    }),
    // Canonical points elsewhere: never listed, even with notes.
    exercise("barbell-full-squat", {
      primary_muscle: "quads",
      all_primary_muscles: "quads",
      starting_weight_md: "Start with the empty bar.",
    }),
    exercise("cable-crunch", {
      equipment: "cable",
      primary_muscle: "abs",
      all_primary_muscles: "abs",
    }),
  ],
  routines: [
    {
      slug: "full-body-3-day",
      program: "Full Body",
      blurb: null,
      level: "beginner",
      equipment: "gym",
      lastmod: "2026-10-16",
    },
    {
      slug: "phul",
      program: "PHUL",
      blurb: null,
      level: "intermediate",
      equipment: "gym",
      lastmod: "2026-07-01",
    },
  ],
};

const guides = [
  { slug: "progressive-overload", updated: "2026-10-20" },
  { slug: "leg-press-setup", updated: "2026-09-01" },
];

describe("sitemapEntries", () => {
  const entries = sitemapEntries(catalog, guides);
  const byPath = new Map(entries.map((e) => [e.path, e.lastmod]));

  it("gives every URL a YYYY-MM-DD lastmod", () => {
    expect(entries.length).toBeGreaterThan(20);
    for (const e of entries) expect(e.lastmod, e.path).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("emits a lastmod element for every url element", () => {
    const xml = sitemapXml(entries);
    expect(xml.match(/<url>/g)?.length).toBe(entries.length);
    expect(xml.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g)?.length).toBe(entries.length);
  });

  it("leaves out /login and /routines/build", () => {
    const paths = entries.map((e) => e.path);
    expect(paths.some((p) => p.startsWith("/login"))).toBe(false);
    expect(paths.some((p) => p.startsWith("/routines/build"))).toBe(false);
  });

  it("lists only indexable exercise pages", () => {
    expect(byPath.has("/exercises/barbell-bench-press")).toBe(true);
    expect(byPath.has("/exercises/barbell-full-squat")).toBe(false);
    expect(byPath.has("/exercises/cable-crunch")).toBe(false);
  });

  it("dates exercise pages from the row or its notes, whichever is later", () => {
    expect(byPath.get("/exercises/barbell-bench-press")).toBe("2026-10-19");
  });

  it("dates hubs and indexes from their children", () => {
    expect(byPath.get("/exercises/chest")).toBe("2026-10-02");
    expect(byPath.get("/exercises/legs")).toBe("2026-09-02");
    expect(byPath.get("/exercises/cable")).toBe("2026-06-01");
    expect(byPath.get("/exercises")).toBe("2026-10-19");
    expect(byPath.get("/routines")).toBe("2026-10-16");
    expect(byPath.get("/exercises/all")).toBe("2026-10-19");
    expect(byPath.get("/guides")).toBe("2026-10-20");
    expect(byPath.get("/")).toBe("2026-10-20");
  });

  it("lists the 14 sub-muscle pages, dated from the exercises on each", () => {
    const sub = entries.filter((e) =>
      /^\/exercises\/(lats|upper-back|lower-back|traps|biceps|triceps|forearms|quads|hamstrings|glutes|calves|adductors|abductors|abs)$/.test(
        e.path,
      ),
    );
    expect(sub).toHaveLength(14);
    // barbell-squat is quads|glutes, updated 2026-09-02.
    expect(byPath.get("/exercises/quads")).toBe("2026-09-02");
    expect(byPath.get("/exercises/glutes")).toBe("2026-09-02");
    expect(byPath.get("/exercises/abs")).toBe("2026-06-01");
    // No exercise on the page: the latest exercise date, never today.
    expect(byPath.get("/exercises/lats")).toBe("2026-10-02");
  });

  it("lists every alternatives page, dated from the copy or their rows", () => {
    const alt = entries.filter((e) => e.path.endsWith("/alternatives"));
    expect(alt).toHaveLength(19);
    expect(alt.map((e) => e.path)).toEqual(
      ALTERNATIVES_PAGES.map((p) => `/exercises/${p.base}/alternatives`),
    );
    for (const e of alt) expect(e.lastmod >= ALTERNATIVES_LAST_MODIFIED, e.path).toBe(true);
  });

  it("dates an alternatives page from a row edited after the copy", () => {
    const later = sitemapEntries(
      {
        ...catalog,
        exercises: [...catalog.exercises, exercise("wall-sit", { updated: "2027-01-05" })],
      },
      guides,
    );
    const at = new Map(later.map((e) => [e.path, e.lastmod]));
    expect(at.get("/exercises/leg-press/alternatives")).toBe("2027-01-05");
    expect(at.get("/exercises/leg-extensions/alternatives")).toBe("2027-01-05");
    expect(at.get("/exercises/barbell-bench-press/alternatives")).toBe(ALTERNATIVES_LAST_MODIFIED);
  });

  it("lists the strength standards hub and its 7 lift pages on one date", () => {
    const strength = entries.filter((e) => e.path.startsWith("/strength-standards"));
    expect(strength.map((e) => e.path)).toEqual([
      "/strength-standards",
      "/strength-standards/bench-press",
      "/strength-standards/squat",
      "/strength-standards/deadlift",
      "/strength-standards/overhead-press",
      "/strength-standards/barbell-row",
      "/strength-standards/romanian-deadlift",
      "/strength-standards/lat-pulldown",
    ]);
    for (const e of strength) expect(e.lastmod).toBe(STRENGTH_LAST_MODIFIED);
  });

  it("lists the plate calculator on its hand-set date", () => {
    const at = new Map(entries.map((e) => [e.path, e.lastmod]));
    expect(at.get("/plate-calculator")).toBe(PLATE_CALCULATOR_LAST_MODIFIED);
  });

  it("lists the four compare pages and no /compare index", () => {
    const compare = entries.filter((e) => e.path.startsWith("/compare"));
    expect(compare.map((e) => e.path)).toEqual([
      "/compare/hevy",
      "/compare/strong",
      "/compare/fitbod",
      "/compare/hevy-vs-strong",
    ]);
    for (const e of compare) expect(e.lastmod).toBe(COMPARE_LAST_MODIFIED);
  });

  it("dates the guide-length routine pages from their copy or their rows, whichever is later", () => {
    const routine = (slug: string, lastmod: string) => ({
      slug,
      program: slug,
      blurb: null,
      level: "intermediate",
      equipment: "gym",
      lastmod,
    });
    const at = new Map(
      sitemapEntries(
        {
          exercises: catalog.exercises,
          routines: [
            routine("push-pull-legs", "2026-10-01"),
            routine("arnold-split", "2027-01-05"),
            routine("phul", "2026-07-01"),
          ],
        },
        guides,
      ).map((e) => [e.path, e.lastmod]),
    );
    expect(at.get("/routines/push-pull-legs")).toBe(ROUTINE_GUIDES_LAST_MODIFIED);
    expect(at.get("/routines/arnold-split")).toBe("2027-01-05");
    expect(at.get("/routines/phul")).toBe("2026-07-01");
  });
});
