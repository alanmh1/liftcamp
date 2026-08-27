// Pure grouping over the catalog index. No IO, so both the hub and the region
// pages derive their counts from exactly the same rules.

import type { CatalogRow } from "./public-catalog.functions";
import { canonMuscleList, isCanonicalMuscle, type CanonicalMuscle } from "./muscle-vocab";
import { MUSCLE_REGION, REGION_MUSCLES, REGIONS, type Region } from "./muscle-regions";

/** Canonical primary muscles for a row, ignoring anything outside the 17. */
export function rowMuscles(
  row: Pick<CatalogRow, "primary_muscle" | "all_primary_muscles">,
): CanonicalMuscle[] {
  return canonMuscleList(row.all_primary_muscles || row.primary_muscle).filter(
    isCanonicalMuscle,
  ) as CanonicalMuscle[];
}

/** The one region an exercise belongs to, from its first primary muscle. Used
 *  by the detail breadcrumb, which must name exactly one collection. */
export function primaryRegion(
  row: Pick<CatalogRow, "primary_muscle" | "all_primary_muscles">,
): { region: Region; muscle: CanonicalMuscle } | null {
  const first = rowMuscles(row)[0];
  if (!first) return null;
  return { region: MUSCLE_REGION[first], muscle: first };
}

/** Distinct exercises appearing anywhere on a region page.
 *
 *  Reads REGION_MUSCLES, NOT MUSCLE_REGION — a tile count is a promise about
 *  what the page contains, so it has to be counted the same way the page is
 *  built. The two differ only where REGION_MUSCLES repeats a muscle: lower
 *  back sections under both back and core, so those 27 rows are counted in
 *  both and the six tiles sum to more than 883. That is correct; the six
 *  regions are overlapping collections, not a partition. */
export function regionCounts(rows: CatalogRow[]): Record<Region, number> {
  const seen: Record<string, Set<string>> = Object.fromEntries(REGIONS.map((r) => [r, new Set()]));
  for (const row of rows) {
    const muscles = rowMuscles(row);
    for (const region of REGIONS) {
      if (REGION_MUSCLES[region].some((m) => muscles.includes(m))) seen[region].add(row.slug);
    }
  }
  return Object.fromEntries(REGIONS.map((r) => [r, seen[r].size])) as Record<Region, number>;
}

export type MuscleSection = { muscle: CanonicalMuscle; rows: CatalogRow[] };

/** Ordered anchored sections for a region page. Reads REGION_MUSCLES, so
 *  "lower back" renders under both back and core. */
export function regionSections(rows: CatalogRow[], region: Region): MuscleSection[] {
  return REGION_MUSCLES[region].map((muscle) => ({
    muscle,
    rows: rows.filter((r) => rowMuscles(r).includes(muscle)).sort(byNotesThenName),
  }));
}

/** Authored exercises first, then alphabetical. The rows Google is allowed to
 *  index are the rows with a beginner block, so they lead every section
 *  instead of whatever happens to start with "A". Ties fall back to the
 *  locale-independent name order the query already returned. */
function byNotesThenName(a: CatalogRow, b: CatalogRow): number {
  if (a.has_notes !== b.has_notes) return a.has_notes ? -1 : 1;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

/** Distinct exercises on a region page (sections can overlap). */
export function regionTotal(sections: MuscleSection[]): number {
  const set = new Set<string>();
  for (const s of sections) for (const r of s.rows) set.add(r.slug);
  return set.size;
}

/** Equipment facet for the hub, most common first. Computed server-side so the
 *  chips and their counts are in the initial HTML even though the rows they
 *  filter are fetched lazily. Singletons are dropped: a chip that resolves to
 *  one exercise is noise. */
export function equipmentFacets(rows: CatalogRow[], min = 8): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.equipment) continue;
    counts.set(row.equipment, (counts.get(row.equipment) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= min)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : 1));
}

/** Muscle facet for the hub, most common first. Counts every canonical primary
 *  muscle on a row, so a row with two primaries appears under both. */
export function muscleFacets(
  rows: CatalogRow[],
  min = 8,
): { value: CanonicalMuscle; count: number }[] {
  const counts = new Map<CanonicalMuscle, number>();
  for (const row of rows) {
    for (const m of rowMuscles(row)) counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= min)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : 1));
}

/** The authored rows — the ones with a hand-written beginner block. These are
 *  also the only indexable detail pages, so surfacing them on the hub gives
 *  every one of them a server-rendered link from the catalog root. */
export function featuredRows(rows: CatalogRow[], limit = 12): CatalogRow[] {
  const priority = new Map(COMMON_SLUGS.map((s, i) => [s, i]));
  return rows
    .filter((r) => r.has_notes)
    .sort((a, b) => {
      const pa = priority.get(a.slug) ?? Number.MAX_SAFE_INTEGER;
      const pb = priority.get(b.slug) ?? Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    })
    .slice(0, limit);
}

/** Fallback strip for the hub while `beginner_notes` is still thin: the lifts
 *  a beginner has actually heard of. Curated by slug and filtered against the
 *  live catalog, so a renamed row silently drops out instead of 404ing. */
const COMMON_SLUGS = [
  "barbell-squat",
  "barbell-bench-press",
  "barbell-deadlift",
  "barbell-shoulder-press",
  "pullups",
  "pushups",
  "bent-over-barbell-row",
  "dumbbell-bench-press",
  "wide-grip-lat-pulldown",
  "romanian-deadlift",
  "leg-press",
  "plank",
];

export function commonRows(rows: CatalogRow[]): CatalogRow[] {
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  return COMMON_SLUGS.map((s) => bySlug.get(s)).filter((r): r is CatalogRow => !!r);
}
