import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORAGE_PREFIX } from '@liftcamp/shared';
import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Notifications from 'expo-notifications';
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import { canScheduleExactAlarms } from '../../modules/exact-alarms';

/**
 * Android's exact alarm setting ("Alarms & reminders"), which decides
 * whether the rest alert fires at the end of the rest or up to an hour
 * late. expo-notifications schedules with an exact alarm only while the
 * app may (Android 12+); below 12, and on iOS, timing is always exact.
 *
 * The app declares SCHEDULE_EXACT_ALARM (app.json). Android 12 and 13
 * grant it at install. Android 14+ leaves it off for a new install, so
 * the workout screen offers the setting once (ExactAlarmSheet) and
 * Settings shows a row while it is off.
 *
 * The answer is read at launch and again on every return to the
 * foreground, which is how the app learns the user turned it on in
 * system settings.
 */

/** Set when the one-time sheet has been shown, whatever the answer. */
const OFFERED_KEY = `${APP_STORAGE_PREFIX}exact-alarms:offered`;

const PACKAGE = Constants.expoConfig?.android?.package ?? 'app.liftcamp.mobile';

let on = canScheduleExactAlarms();
const listeners = new Set<() => void>();

/** Reads the setting again and tells subscribers if it changed. */
function refresh(): boolean {
  const next = canScheduleExactAlarms();
  if (next !== on) {
    on = next;
    listeners.forEach((l) => l());
  }
  return on;
}

if (Platform.OS === 'android') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') refresh();
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether a scheduled alert fires on time, kept current across returns to the foreground. */
export function useExactAlarmsOn(): boolean {
  return useSyncExternalStore(subscribe, () => on);
}

/** Opens LiftCamp's "Alarms & reminders" page in system settings. */
export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.REQUEST_SCHEDULE_EXACT_ALARM, {
      data: `package:${PACKAGE}`,
    });
  } catch {
    // No such page on this phone; the row stays and nothing else happens.
  }
  refresh();
}

/**
 * Whether the workout screen should show the one-time sheet: Android 14+,
 * exact alarms off, notifications allowed (an alert that never shows
 * gains nothing from on-time), and the sheet never shown on this install.
 */
export async function shouldOfferExactAlarms(): Promise<boolean> {
  if (Platform.OS !== 'android' || (Platform.Version as number) < 34) return false;
  if (refresh()) return false;
  try {
    const [{ granted }, offered] = await Promise.all([
      Notifications.getPermissionsAsync(),
      AsyncStorage.getItem(OFFERED_KEY),
    ]);
    return granted && offered == null;
  } catch {
    return false;
  }
}

/** Records that the sheet was shown, so it never shows again. */
export function markExactAlarmsOffered(): Promise<void> {
  return AsyncStorage.setItem(OFFERED_KEY, new Date().toISOString()).catch(() => {});
}
