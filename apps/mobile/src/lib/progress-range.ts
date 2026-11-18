import {
  PROFILE_DEFAULT_PRESET,
  TRENDS_DEFAULT_PRESET,
  type RangeChoice,
} from '@liftcamp/shared';
import { useCallback, useSyncExternalStore } from 'react';

/**
 * The range each progress screen shows, held in memory for the session:
 * Profile and Trends each keep their own, the PR list reads Profile's. A
 * module-level store, so leaving and coming back keeps the choice, and a
 * new launch starts on the defaults. Nothing is written to AsyncStorage.
 */
export type RangeScreen = 'profile' | 'trends';

const choices: Record<RangeScreen, RangeChoice> = {
  profile: PROFILE_DEFAULT_PRESET,
  trends: TRENDS_DEFAULT_PRESET,
};
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRangeChoice(screen: RangeScreen): [RangeChoice, (next: RangeChoice) => void] {
  const choice = useSyncExternalStore(subscribe, () => choices[screen]);
  const set = useCallback(
    (next: RangeChoice) => {
      choices[screen] = next;
      for (const l of listeners) l();
    },
    [screen],
  );
  return [choice, set];
}
