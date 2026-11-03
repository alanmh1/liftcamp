import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Every public page header carries the brand glow (components/PageGlow.tsx).
// A route passes when its file renders <PageGlow /> itself or renders one of
// the hero components below, each of which renders it. A new public route
// fails here until it does one of the two.

const SRC = join(__dirname, "..");
const ROUTES = join(SRC, "routes");

/** Hero components that render <PageGlow /> in their header, with their file. */
const GLOW_HEROES: Record<string, string> = {
  HubHero: "components/catalog/v2/HubParts.tsx",
  DetailHeader: "components/catalog/v2/DetailHeader.tsx",
  ContentHero: "components/content/ContentParts.tsx",
  RoutinesHeader: "components/routines/RoutinesHeader.tsx",
};

/** Route files with no glowing header on purpose: the root layout, the
 *  homepage (its HeroSection has its own glow), the legal pages, the invite
 *  landing, and the signed-in pages. */
const SKIP = new Set([
  "__root.tsx",
  "index.tsx",
  "privacy.tsx",
  "terms.tsx",
  "i.$code.tsx",
  "admin.tsx",
  "login.tsx",
]);

/** Page routes only: .ts routes (sitemap, llms.txt, the MCP endpoint) serve
 *  no HTML page. */
const pageRoutes = readdirSync(ROUTES).filter((f) => f.endsWith(".tsx") && !SKIP.has(f));

function rendersGlow(source: string): boolean {
  if (source.includes("<PageGlow")) return true;
  return Object.keys(GLOW_HEROES).some((name) => source.includes(`<${name}`));
}

describe("page glow", () => {
  it("finds the public routes", () => {
    expect(pageRoutes.length).toBeGreaterThan(10);
  });

  it.each(Object.entries(GLOW_HEROES))("%s renders <PageGlow />", (_name, file) => {
    expect(readFileSync(join(SRC, file), "utf8")).toContain("<PageGlow");
  });

  it.each(pageRoutes)("%s renders <PageGlow /> in its header", (file) => {
    const source = readFileSync(join(ROUTES, file), "utf8");
    expect(
      rendersGlow(source),
      `${file} is a public page without <PageGlow />. Render it in the page header, ` +
        `or use a hero component that does (${Object.keys(GLOW_HEROES).join(", ")}). ` +
        `If the page should have no glow, add it to SKIP in this test.`,
    ).toBe(true);
  });

  it("no route hand-copies a header glow", () => {
    const pattern = /bg-pr\/\d+ blur-3xl|bg-primary\/(?:5|10) blur-3xl/;
    const copies = pageRoutes.filter((f) => pattern.test(readFileSync(join(ROUTES, f), "utf8")));
    expect(copies).toEqual([]);
  });
});
