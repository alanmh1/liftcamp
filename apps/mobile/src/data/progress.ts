import { buildProgressIndex, type ProgressIndex, type WeightUnit } from '@liftcamp/shared';

import { getScanRows, markPrs, peekScanRows, type ScanRow } from '@/data/history';
import { getBodyweight } from '@/data/workouts';
import { bodyweightCache } from '@/data/scan-cache';

/**
 * The progress index for Profile, Trends and the PR list
 * (buildProgressIndex in shared), from the account-wide scan the Profile
 * already reads. No new query: the scan and the bodyweight come from the
 * session caches in scan-cache.ts.
 *
 * Memoised on the scan array itself. The scan cache hands back the same
 * array until a write invalidates it (a new generation is a new array), so
 * a WeakMap keyed by it is the "scan generation" key, and the index is
 * built once per generation, bodyweight and unit, however often a screen
 * switches range.
 */
const built = new WeakMap<ScanRow[], { bodyweight: number | null; unit: WeightUnit; index: ProgressIndex }>();

export function progressIndexFor(rows: ScanRow[], bodyweight: number | null, unit: WeightUnit): ProgressIndex {
  const hit = built.get(rows);
  if (hit && hit.bodyweight === bodyweight && hit.unit === unit) return hit.index;
  const index = buildProgressIndex(rows, bodyweight, unit, markPrs(rows, bodyweight).prSetIds);
  built.set(rows, { bodyweight, unit, index });
  return index;
}

/** Null when the scan was abandoned or failed, as for the Profile stats. */
export async function getProgressIndex(
  userId: string,
  unit: WeightUnit,
  { force = false }: { force?: boolean } = {},
): Promise<ProgressIndex | null> {
  const [rows, bodyweight] = await Promise.all([getScanRows(userId, unit, { force }), getBodyweight(userId)]);
  return rows ? progressIndexFor(rows, bodyweight, unit) : null;
}

/** The index without a read, when the scan and the bodyweight are cached and fresh. */
export function peekProgressIndex(userId: string, unit: WeightUnit): ProgressIndex | undefined {
  const rows = peekScanRows(userId, unit);
  const bodyweight = bodyweightCache.peek(userId);
  if (rows === undefined || bodyweight === undefined) return undefined;
  return progressIndexFor(rows, bodyweight.value, unit);
}
