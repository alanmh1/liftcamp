import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORAGE_PREFIX, canShowProgression } from '@liftcamp/shared';
import { useSyncExternalStore } from 'react';

import { useTesterPro } from '@/lib/tester-pro';

/**
 * Who sees Pro progression. Pro only, never a free preview.
 *
 * Two ways in until RevenueCat lands:
 *
 * - A tester grant: the user's `user_entitlements` row, set from /admin
 *   (lib/tester-pro.ts). Works in every build, release included, and
 *   fails closed.
 * - In a dev build, the Developer switch in Settings, so the feature can
 *   be tried in the Simulator. A Release build, an EAS preview and
 *   production all have `__DEV__` false, so the switch does nothing there.
 *
 * pro-billing adds RevenueCat behind PRO_LAUNCHED; the gate is then
 * dev || testerGrant || (PRO_LAUNCHED && rcPro). See docs/pro-billing.md.
 *
 * The switch is stored under the app prefix, so Start fresh and account
 * deletion clear it.
 */

/**
 * Whether Pro can be bought in this build. False until pro-billing lands
 * RevenueCat (docs/pro-billing.md); surfaces that would sell Pro (the
 * custom exercise cap sheet) say it is coming instead.
 */
export const PRO_LAUNCHED = false;

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
  const testerGrant = useTesterPro();
  return canShowProgression({ flagOn: __DEV__ && dev, isPro: __DEV__ && dev }) || testerGrant;
}
