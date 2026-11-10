import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORAGE_PREFIX } from '@liftcamp/shared';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { ensureNotificationChannels, REST_CHANNEL_ID } from '@/lib/notification-channels';

/**
 * The rest-end alert: a local notification scheduled for the moment the
 * rest timer runs out, so the sound and buzz arrive with the phone locked
 * or the app in the background. In the foreground the handler at the app
 * root hides it, because the workout screen's own haptic covers that case.
 *
 * One pending alert per workout, under the identifier `rest-<workoutId>`.
 * The workout screen's rest save effect schedules it on every start or
 * change and cancels it on every end or skip; finishing or discarding the
 * workout cancels it too, and sign-out and Start fresh cancel them all.
 *
 * A fired alert is removed from Notification Center as soon as it is
 * redundant: cancels dismiss the delivered copy along with the pending
 * one, and the app root dismisses every delivered alert at launch and on
 * each return to the foreground, since an open app shows the same state
 * in the Live Activity and on the workout screen.
 *
 * Every function swallows its own errors. A notification that fails to
 * schedule is a missed buzz, never a blocked set or a crash.
 *
 * Calls run one at a time, in the order they were made. A tap on +15
 * followed by Skip must not end with the +15's schedule landing after the
 * Skip's cancel.
 *
 * iOS and Android. On Android the alert posts to the `rest` channel
 * (lib/notification-channels.ts), which gives it its sound, vibration and
 * lock screen visibility; `interruptionLevel` is iOS only and Android
 * ignores it. Tapping it brings the app back to the screen it was on, the
 * workout, as on iOS.
 */

const PREFIX = 'rest-';

function identifier(workoutId: string): string {
  return `${PREFIX}${workoutId}`;
}

let chain: Promise<void> = Promise.resolve();

function serial(fn: () => Promise<void>): Promise<void> {
  const next = chain.then(fn).catch(() => {});
  chain = next;
  return next;
}

/**
 * Set just before the first Android permission request. Android has no
 * "not yet asked" state of its own: before the first answer on Android 13+
 * the permission reads as denied with canAskAgain true, the same as after
 * one denial. Gone with a reinstall, which resets the permission too.
 */
const ANDROID_ASKED_KEY = `${APP_STORAGE_PREFIX}notifications:asked`;

/**
 * Whether the notification permission has never been asked on this
 * install, so a request would show the system prompt. iOS: the status is
 * undetermined. Android 13+: not granted, the system would still prompt,
 * and the app has not asked before. Below Android 13 the permission is
 * granted at install, so this is false.
 */
export async function canAskNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (Platform.OS !== 'android') return current.status === Notifications.PermissionStatus.UNDETERMINED;
  if (current.granted || !current.canAskAgain) return false;
  return (await AsyncStorage.getItem(ANDROID_ASKED_KEY)) == null;
}

/**
 * Asks for permission the first time only (alert and sound, no badge on
 * iOS; POST_NOTIFICATIONS on Android 13+). After a denial it never asks
 * again; the alert is simply not scheduled. The Android channels are made
 * first, since Android 13 shows no prompt without one.
 */
export function ensureRestAlertPermission(): Promise<void> {
  return serial(async () => {
    await ensureNotificationChannels();
    if (!(await canAskNotificationPermission())) return;
    if (Platform.OS === 'android') await AsyncStorage.setItem(ANDROID_ASKED_KEY, new Date().toISOString());
    await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
  });
}

/**
 * Replaces the workout's pending alert with one at `endsAt`. Nothing is
 * scheduled without permission or for a rest under a second from its end.
 */
export function scheduleRestAlert({
  workoutId,
  endsAt,
  exerciseName,
}: {
  workoutId: string;
  endsAt: number;
  exerciseName: string | null;
}): Promise<void> {
  return serial(async () => {
    const id = identifier(workoutId);
    await Notifications.cancelScheduledNotificationAsync(id);
    if (endsAt - Date.now() <= 1000) return;
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return;
    await ensureNotificationChannels();
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: "Rest time's up",
        body: exerciseName ? `Next set of ${exerciseName}` : 'Time for your next set',
        sound: 'default',
        // iOS: breaks through Focus. Needs the time-sensitive entitlement
        // (app.json ios.entitlements); without it iOS delivers it as active.
        // Android ignores it; the rest channel sets how it alerts.
        interruptionLevel: 'timeSensitive',
        data: { kind: 'rest', workoutId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: endsAt, channelId: REST_CHANNEL_ID },
    });
  });
}

/** Cancels the workout's pending alert and dismisses a delivered one. */
export function cancelRestAlert(workoutId: string): Promise<void> {
  return serial(async () => {
    const id = identifier(workoutId);
    await Notifications.cancelScheduledNotificationAsync(id);
    await Notifications.dismissNotificationAsync(id);
  });
}

/**
 * Removes every delivered rest alert from Notification Center (the
 * notification shade on Android). At launch and on each return to the
 * foreground: once the app is open the alert has done its job, and the
 * workout screen (and the Live Activity on iOS) already shows the next set.
 */
export function dismissDeliveredRestAlerts(): Promise<void> {
  return serial(async () => {
    const delivered = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      delivered
        .filter((n) => n.request.identifier.startsWith(PREFIX))
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    );
  });
}

/** Every rest alert, pending or delivered, whatever the workout. For sign-out and Start fresh. */
export function cancelAllRestAlerts(): Promise<void> {
  return serial(async () => {
    const [scheduled, delivered] = await Promise.all([
      Notifications.getAllScheduledNotificationsAsync(),
      Notifications.getPresentedNotificationsAsync(),
    ]);
    await Promise.all([
      ...scheduled
        .filter((n) => n.identifier.startsWith(PREFIX))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
      ...delivered
        .filter((n) => n.request.identifier.startsWith(PREFIX))
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    ]);
  });
}

/**
 * How a notification shows while the app is open. A rest alert shows
 * nothing, since the workout screen buzzes itself; anything else shows as
 * a banner and in the list with its sound, never a badge. Set once, at the
 * app root.
 */
export function installNotificationHandler(): void {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const isRest = notification.request.content.data?.kind === 'rest';
        return {
          shouldShowBanner: !isRest,
          shouldShowList: !isRest,
          shouldPlaySound: !isRest,
          shouldSetBadge: false,
        };
      },
    });
  } catch {
    // Without the handler, foreground notifications are simply not shown.
  }
}
