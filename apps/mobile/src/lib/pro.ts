import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORAGE_PREFIX, canShowProgression } from '@liftcamp/shared';
import { useSyncExternalStore } from 'react';

/**
 * Who sees Pro progression. Pro only, never a free preview.
 *
 * Until RevenueCat lands nobody is Pro. In a dev build the Developer
 * switch in Settings stands in for both the flag and Pro, so the feature
 * can be tried in the Simulator. A Release build, an EAS preview and
 * production all have `__DEV__` false, so the gate is shut there whatever
 * the stored switch says.
 *
 * The switch is stored under the app prefix, so Start fresh and account
 * deletion clear it.
 */

const DEV_PROGRESSION_KEY = `${APP_STORAGE_PREFIX}dev:progression`;

let devProgression = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

if (__DEV__) {
  AsyncStorage.getItem(DEV_PROGRESSION_KEY)
    .then((v) => {
      devProgression = v === '1';
      emit();
    })
    .catch(() => {
      // Off, which is the default.
    });
}

/** The Developer switch's state and setter. Dev builds only. */
export function useDevProgression(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, () => devProgression);
  return [
    on,
    (next: boolean) => {
      if (!__DEV__) return;
      devProgression = next;
      emit();
      AsyncStorage.setItem(DEV_PROGRESSION_KEY, next ? '1' : '0').catch(() => {
        // Kept for this run; the next launch starts off.
      });
    },
  ];
}

/** Whether progression may be computed and shown. */
export function useProgressionGate(): boolean {
  const dev = useSyncExternalStore(subscribe, () => devProgression);
  // RevenueCat replaces the dev stand-in for `isPro`.
  return canShowProgression({ flagOn: __DEV__ && dev, isPro: __DEV__ && dev });
}
