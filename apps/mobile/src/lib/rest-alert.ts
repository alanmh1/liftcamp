import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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
 * Every function swallows its own errors. A notification that fails to
 * schedule is a missed buzz, never a blocked set or a crash.
 *
 * Calls run one at a time, in the order they were made. A tap on +15
 * followed by Skip must not end with the +15's schedule landing after the
 * Skip's cancel.
 *
 * iOS only. Android has no notification channel for them, so asking and
 * scheduling do nothing there.
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
 * Asks for permission the first time only (alert and sound, no badge).
 * After a denial it never asks again; the alert is simply not scheduled.
 */
export function ensureRestAlertPermission(): Promise<void> {
  if (Platform.OS !== 'ios') return Promise.resolve();
  return serial(async () => {
    const current = await Notifications.getPermissionsAsync();
    if (current.status !== 'undetermined') return;
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
  if (Platform.OS !== 'ios') return Promise.resolve();
  return serial(async () => {
    const id = identifier(workoutId);
    await Notifications.cancelScheduledNotificationAsync(id);
    if (endsAt - Date.now() <= 1000) return;
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return;
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: "Rest time's up",
        body: exerciseName ? `Next set of ${exerciseName}` : 'Time for your next set',
        sound: 'default',
        // Breaks through Focus. Needs the time-sensitive entitlement (app.json
        // ios.entitlements); without it iOS delivers it as active.
        interruptionLevel: 'timeSensitive',
        data: { kind: 'rest', workoutId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: endsAt },
    });
  });
}

export function cancelRestAlert(workoutId: string): Promise<void> {
  return serial(() => Notifications.cancelScheduledNotificationAsync(identifier(workoutId)));
}

/** Every pending rest alert, whatever the workout. For sign-out and Start fresh. */
export function cancelAllRestAlerts(): Promise<void> {
  return serial(async () => {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(PREFIX))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
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
