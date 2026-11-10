import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  APP_STORAGE_PREFIX,
  FREE_CUSTOM_ROUTINES,
  atRoutineCap,
  resolvePlan,
  resolvePro,
  type PaywallSource,
  type ProPlan,
} from '@liftcamp/shared';
import { useRouter } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';
import { Alert, Platform } from 'react-native';

import { countCustomRoutines } from '@/data/home';
import { refreshCustomExerciseStatus } from '@/lib/custom-exercise-access';
import { useProLaunched } from '@/lib/pro-launched';
import { purchasesAvailable, usePurchasesState } from '@/lib/purchases';
import { refreshEntitlementRow, useEntitlementRow } from '@/lib/tester-pro';

/**
 * Who has Pro, and whether the app may sell it to the rest.
 *
 * `usePro` is `resolvePro` in shared over two sources: RevenueCat's active
 * entitlements (lib/purchases.ts, iOS only) and the user's
 * `user_entitlements` row (lib/tester-pro.ts: tester grants from /admin
 * and purchase rows from the webhook). Either is enough, in every build,
 * and neither depends on the pro_launched flag.
 *
 * In a dev build the Developer switch in Settings also opens it, so a
 * feature can be tried in the Simulator. A Release build, an EAS preview
 * and production all have `__DEV__` false, so the switch does nothing
 * there. It is stored under the app prefix, so Start fresh and account
 * deletion clear it.
 *
 * `useProUpsell` is the other half: while it says `available` (iOS,
 * pro_launched on, not Pro) a gate shows its way to the paywall. Otherwise
 * the gate shows nothing, as before Pro went on sale.
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

/** Whether the user has Pro, so progression and the other Pro features may run. */
export function usePro(): boolean {
  const dev = useSyncExternalStore(subscribe, () => devProgression);
  const { activeEntitlementIds } = usePurchasesState();
  const row = useEntitlementRow();
  if (__DEV__ && dev) return true;
  return resolvePro({ rcActive: activeEntitlementIds, rows: row ? [row] : [], now: Date.now() });
}

/** The plan for Settings, or null without one. */
export function useProPlan(): ProPlan | null {
  const { entitlement } = usePurchasesState();
  const row = useEntitlementRow();
  return resolvePlan({ rc: entitlement, row, now: Date.now() });
}

export type ProUpsell = {
  /** iOS, Pro on sale, and this user does not have it. */
  available: boolean;
  open: (source: PaywallSource) => void;
};

/** Whether a gate may offer Pro, and the way to the paywall. */
export function useProUpsell(): ProUpsell {
  const launched = useProLaunched();
  const isPro = usePro();
  const router = useRouter();
  const open = useCallback(
    (source: PaywallSource) => router.push({ pathname: '/paywall', params: { source } }),
    [router],
  );
  return { available: Platform.OS === 'ios' && purchasesAvailable && launched && !isPro, open };
}

/**
 * Asks before adding a custom routine: true to go ahead. Only a free user
 * who could buy Pro is capped, so with the flag off, on Android and for Pro
 * nothing changes. A failed count goes ahead: saving needs the network
 * anyway, and says so itself.
 */
export function useRoutineCapCheck(): (userId: string) => Promise<boolean> {
  const { available, open } = useProUpsell();
  return useCallback(
    async (userId: string) => {
      if (!available) return true;
      const used = await countCustomRoutines(userId);
      if (used === null || !atRoutineCap(used)) return true;
      Alert.alert(
        "You've used your free custom routines",
        `Free accounts can have ${FREE_CUSTOM_ROUTINES}. Delete one to make room, or upgrade to Pro for unlimited.`,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Upgrade to Pro', onPress: () => open('routine_cap') },
        ],
      );
      return false;
    },
    [available, open],
  );
}

/** How long after a purchase to read the server again. The webhook takes seconds. */
const SERVER_SYNC_DELAYS_MS = [0, 5000, 20000];

/**
 * After a purchase or a restore. The app knows at once from the SDK; the
 * server's cap on custom exercises reads user_entitlements, which the
 * webhook writes a moment later, so the row and the status are read again.
 */
export function syncServerPro(): void {
  for (const ms of SERVER_SYNC_DELAYS_MS) {
    setTimeout(() => {
      refreshEntitlementRow();
      refreshCustomExerciseStatus();
    }, ms);
  }
}
