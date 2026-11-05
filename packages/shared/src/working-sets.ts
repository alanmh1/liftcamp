// Warm-up sets and the sets that count.
//
// A Pro warm-up row (`sets.set_type` 'warmup') is logged like any set but
// never counts: not toward volume, set counts, session records or PRs.
// Every reader that sums or counts a finished workout's sets goes through
// `countedSets`, so the rule lives here and nowhere else. The badges a set
// list draws ("W", then 1, 2, 3 for the working sets) come from
// `setBadges`, so every list numbers sets the way the live card does.

import { setVolume, type SetForDisplay } from "./set-weight";

export const WARMUP_SET_TYPE = "warmup";

/**
 * What the set type sheet saves for "Working set". Null also counts as a
 * working set, but it is untyped: `classifySets` can read a light untyped
 * set as a warm-up, and an empty card can be given a generated warm-up.
 * This says the user chose.
 */
export const WORKING_SET_TYPE = "normal";

type Typed = { set_type?: string | null };

/** A generated warm-up row. Untyped rows (every set before Pro) are working sets. */
export function isWarmupSet(set: Typed | null | undefined): boolean {
  return set?.set_type === WARMUP_SET_TYPE;
}

/** A completed working set: what volume, set counts, records and PRs count. */
export function isCountedSet(set: Typed & { completed: boolean }): boolean {
  return set.completed && !isWarmupSet(set);
}

/** The completed working sets, in the order given. */
export function countedSets<T extends Typed & { completed: boolean }>(sets: readonly T[] | null | undefined): T[] {
  return (sets ?? []).filter(isCountedSet);
}

/** The rows that are not warm-ups, done or not: the planned set count. */
export function workingSetCount(sets: readonly Typed[] | null | undefined): number {
  let n = 0;
  for (const s of sets ?? []) if (!isWarmupSet(s)) n += 1;
  return n;
}

/** Each row's number badge: "W" for a warm-up, the working sets numbered from 1 after it. */
export function setBadges(sets: readonly Typed[]): string[] {
  let n = 0;
  return sets.map((s) => (isWarmupSet(s) ? "W" : String((n += 1))));
}

type TotalsExercise = {
  exercise: Parameters<typeof setVolume>[1];
  sets: readonly (Typed & { completed: boolean; weight?: string | null; weight_value: number | null; reps: number | null })[] | null | undefined;
};

/**
 * A workout's volume (through `setVolume`) and its set count, over the
 * completed working sets. The sets must already be in the unit wanted.
 */
export function countedTotals(
  exercises: readonly TotalsExercise[],
  bodyweight: number | null | undefined,
): { volume: number; sets: number } {
  let volume = 0;
  let sets = 0;
  for (const we of exercises) {
    for (const s of countedSets(we.sets)) {
      sets += 1;
      const set: SetForDisplay = { weight: s.weight ?? null, weight_value: s.weight_value, reps: s.reps };
      volume += setVolume(set, we.exercise, bodyweight);
    }
  }
  return { volume, sets };
}
