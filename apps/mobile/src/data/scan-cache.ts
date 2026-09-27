import { GenerationCache } from '@liftcamp/shared';

import type { ScanRow } from '@/data/history';

/**
 * The account-wide PR scan, cached in memory for the session: every
 * `workout_exercises` row the user owns, with its sets, in the user's unit.
 * History (list and detail), the exercise screen, the workout summary and
 * Profile all derive their PRs, counts and totals from it, so after the
 * first screen pays for the scan the rest read it from here.
 *
 * Keyed by user and unit. Stale after any write that could change what the
 * scan holds or what is derived from it: every set, exercise and workout
 * write in workouts.ts calls `invalidateScanCache`, and so does a
 * bodyweight change, which rescores bodyweight exercises. Pull to refresh
 * forces a rescan. The rules are in GenerationCache in shared, with tests.
 *
 * Its own module because workouts.ts invalidates it and history.ts reads
 * it, and history.ts already imports workouts.ts; importing history.ts
 * back from workouts.ts would be a cycle. The ScanRow import is type-only.
 */
export const scanCache = new GenerationCache<ScanRow[]>();

/**
 * The user's bodyweight, cached beside the scan and cleared by the same
 * invalidation: the writes that change it (a bodyweight edit, and a unit
 * switch, which converts it) both call `invalidateScanCache`. Boxed, since
 * no bodyweight set is a real answer, and the cache treats a bare null as
 * a failed read.
 */
export const bodyweightCache = new GenerationCache<{ value: number | null }>();

/**
 * Marks the scan and the bodyweight stale. Called after every write to
 * sets, exercises or workouts, and after a bodyweight or unit change.
 */
export function invalidateScanCache(): void {
  scanCache.invalidate();
  bodyweightCache.invalidate();
}
