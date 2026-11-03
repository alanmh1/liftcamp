// The /plate-calculator page's copy, from docs/plate-calculator.json,
// imported as is so the page and the JSON cannot drift. All plate math and
// display rules come from packages/shared/src/plates.ts; nothing here
// computes a load.

import type { WeightUnit } from "@liftcamp/shared";
import data from "../../../../docs/plate-calculator.json";

export type ContentFaq = { q: string; a: string };
export type ContentLink = { label: string; href: string };
export type ContentTable = { caption: string; columns: string[]; rows: string[][] };

export type PlateCalculatorSection = {
  id: string;
  heading: string;
  body: string[];
  tables?: ContentTable[];
  after?: string[];
  links?: ContentLink[];
};

export type PlateCalculatorPage = {
  slug: string;
  path: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  defaultTarget: Record<WeightUnit, number>;
  sections: PlateCalculatorSection[];
  faq: ContentFaq[];
  cta: { label: string; body: string; campaign: string };
};

export const PLATE_CALCULATOR: PlateCalculatorPage = data;

/** The unit and bar a common-loads table is written for, from its caption
 *  ("Pounds, 45 lb bar"), so the test can check each row against
 *  platesForWeight. */
export function tableUnitAndBar(caption: string): { unit: WeightUnit; bar: number } | null {
  const m = /(\d+(?:\.\d+)?)\s*(lb|kg) bar/.exec(caption);
  if (!m) return null;
  return { unit: m[2] as WeightUnit, bar: Number(m[1]) };
}

/** "135 lb" to 135. */
export function parseTotal(cell: string): number {
  return Number(cell.replace(/[^\d.]/g, ""));
}
