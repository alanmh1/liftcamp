import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Android notification channels. Every local notification on Android 8+
 * posts to a channel, and the channel, not the notification, decides its
 * importance, sound and lock screen visibility. Android 13+ also shows the
 * notification permission prompt only once the app has a channel, so these
 * exist before any permission request or schedule.
 *
 * - `rest`: the rest-end alert (lib/rest-alert.ts). High importance, so it
 *   peeks over the screen, with the default sound and vibration, and shown
 *   in full on the lock screen.
 * - `reminders`: the nudges (lib/nudges.ts). Default importance and sound.
 *
 * A channel's importance and sound are fixed once created: the user owns
 * them after that, and setNotificationChannelAsync only updates the name
 * and description. Changing either here needs a new channel id.
 *
 * iOS has no channels; there this resolves at once.
 */

export const REST_CHANNEL_ID = 'rest';
export const REMINDERS_CHANNEL_ID = 'reminders';

let created: Promise<void> | null = null;

/**
 * Creates both channels, once per launch. Started at the app root; the
 * permission request and every schedule await it. Never rejects.
 */
export function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (!created) {
    created = Promise.all([
      Notifications.setNotificationChannelAsync(REST_CHANNEL_ID, {
        name: 'Rest timer',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      }),
      Notifications.setNotificationChannelAsync(REMINDERS_CHANNEL_ID, {
        name: 'Workout reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      }),
    ]).then(
      () => {},
      () => {
        // Retried by the next caller. Until then, schedules post to the
        // fallback channel expo-notifications makes on its own.
        created = null;
      },
    );
  }
  return created;
}
