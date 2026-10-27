import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getSeoCatalog } from "@/lib/public-catalog.functions";
import { sitemapEntries, sitemapXml } from "@/lib/sitemap";
import { guideMetas } from "@/content/guides";

// Only indexable URLs belong here. /login and /admin are excluded (/admin is
// also disallowed in robots.txt), and exercise detail pages appear only when
// they have an authored beginner block, the same condition the detail route
// uses to decide noindex. Listing a noindexed URL is a coverage error in
// Search Console, so the two rules must not drift. The list and every
// lastmod rule live in src/lib/sitemap.ts.
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const catalog = await getSeoCatalog();
        // Drafts are filtered inside guideMetas().
        const xml = sitemapXml(sitemapEntries(catalog, guideMetas()));
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
