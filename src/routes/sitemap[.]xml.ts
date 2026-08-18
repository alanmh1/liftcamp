import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getSitemapExercises } from "@/lib/public-catalog.functions";
import { CANONICAL_SLUG_OVERRIDES, REGIONS } from "@/lib/muscle-regions";
import { guideMetas } from "@/content/guides";

const BASE_URL = "https://liftcamp.app";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

// Only indexable URLs belong here. /login and /reset-password are excluded
// (the latter is already disallowed in robots.txt), and exercise detail pages
// appear only when they have an authored beginner block -- the same condition
// the detail route uses to decide noindex. Listing a noindexed URL is a
// coverage error in Search Console, so the two rules must not drift.
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const slugs = await getSitemapExerciseSlugs();

        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/exercises", changefreq: "weekly", priority: "0.9" },
          ...REGIONS.map((r) => ({
            path: `/exercises/${r}`,
            changefreq: "weekly" as const,
            priority: "0.8",
          })),
          ...slugs
            // A row whose canonical points at another slug would duplicate an
            // entry; the target is already listed under its own slug.
            .filter((slug) => !CANONICAL_SLUG_OVERRIDES[slug])
            .map((slug) => ({
              path: `/exercises/${slug}`,
              changefreq: "monthly" as const,
              priority: "0.7",
            })),
          { path: "/guides", changefreq: "weekly", priority: "0.9" },
          // Guides carry no has_notes-style condition: one is authored by
          // definition. Drafts are filtered inside publishedGuideSlugs().
          ...publishedGuideSlugs().map((slug) => ({
            path: `/guides/${slug}`,
            changefreq: "monthly" as const,
            priority: "0.8",
          })),
          { path: "/about", changefreq: "monthly", priority: "0.5" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
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
