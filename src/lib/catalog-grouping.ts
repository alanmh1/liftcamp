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
    rows: rows.filter((r) => rowMuscles(r).includes(muscle)),
  }));
}

/** Distinct exercises on a region page (sections can overlap). */
export function regionTotal(sections: MuscleSection[]): number {
  const set = new Set<string>();
  for (const s of sections) for (const r of s.rows) set.add(r.slug);
  return set.size;
}
