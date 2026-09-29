import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORAGE_PREFIX, type WeightUnit } from '@liftcamp/shared';

import type { ActiveWorkout } from '@/data/workouts';

/**
 * The copy of a workout kept on the phone, so the workout screen opens at
 * once and works with no signal. Written when a workout starts, and by the
 * workout screen after every change. The write queue holds what still has
 * to reach the server; this holds what the screen draws.
 *
 * One key per workout, under the `liftcamp:` prefix, so account deletion
 * clears them. Removed once the server has the workout's finish or
 * discard (see write-queue.ts).
 */
export type DeviceWorkout = {
  userId: string;
  /** The unit the weights in `workout` are in. */
  unit: WeightUnit;
  /** Epoch ms. */
  savedAt: number;
  workout: ActiveWorkout;
};

export const DEVICE_WORKOUT_PREFIX = `${APP_STORAGE_PREFIX}workout:`;

function key(workoutId: string): string {
  return `${DEVICE_WORKOUT_PREFIX}${workoutId}`;
}

export async function saveDeviceWorkout(userId: string, unit: WeightUnit, workout: ActiveWorkout): Promise<void> {
  const copy: DeviceWorkout = { userId, unit, savedAt: Date.now(), workout };
  try {
    await AsyncStorage.setItem(key(workout.id), JSON.stringify(copy));
  } catch {
    // The queue still has every write; only the instant reopen is lost.
  }
}

/**
 * The phone's copy of a workout, when there is one for this user in this
 * unit. A copy in the other unit is left for the server read, which
 * converts every set.
 */
export async function readDeviceWorkout(
  userId: string,
  workoutId: string,
  unit: WeightUnit,
): Promise<ActiveWorkout | null> {
  try {
    const raw = await AsyncStorage.getItem(key(workoutId));
    if (!raw) return null;
    const copy = JSON.parse(raw) as DeviceWorkout;
    if (copy.userId !== userId || copy.unit !== unit || copy.workout?.id !== workoutId) return null;
    return copy.workout;
  } catch {
    return null;
  }
}

export async function clearDeviceWorkout(workoutId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(workoutId));
  } catch {
    // A stale copy is ignored once its workout is finished or gone.
  }
}
