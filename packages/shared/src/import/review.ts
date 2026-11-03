import type { ImportChoice } from "./plan";
import type { ImportRow } from "./row";

/**
 * What the review screen's two questions show (docs/import-strong-hevy-spec.md):
 * whether any chosen exercise is a dumbbell one, and one line from the file
 * under each question so the person can tell which answer is theirs.
 */

type EquipmentEntry = { id: string; equipment?: string | null };

/** Source names to their set counts, most logged first, file order breaking ties. */
function byCount(rows: readonly ImportRow[], keep: (row: ImportRow) => boolean): string[] {
  const counts = new Map<string, number>();
  for (const r of rows) if (keep(r)) counts.set(r.exercise, (counts.get(r.exercise) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

function equipmentOf(
  name: string,
  choices: Readonly<Record<string, ImportChoice>>,
  byId: ReadonlyMap<string, EquipmentEntry>,
): string | null {
  const c = choices[name];
  if (!c || c === "skip") return null;
  return byId.get(c)?.equipment ?? null;
}

function index(catalog: readonly EquipmentEntry[]): Map<string, EquipmentEntry> {
  return new Map(catalog.map((e) => [e.id, e]));
}

/** Whether any source name is currently matched to an exercise with `equipment` `dumbbell`. */
export function hasDumbbellChoice(
  choices: Readonly<Record<string, ImportChoice>>,
  catalog: readonly EquipmentEntry[],
): boolean {
  const byId = index(catalog);
  return Object.keys(choices).some((name) => equipmentOf(name, choices, byId) === "dumbbell");
}

const weighted = (r: ImportRow) => r.weight != null && r.weight > 0;

/**
 * For "Weights in Strong were in": the heaviest set of the most logged
 * exercise matched to a barbell exercise, else of the most logged exercise
 * with a weight. Null when nothing in the file has a weight.
 */
export function heaviestSetSample(
  rows: readonly ImportRow[],
  choices: Readonly<Record<string, ImportChoice>>,
  catalog: readonly EquipmentEntry[],
): { name: string; weight: number } | null {
  const byId = index(catalog);
  const name =
    byCount(rows, (r) => weighted(r) && equipmentOf(r.exercise, choices, byId) === "barbell")[0] ??
    byCount(rows, weighted)[0];
  if (!name) return null;
  const weight = Math.max(...rows.filter((r) => r.exercise === name && weighted(r)).map((r) => r.weight as number));
  return { name, weight };
}

/**
 * For "Dumbbells were logged as": the median working-set weight of the most
 * logged exercise matched to a dumbbell exercise, as logged, with its
 * unit (null when the file has none). Null when no dumbbell exercise has a
 * weighted working set.
 */
export function dumbbellSample(
  rows: readonly ImportRow[],
  choices: Readonly<Record<string, ImportChoice>>,
  catalog: readonly EquipmentEntry[],
): { name: string; weight: number; unit: "kg" | "lb" | null } | null {
  const byId = index(catalog);
  const working = (r: ImportRow) => !r.warmup && weighted(r);
  const name = byCount(rows, (r) => working(r) && equipmentOf(r.exercise, choices, byId) === "dumbbell")[0];
  if (!name) return null;
  const sets = rows.filter((r) => r.exercise === name && working(r));
  const weights = sets.map((r) => r.weight as number).sort((a, b) => a - b);
  const mid = Math.floor(weights.length / 2);
  const median = weights.length % 2 === 1 ? weights[mid] : (weights[mid - 1] + weights[mid]) / 2;
  return { name, weight: Math.round(median * 100) / 100, unit: sets[0].unit };
}
