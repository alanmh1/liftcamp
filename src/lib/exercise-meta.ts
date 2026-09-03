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
function firstSentence(md: string): string {
  const para = md.trim().split("\n\n")[0]?.trim() ?? "";
  const m = para.match(/^(.+?[.!?])(?:\s|$)/);
  return (m?.[1] ?? para).trim();
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
