// The sitemap's URL list, as a pure function of the SEO feed, so the rule that
// every URL carries a real lastmod is testable without a database.
//
// lastmod is always a date from data or a hand-set constant, never the
// current time:
//   exercise page     max(exercises.updated_at, beginner_notes.updated_at)
//   routine page      max(templates.updated_at, template_exercises.updated_at)
//   muscle hub        max(exercises.updated_at) on the page
//   sub-muscle page   max(exercises.updated_at) on the page
//   equipment hub     max(exercises.updated_at) on the page
//   /exercises        latest of its hubs and exercise pages
//   /exercises/all    latest indexable exercise page
//   /routines         latest routine
//
// /routines/build is left out: robots.txt disallows it, and a sitemap URL
// that robots.txt blocks is a Search Console error.
//   guide             GuideMeta.updated
//   /guides           latest guide
//   /                 latest of /exercises, /routines, /guides
//   /about, /mcp, /privacy, /terms   constants in page-dates.ts
//   /strength-standards and its 7 lift pages   STRENGTH_LAST_MODIFIED

import type { SeoCatalog, SeoExercise } from "./public-catalog.functions";
import { CANONICAL_SLUG_OVERRIDES, REGIONS, REGION_MUSCLES } from "./muscle-regions";
import { EQUIPMENT_PAGES } from "./equipment-pages";
import { submusclePages } from "./submuscle-pages";
import { rowMuscles } from "./catalog-grouping";
import { strengthPages } from "./strength-pages";
import {
  ABOUT_LAST_MODIFIED,
  MCP_LAST_MODIFIED,
  PRIVACY_LAST_MODIFIED,
  STRENGTH_LAST_MODIFIED,
  TERMS_LAST_MODIFIED,
} from "./page-dates";

export type SitemapEntry = { path: string; lastmod: string };

/** Latest of YYYY-MM-DD strings, which sort as text. An empty list (a hub
 *  with no exercises) takes `fallback`, so the result is still a real date. */
function latest(dates: string[], fallback?: string): string {
  return [...dates].sort().at(-1) ?? fallback!;
}

/** Exercise pages that are indexable: an authored beginner block, and a
 *  canonical pointing at themselves. The same rule the detail route uses for
 *  noindex, so the sitemap never lists a noindexed URL. */
export function indexedExercises(exercises: SeoExercise[]): SeoExercise[] {
  return exercises.filter(
    (e) => e.starting_weight_md !== null && !CANONICAL_SLUG_OVERRIDES[e.slug],
  );
}

export function sitemapEntries(
  catalog: SeoCatalog,
  guides: { slug: string; updated: string }[],
): SitemapEntry[] {
  const { exercises, routines } = catalog;
  // Hubs list exercise rows, not beginner notes, so they date from
  // exercises.updated_at alone.
  const anyExercise = latest(exercises.map((e) => e.updated));

  const regionHubs = REGIONS.map((region) => ({
    path: `/exercises/${region}`,
    lastmod: latest(
      exercises
        .filter((e) => REGION_MUSCLES[region].some((m) => rowMuscles(e).includes(m)))
        .map((e) => e.updated),
      anyExercise,
    ),
  }));
  const submuscleHubs = submusclePages().map((page) => ({
    path: `/exercises/${page.slug}`,
    lastmod: latest(
      exercises.filter((e) => rowMuscles(e).includes(page.muscle)).map((e) => e.updated),
      anyExercise,
    ),
  }));
  const equipmentHubs = Object.values(EQUIPMENT_PAGES).map((page) => ({
    path: `/exercises/${page.slug}`,
    lastmod: latest(
      exercises.filter((e) => e.equipment?.toLowerCase() === page.value).map((e) => e.updated),
      anyExercise,
    ),
  }));
  const exercisePages = indexedExercises(exercises)
    .map((e) => ({ path: `/exercises/${e.slug}`, lastmod: e.lastmod }))
    .sort((a, b) => (a.path < b.path ? -1 : 1));
  const routinePages = routines.map((r) => ({ path: `/routines/${r.slug}`, lastmod: r.lastmod }));
  const guidePages = guides.map((g) => ({ path: `/guides/${g.slug}`, lastmod: g.updated }));

  const exercisesDate = latest(
    [...regionHubs, ...submuscleHubs, ...equipmentHubs, ...exercisePages].map((e) => e.lastmod),
  );
  const routinesDate = latest(routinePages.map((e) => e.lastmod));
  const guidesDate = latest(guidePages.map((e) => e.lastmod));

  return [
    { path: "/", lastmod: latest([exercisesDate, routinesDate, guidesDate]) },
    { path: "/exercises", lastmod: exercisesDate },
    {
      path: "/exercises/all",
      lastmod: latest(
        exercisePages.map((e) => e.lastmod),
        anyExercise,
      ),
    },
    { path: "/routines", lastmod: routinesDate },
    ...routinePages,
    ...regionHubs,
    ...submuscleHubs,
    ...equipmentHubs,
    ...exercisePages,
    { path: "/guides", lastmod: guidesDate },
    ...guidePages,
    { path: "/strength-standards", lastmod: STRENGTH_LAST_MODIFIED },
    ...strengthPages().map((p) => ({
      path: `/strength-standards/${p.slug}`,
      lastmod: STRENGTH_LAST_MODIFIED,
    })),
    { path: "/about", lastmod: ABOUT_LAST_MODIFIED },
    { path: "/mcp", lastmod: MCP_LAST_MODIFIED },
    { path: "/privacy", lastmod: PRIVACY_LAST_MODIFIED },
    { path: "/terms", lastmod: TERMS_LAST_MODIFIED },
  ];
}

export function sitemapXml(entries: SitemapEntry[], base = "https://liftcamp.app"): string {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...entries.map((e) =>
      [
        `  <url>`,
        `    <loc>${base}${e.path}</loc>`,
        `    <lastmod>${e.lastmod}</lastmod>`,
        `  </url>`,
      ].join("\n"),
    ),
    `</urlset>`,
  ].join("\n");
}
