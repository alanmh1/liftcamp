import AsyncStorage from '@react-native-async-storage/async-storage';
import { setupCompletedSeenKey } from '@liftcamp/shared';

/**
 * Whether a user has seen the setup checklist finished, for setupCardMode.
 *
 * On the device, per user (`liftcamp:setup-completed-seen:<userId>`): set
 * the first time Home shows the finished card, so the next launch hides
 * it. In memory, the users it has been shown to in this app session, so it
 * stays up until the app is closed.
 */

const shownThisSession = new Set<string>();

export async function readCompletionSeen(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(setupCompletedSeenKey(userId))) != null;
  } catch {
    // Unreadable reads as not seen: at worst the finished card shows once more.
    return false;
  }
}

export function completionShownThisSession(userId: string): boolean {
  return shownThisSession.has(userId);
}

/** The finished card is on screen: keep it this session, and hide it from the next launch. */
export function markCompletionShown(userId: string): void {
  shownThisSession.add(userId);
  AsyncStorage.setItem(setupCompletedSeenKey(userId), new Date().toISOString()).catch(() => {});
}
