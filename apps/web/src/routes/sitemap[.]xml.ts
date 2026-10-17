import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getSitemapExercises, getSitemapRoutines } from "@/lib/public-catalog.functions";
import { CANONICAL_SLUG_OVERRIDES, REGIONS } from "@/lib/muscle-regions";
import { EQUIPMENT_PAGE_SLUGS } from "@/lib/equipment-pages";
import { guideMetas } from "@/content/guides";

const BASE_URL = "https://liftcamp.app";

interface SitemapEntry {
  path: string;
  /** ISO 8601 date (YYYY-MM-DD). Only emitted when an authoritative,
   *  page-specific content timestamp exists. */
  lastmod?: string;
}

// Only indexable URLs belong here. /login and /admin are excluded (/admin is
// also disallowed in robots.txt), and exercise detail pages
// appear only when they have an authored beginner block -- the same condition
// the detail route uses to decide noindex. Listing a noindexed URL is a
// coverage error in Search Console, so the two rules must not drift.
// /routines is unconditional: every built-in routine is authored, so the page
// always has content.
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const [exercises, routineSlugs] = await Promise.all([
          getSitemapExercises(),
          getSitemapRoutines(),
        ]);

        const entries: SitemapEntry[] = [
          { path: "/" },
          { path: "/exercises" },
          { path: "/routines" },
          { path: "/routines/build" },
          ...routineSlugs.map((slug) => ({ path: `/routines/${slug}` })),
          ...REGIONS.map((r) => ({ path: `/exercises/${r}` })),
          ...EQUIPMENT_PAGE_SLUGS.map((s) => ({ path: `/exercises/${s}` })),
          ...exercises
            // A row whose canonical points at another slug would duplicate an
            // entry; the target is already listed under its own slug.
            .filter((e) => !CANONICAL_SLUG_OVERRIDES[e.slug])
            .map((e) => ({ path: `/exercises/${e.slug}`, lastmod: e.lastmod })),
          { path: "/guides" },
          // Guides carry no has_notes-style condition: one is authored by
          // definition. Drafts are filtered inside guideMetas().
          ...guideMetas().map((g) => ({
            path: `/guides/${g.slug}`,
            lastmod: g.updated,
          })),
          { path: "/about" },
          { path: "/mcp" },
          { path: "/privacy" },
          { path: "/terms" },
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
