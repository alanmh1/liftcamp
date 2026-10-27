import { describe, expect, it } from "vitest";
import { sitemapEntries, sitemapXml } from "./sitemap";
import type { SeoCatalog, SeoExercise } from "./public-catalog.functions";

function exercise(slug: string, over: Partial<SeoExercise> = {}): SeoExercise {
  return {
    slug,
    name: slug,
    equipment: "barbell",
    primary_muscle: "chest",
    all_primary_muscles: "chest",
    lastmod: "2026-06-01",
    starting_weight_md: null,
    ...over,
  };
}

const catalog: SeoCatalog = {
  exercises: [
    exercise("barbell-bench-press", {
      lastmod: "2026-10-19",
      starting_weight_md: "The empty bar.",
    }),
    exercise("barbell-squat", {
      primary_muscle: "quads",
      all_primary_muscles: "quads|glutes",
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

  it("lists only indexable exercise pages", () => {
    expect(byPath.has("/exercises/barbell-bench-press")).toBe(true);
    expect(byPath.has("/exercises/barbell-full-squat")).toBe(false);
    expect(byPath.has("/exercises/cable-crunch")).toBe(false);
  });

  it("dates hubs and indexes from their children", () => {
    expect(byPath.get("/exercises/chest")).toBe("2026-10-19");
    expect(byPath.get("/exercises/legs")).toBe("2026-09-02");
    expect(byPath.get("/exercises/cable")).toBe("2026-06-01");
    expect(byPath.get("/exercises")).toBe("2026-10-19");
    expect(byPath.get("/routines")).toBe("2026-10-16");
    expect(byPath.get("/routines/build")).toBe("2026-10-16");
    expect(byPath.get("/guides")).toBe("2026-10-20");
    expect(byPath.get("/")).toBe("2026-10-20");
  });
});
