import * as Haptics from 'expo-haptics';

/**
 * Every haptic in the app, by name, so the patterns live in one place and
 * call sites say what the moment is rather than which generator to use.
 *
 * Every function swallows errors. A haptic that fails is nothing, never a
 * crash: on a build without the native module expo-haptics rejects with
 * UnavailabilityError, and on a device or setting with no haptics the
 * generator simply does nothing. iOS honours the system Sounds & Haptics
 * switch inside the generators, so there is no app setting.
 *
 * The call sites, exactly: set checked done (confirm), a set that becomes a
 * PR as it is checked (reward, in place of confirm), the rest timer
 * reaching zero (reward), Finish going ahead (emphasize), and the week
 * card's celebration (celebrate, then reward). Nothing else buzzes.
 */

function run(fn: () => Promise<void>): void {
  try {
    void fn().catch(() => {});
  } catch {
    // A synchronous throw is swallowed the same way.
  }
}

/** A routine confirmation. Light impact. */
export function confirm(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** A milestone. Notification success. */
export function reward(): void {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** A bigger single moment. Medium impact. */
export function emphasize(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** The week card's opener. Three light impacts, 80ms apart. */
export function celebrate(): void {
  confirm();
  setTimeout(confirm, 80);
  setTimeout(confirm, 160);
}
