// The /compare/<slug> pages' copy, from docs/compare-pages.json, imported as
// is so the pages and the JSON cannot drift. Four pages; any other slug is
// a 404, and there is no /compare index for now.

import data from "../../../../docs/compare-pages.json";
import type { ContentFaq, ContentLink } from "./plate-calculator";

export type CompareSource = { label: string; url: string };

export type CompareSection = { id: string; heading: string; body: string[] };

export type ComparePage = {
  slug: string;
  path: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  table: { columns: string[]; rows: string[][] };
  sections: CompareSection[];
  faq: ContentFaq[];
  /** Keys into COMPARE_SOURCES. */
  sources: string[];
  links?: ContentLink[];
};

type CompareData = {
  about: string;
  /** "2 November 2026", shown as "Prices checked <checked>". */
  checked: string;
  sources: Record<string, CompareSource>;
  pages: ComparePage[];
};

const DATA: CompareData = data;

export const COMPARE_CHECKED = DATA.checked;
export const COMPARE_SOURCES = DATA.sources;
export const COMPARE_PAGES: readonly ComparePage[] = DATA.pages;

export function comparePageFor(slug: string): ComparePage | undefined {
  return COMPARE_PAGES.find((p) => p.slug === slug);
}

/** The LiftCamp column of a page's table, or undefined when the page
 *  compares two other apps. */
export function liftCampColumn(page: ComparePage): number | undefined {
  const i = page.table.columns.indexOf("LiftCamp");
  return i < 0 ? undefined : i;
}

/** A page's sources in its own order. A key missing from the sources map
 *  drops out; the unit test is what catches it. */
export function pageSources(page: ComparePage): CompareSource[] {
  return page.sources.flatMap((k) => COMPARE_SOURCES[k] ?? []);
}
