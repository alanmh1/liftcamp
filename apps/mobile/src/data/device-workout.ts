import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORAGE_PREFIX, type WeightUnit, type WriteOp } from '@liftcamp/shared';

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

/**
 * The exercises in a workout whose warm-up rows the user deleted, so those
 * warm-ups are not generated again when the workout reopens. The card has
 * nothing left on it to say so, and the server has no column for it, so it
 * lives here, beside the phone's copy, and goes with it.
 */
function removedWarmupsKey(workoutId: string): string {
  return `${APP_STORAGE_PREFIX}warmups-removed:${workoutId}`;
}

/** Empty when there are none, or when storage cannot be read. */
export async function readRemovedWarmups(workoutId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(removedWarmupsKey(workoutId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export async function saveRemovedWarmups(workoutId: string, exerciseIds: ReadonlySet<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(removedWarmupsKey(workoutId), JSON.stringify([...exerciseIds]));
  } catch {
    // The warm-up can come back on a reopen, which is harmless.
  }
}

export async function clearDeviceWorkout(workoutId: string): Promise<void> {
  try {
    await AsyncStorage.multiRemove([key(workoutId), removedWarmupsKey(workoutId)]);
  } catch {
    // A stale copy is ignored once its workout is finished or gone.
  }
}

/** Every copy on the phone for this user in this unit, newest first. */
export async function listDeviceWorkouts(userId: string, unit: WeightUnit): Promise<DeviceWorkout[]> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(DEVICE_WORKOUT_PREFIX));
    if (keys.length === 0) return [];
    const out: DeviceWorkout[] = [];
    for (const [, raw] of await AsyncStorage.multiGet(keys)) {
      if (!raw) continue;
      try {
        const copy = JSON.parse(raw) as DeviceWorkout;
        if (copy.userId === userId && copy.unit === unit && copy.workout?.id) out.push(copy);
      } catch {
        // One unreadable copy does not hide the others.
      }
    }
    return out.sort((a, b) => b.workout.createdAt.localeCompare(a.workout.createdAt));
  } catch {
    return [];
  }
}

/**
 * The phone's copies that are still in progress: started in the last 24
 * hours, not finished, and with no finish or discard waiting in `ops`, the
 * user's write queue. Newest first. Home's Resume (getDeviceOpenWorkout)
 * and the Live Activity's reconcile both decide "open" here.
 */
export function openDeviceWorkouts(copies: readonly DeviceWorkout[], ops: readonly WriteOp[], now = Date.now()): ActiveWorkout[] {
  const ended = new Set<string>();
  for (const op of ops) {
    if (op.table !== 'workouts') continue;
    if (op.kind === 'delete') ended.add(op.id);
    if (op.kind === 'update' && typeof op.patch.finished_at === 'string') ended.add(op.id);
  }
  const since = now - 24 * 60 * 60 * 1000;
  return copies
    .map((c) => c.workout)
    .filter((w) => !w.finishedAt && !ended.has(w.id) && Date.parse(w.createdAt) >= since)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
