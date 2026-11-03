import { normalizeSearch } from "../muscle-vocab";

/** One `import_exercise_map` row for the source being imported. */
export type ImportMapRow = { source_name: string; exercise_id: string; close: boolean };

/**
 * A catalog exercise as matching needs it. `alias_text` is the column's
 * value: pipe-delimited aliases, already normalized with normalizeSearch's
 * transform. Absent or null means no aliases.
 */
export type MatchCatalogEntry = { id: string; name: string; alias_text?: string | null };

export type ExerciseMatch = {
  /** The name as the other app wrote it. */
  name: string;
  /** Rows (sets) in the file under that name. */
  sets: number;
  /** The LiftCamp exercise, or null when nothing matched. */
  exerciseId: string | null;
  /**
   * A near variant: the map's `close` flag, or a match on a catalog alias
   * (aliases are loose). Name matches, the rewritten name included, are exact.
   */
  close: boolean;
};

/**
 * `Base (Equipment)` as `Equipment Base`, the way the catalog names most
 * exercises. Null for a name not shaped like that.
 */
export function equipmentFirst(name: string): string | null {
  const m = name.trim().match(/^(.+?)\s*\(([^()]+)\)$/);
  if (!m) return null;
  return `${m[2].trim()} ${m[1].trim()}`;
}

/**
 * Matches every distinct exercise name in a file to the catalog, in order
 * of first appearance. `names` holds one entry per row, so each match
 * carries its set count.
 *
 * Per name: the map row for it (with its `close` flag), then a catalog
 * exercise whose normalized name equals the normalized name, then one whose
 * name equals the rewritten name (`Squat (Barbell)` as `Barbell Squat`),
 * then one with that normalized alias as a close match, else unmatched. A
 * map row pointing at an exercise missing from the catalog falls through
 * to the name checks.
 */
export function matchExercises(
  names: readonly string[],
  map: readonly ImportMapRow[],
  catalog: readonly MatchCatalogEntry[],
): ExerciseMatch[] {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);

  const ids = new Set(catalog.map((e) => e.id));
  const byMap = new Map<string, ImportMapRow>();
  for (const row of map) if (ids.has(row.exercise_id)) byMap.set(row.source_name, row);

  const byName = new Map<string, string>();
  const byAlias = new Map<string, string>();
  for (const e of catalog) {
    const key = normalizeSearch(e.name);
    if (key && !byName.has(key)) byName.set(key, e.id);
    for (const alias of (e.alias_text ?? "").split("|")) {
      const a = normalizeSearch(alias);
      if (a && !byAlias.has(a)) byAlias.set(a, e.id);
    }
  }

  return [...counts].map(([name, sets]) => {
    const mapped = byMap.get(name);
    if (mapped) return { name, sets, exerciseId: mapped.exercise_id, close: mapped.close };
    const key = normalizeSearch(name);
    const exact = byName.get(key);
    if (exact) return { name, sets, exerciseId: exact, close: false };
    const rewritten = equipmentFirst(name);
    const rewrittenId = rewritten ? byName.get(normalizeSearch(rewritten)) : undefined;
    if (rewrittenId) return { name, sets, exerciseId: rewrittenId, close: false };
    const alias = byAlias.get(key);
    if (alias) return { name, sets, exerciseId: alias, close: true };
    return { name, sets, exerciseId: null, close: false };
  });
}
