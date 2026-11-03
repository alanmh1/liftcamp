// The rule behind scripts/check-guide-links.ts: every AUTHORED_SLUGS entry
// is a catalog exercise with a beginner_notes row, and every LINKABLE_SLUGS
// entry is a catalog exercise without one. Pure, so the unit test covers it
// without the database.

import { AUTHORED_SLUGS, LINKABLE_SLUGS } from "@/components/guides/ExerciseLink";

/** One catalog row: its slug and whether it has a beginner_notes row. */
export type GuideLinkRow = { slug: string; has_notes: boolean };

export function guideLinkProblems(
  rows: readonly GuideLinkRow[],
  authored: readonly string[] = AUTHORED_SLUGS,
  linkable: readonly string[] = LINKABLE_SLUGS,
): string[] {
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const problems: string[] = [];
  for (const slug of authored) {
    const row = bySlug.get(slug);
    if (!row) problems.push(`AUTHORED_SLUGS: ${slug} is not in the catalog`);
    else if (!row.has_notes) problems.push(`AUTHORED_SLUGS: ${slug} has no beginner_notes row`);
  }
  for (const slug of linkable) {
    const row = bySlug.get(slug);
    if (!row) problems.push(`LINKABLE_SLUGS: ${slug} is not in the catalog`);
    else if (row.has_notes)
      problems.push(`LINKABLE_SLUGS: ${slug} now has notes, move it to AUTHORED_SLUGS`);
  }
  const noted = rows.filter((r) => r.has_notes).map((r) => r.slug);
  const authoredSet = new Set(authored);
  for (const slug of noted) {
    if (!authoredSet.has(slug)) problems.push(`AUTHORED_SLUGS: missing ${slug}, which has notes`);
  }
  const sorted = [...authored].sort();
  if (sorted.some((s, i) => s !== authored[i])) problems.push("AUTHORED_SLUGS is not sorted");
  return problems;
}
