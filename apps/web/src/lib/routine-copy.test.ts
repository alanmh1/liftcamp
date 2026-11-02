import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { routineCopy, routineGuideSlugs } from "./routine-copy";

const JSON_PATH = path.resolve(import.meta.dirname, "../../../../docs/routine-guides.json");
const FIXTURE_PATH = path.resolve(
  import.meta.dirname,
  "../../../../packages/shared/src/__fixtures__/system-templates.json",
);

type GuideEntry = {
  keyword: string;
  titleSuffix: string;
  answer: string;
  sections: unknown[];
  faqs: unknown[];
};

const doc = JSON.parse(readFileSync(JSON_PATH, "utf8")) as {
  routines: Record<string, GuideEntry>;
};
const copyOf = (slug: string) => routineCopy(slug, slug, 3, null);

describe("routine guide copy", () => {
  it("covers exactly the routines in docs/routine-guides.json", () => {
    expect(routineGuideSlugs().sort()).toEqual(Object.keys(doc.routines).sort());
    expect(Object.keys(doc.routines)).toHaveLength(3);
  });

  for (const [slug, entry] of Object.entries(doc.routines)) {
    it(`${slug} matches docs/routine-guides.json exactly`, () => {
      const copy = copyOf(slug);
      expect(copy.titleSuffix).toBe(entry.titleSuffix);
      expect(copy.answer).toBe(entry.answer);
      expect(JSON.stringify(copy.faqs)).toBe(JSON.stringify(entry.faqs));
      expect(JSON.stringify(copy.sections)).toBe(JSON.stringify(entry.sections));
    });
  }

  it("links only to routine slugs in the system templates fixture", () => {
    const rows = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as { program_slug: string }[];
    const slugs = new Set(rows.map((r) => r.program_slug));
    const hrefs = routineGuideSlugs().flatMap((slug) =>
      (copyOf(slug).sections ?? []).flatMap((s) => (s.links ?? []).map((l) => l.href)),
    );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      const m = /^\/routines\/([a-z0-9-]+)$/.exec(href);
      expect(m, href).not.toBeNull();
      expect(slugs.has(m![1]!), href).toBe(true);
    }
  });

  it("puts a schedule section in every guide, for the day cards", () => {
    for (const slug of routineGuideSlugs()) {
      expect(copyOf(slug).sections?.some((s) => s.id === "schedule"), slug).toBe(true);
    }
  });

  it("leaves other routines without sections", () => {
    expect(copyOf("full-body-3-day").sections).toBeUndefined();
  });
});
