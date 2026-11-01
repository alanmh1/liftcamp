import type { SiblingHistory, WeightUnit } from '@liftcamp/shared';
import { useSyncExternalStore } from 'react';

/**
 * What Pro starting weights and warm-ups need beyond an exercise's own
 * history: body details for the strength standards, the bar and plates,
 * the Warm-up sets setting, and related lifts for exercises the user has
 * never logged. Loaded by the workout screen only while the Pro gate is
 * open (data/pro-inputs.ts), and empty otherwise, so a free user's
 * progression input is unchanged.
 *
 * A store, not workout state, so `progressionFor` reads one copy for every
 * caller (the card, the tick, the chip check and the Live Activity) and
 * nothing lands in the workout's device copy. Its own module because
 * data/placeholders imports it and the loader imports data/history.
 */
export type ProInputs = {
  userId: string;
  unit: WeightUnit;
  sex: string | null;
  bodyweightKg: number | null;
  age: number | null;
  /** `barWeight` in shared, in `unit`. */
  barWeight: number;
  /** `availablePlates` in shared, in `unit`. */
  plates: number[];
  /** The Warm-up sets setting. Missing until it has been read. */
  warmups?: boolean;
  /** Related-lift history by exercise id, for exercises with no history of their own. */
  siblings: ReadonlyMap<string, SiblingHistory[]>;
};

let current: ProInputs | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The inputs for `userId` in `unit`, or null when none are loaded for them. */
export function proInputs(userId?: string | null, unit?: WeightUnit): ProInputs | null {
  if (!current) return null;
  if (userId != null && current.userId !== userId) return null;
  if (unit != null && current.unit !== unit) return null;
  return current;
}

export function setProInputs(next: ProInputs | null): void {
  current = next;
  for (const l of listeners) l();
}

/** Re-renders when the inputs change. Components that call `progressionFor` subscribe here. */
export function useProInputs(): ProInputs | null {
  return useSyncExternalStore(subscribe, () => current);
}
