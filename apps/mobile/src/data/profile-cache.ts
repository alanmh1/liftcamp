/**
 * A counter every set and workout write bumps, so Profile knows its cached
 * scan is stale. Its own module because workouts.ts does the bumping and
 * profile.ts reads it, and profile.ts already imports workouts.ts through
 * history.ts; a direct import back would be a cycle.
 */

let generation = 0;

/** Marks the Profile stats stale. Called after every write to sets or workouts. */
export function invalidateProfileStats(): void {
  generation += 1;
}

export function profileStatsGeneration(): number {
  return generation;
}
