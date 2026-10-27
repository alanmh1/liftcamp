// Meta description for an exercise page.
//
// Three tiers, best first:
//   1. A row with beginner_notes: the opening sentence of starting_weight_md
//      (a direct answer, e.g. "Start with the empty bar.") plus the opening
//      sentence of form_breakdown_md (a symptom, e.g. "Your heels lift off the
//      floor."). Both match how beginners actually phrase the query, and the
//      76 rows that have notes are the pages worth ranking.
//   2. A row with level + primary muscle + equipment: differs on three terms.
//   3. Neither: the plain string.
//
// Checked against all 76 live rows: every tier-1 output lands between 71 and
// 154 characters, no fallbacks.

import type { BeginnerNotes } from "@/lib/public-catalog.functions";

/** Google renders roughly 155-160 characters. Staying under 155 means the
 *  string is never the thing that gets cut. */
const LIMIT = 155;

const TAIL = " Setup, form and swaps.";

/** First sentence of the first paragraph. The notes are authored plain text:
 *  no markdown, no abbreviations, no quotes, so splitting on terminal
 *  punctuation is safe. Verified against the full table. */
export function firstSentence(md: string): string {
  const para = md.trim().split("\n\n")[0]?.trim() ?? "";
  const m = para.match(/^(.+?[.!?])(?:\s|$)/);
  return (m?.[1] ?? para).trim();
}

/** The two questions the beginner block answers, phrased the way someone
 *  types them. Used for the visible headings AND the FAQPage JSON-LD from one
 *  array, so the rendered text and the markup can never drift.
 *
 *  substitution_heading stays out of this: it is authored per exercise as a
 *  conditional ("If the light dumbbells are all in use"), which is better copy
 *  than any question we could derive from it, and FAQPage needs a question. */
export function exerciseFaq(
  name: string,
  notes: BeginnerNotes,
): { q: string; a: string }[] {
  const n = name.toLowerCase();
  return [
    {
      q: `What weight should I start with on the ${n}?`,
      a: flatten(notes.starting_weight_md),
    },
    {
      q: `What usually goes wrong on the ${n}?`,
      a: flatten(notes.form_breakdown_md),
    },
  ];
}

/** Paragraph breaks collapse to spaces: JSON-LD answers are one string, and
 *  the reader sees the original paragraphs in the block itself. */
function flatten(md: string): string {
  return md.trim().split(/\s+/).join(" ");
}

/** Adds each piece only if the result still fits, so a long opening sentence
 *  degrades to a shorter description instead of a truncated one. */
export function beginnerNotesDescription(
  name: string,
  notes: BeginnerNotes,
): string | null {
  const start = firstSentence(notes.starting_weight_md);
  if (!start) return null;

  const base = `${name}: ${start}`;
  if (base.length > LIMIT) return null;

  const form = firstSentence(notes.form_breakdown_md);
  const withForm = form ? `${base} ${form}` : base;

  if (withForm.length + TAIL.length <= LIMIT) return withForm + TAIL;
  if (withForm.length <= LIMIT) return withForm;
  if (base.length + TAIL.length <= LIMIT) return base + TAIL;
  return base;
}

/** HowTo step name: the step's first clause, up to the first comma or
 *  period, at most 60 characters (cut back to a word boundary). A leading
 *  "From the starting position," is skipped for the clause after it. Falls back
 *  to "Step N" when the step has no words. */
export function howToStepName(text: string, position: number): string {
  const clauses = text.trim().split(/[,.]/).map((c) => c.trim());
  // "From the starting position, lower the bar" names nothing; the step is
  // the clause after it.
  let clause = clauses[0] ?? "";
  if (/^from the starting position$/i.test(clause) && clauses[1]) {
    clause = clauses[1].charAt(0).toUpperCase() + clauses[1].slice(1);
  }
  if (!clause) return `Step ${position}`;
  if (clause.length <= 60) return clause;
  const cut = clause.slice(0, 60);
  const space = cut.lastIndexOf(" ");
  return (space > 0 ? cut.slice(0, space) : cut).trim();
}
