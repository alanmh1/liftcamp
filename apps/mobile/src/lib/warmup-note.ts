import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORAGE_PREFIX } from '@liftcamp/shared';

/**
 * Whether the progression sheet has shown its warm-up line ("Warm-up sets
 * get you to the working weight safely...") to this user on this phone.
 * It shows the first time a sheet has generated warm-ups, then never
 * again. Under the app prefix, so Start fresh and account deletion clear it.
 */
function key(userId: string): string {
  return `${APP_STORAGE_PREFIX}warmup-note-seen:${userId}`;
}

/** True when seen, or when storage cannot be read, so it never nags. */
export async function warmupNoteSeen(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(userId))) === '1';
  } catch {
    return true;
  }
}

export async function markWarmupNoteSeen(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId), '1');
  } catch {
    // Shown again next time, which is harmless.
  }
}

/**
 * The tip on the card, the first time a generated warm-up row appears for
 * this user on this phone. Marked seen when it shows, so it is one time
 * whether or not it is dismissed. Same prefix, so the same clears apply.
 */
function tipKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}warmup-tip-seen:${userId}`;
}

/** True when seen, or when storage cannot be read, so it never nags. */
export async function warmupTipSeen(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(tipKey(userId))) === '1';
  } catch {
    return true;
  }
}

export async function markWarmupTipSeen(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(tipKey(userId), '1');
  } catch {
    // Shown again next time, which is harmless.
  }
}
