import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  APP_STORAGE_PREFIX,
  currentSetFocus,
  formatLastLine,
  formatSetLine,
  priorSetForPosition,
  type WeightUnit,
} from '@liftcamp/shared';
import type { LiveActivity } from 'expo-widgets';
import { Platform } from 'react-native';

import { listDeviceWorkouts, openDeviceWorkouts } from '@/data/device-workout';
import { pendingWrites } from '@/data/write-queue';
import type { ActiveWorkout } from '@/data/workouts';
import type { RunningRest } from '@/lib/rest-store';
import { workoutActivity, type WorkoutActivityProps } from '@/widgets/workout-activity';

/**
 * The workout's Live Activity on the lock screen and in the Dynamic Island.
 * iOS only; every function is a no-op elsewhere. Local updates only, no
 * push: the workout screen syncs it after each change, and the rest
 * countdown runs on its own in SwiftUI.
 *
 * An activity does not carry its props back to JS, so which workout each
 * one belongs to is kept on the phone, one key per workout holding the
 * ActivityKit id (`liftcamp:activity:<workoutId>`). Under the app prefix,
 * so Start fresh and account deletion clear the keys; both also end every
 * activity first.
 *
 * Every function swallows its own errors. An activity that fails to start
 * or update is a stale lock screen, never a blocked set or a crash. Calls
 * run one at a time, in order, so an end can never land before an earlier
 * start for the same workout.
 */

type Activity = LiveActivity<WorkoutActivityProps>;

const ACTIVITY_PREFIX = `${APP_STORAGE_PREFIX}activity:`;
const IDLE_STALE_MS = 2 * 60 * 60 * 1000;

function key(workoutId: string): string {
  return `${ACTIVITY_PREFIX}${workoutId}`;
}

/** The props last sent per workout, so an unchanged sync sends nothing. */
const lastSent = new Map<string, string>();
/**
 * Workouts ended in this session. A sync still in flight from the workout
 * screen's debounce must not start a fresh activity after Finish or Discard.
 */
const ended = new Set<string>();

let chain: Promise<void> = Promise.resolve();

function serial(fn: () => Promise<void>): Promise<void> {
  if (Platform.OS !== 'ios' || !workoutActivity) return Promise.resolve();
  const next = chain.then(fn).catch(() => {});
  chain = next;
  return next;
}

function instances(): Activity[] {
  try {
    return workoutActivity?.getInstances() ?? [];
  } catch {
    return [];
  }
}

async function findActivity(workoutId: string): Promise<Activity | null> {
  const id = await AsyncStorage.getItem(key(workoutId));
  if (!id) return null;
  return instances().find((a) => a.getId() === id) ?? null;
}

/** What the activity shows for this workout and rest, formatted here. */
export function activityProps(workout: ActiveWorkout, rest: RunningRest | null, unit: WeightUnit): WorkoutActivityProps {
  const focus = currentSetFocus(workout, rest?.exerciseId);
  const restEndsAt = rest != null && rest.endsAt > Date.now() ? rest.endsAt : null;
  if (!focus) {
    return {
      workoutId: workout.id,
      exerciseName: workout.name ?? 'Workout',
      setIndex: 0,
      setCount: 0,
      setLine: null,
      lastLine: null,
      restEndsAt,
    };
  }
  const we = focus.exercise;
  const index = Math.max(0, focus.setIndex - 1);
  return {
    workoutId: workout.id,
    exerciseName: we.exercise.name,
    setIndex: focus.setIndex,
    setCount: focus.setCount,
    setLine: focus.set ? formatSetLine(focus.set, priorSetForPosition(we.prior, index), unit, we.exercise) : null,
    lastLine: formatLastLine(we.prior, index, unit),
    restEndsAt,
  };
}

/**
 * Starts the workout's activity, or updates it when what it shows has
 * changed. Stale at the rest's end during a rest, so the countdown's place
 * turns to "Rest's up" without the app; otherwise two hours out, for a
 * workout left open and forgotten.
 */
export function syncWorkoutActivity(workout: ActiveWorkout, rest: RunningRest | null, unit: WeightUnit): Promise<void> {
  return serial(async () => {
    if (workout.finishedAt || ended.has(workout.id) || !workoutActivity) return;
    const props = activityProps(workout, rest, unit);
    const json = JSON.stringify(props);
    const staleDate = new Date(props.restEndsAt ?? Date.now() + IDLE_STALE_MS);
    const activity = await findActivity(workout.id);
    if (!activity) {
      const started = workoutActivity.start(props, `liftcamp://workout/${workout.id}`, staleDate);
      lastSent.set(workout.id, json);
      await AsyncStorage.setItem(key(workout.id), started.getId());
      return;
    }
    if (lastSent.get(workout.id) === json) return;
    await activity.update(props, staleDate);
    lastSent.set(workout.id, json);
  });
}

async function end(activity: Activity): Promise<void> {
  try {
    await activity.end('immediate');
  } catch {
    // Already ended, or ActivityKit refused; either way it is gone or going.
  }
}

/** Ends the workout's activity at once. On Finish and Discard. */
export function endWorkoutActivity(workoutId: string): Promise<void> {
  ended.add(workoutId);
  lastSent.delete(workoutId);
  return serial(async () => {
    const activity = await findActivity(workoutId);
    if (activity) await end(activity);
    await AsyncStorage.removeItem(key(workoutId));
  });
}

/** Ends every workout activity. On sign-out, account deletion and Start fresh. */
export function endAllActivities(): Promise<void> {
  lastSent.clear();
  return serial(async () => {
    await Promise.all(instances().map(end));
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(ACTIVITY_PREFIX));
    if (keys.length > 0) await AsyncStorage.multiRemove(keys);
  });
}

/**
 * Ends any activity whose workout is no longer open on this phone: no
 * copy, finished, with a finish or discard queued, or started more than 24
 * hours ago (the rule Home's Resume uses, openDeviceWorkouts). An activity
 * with no workout on record is ended too. With no user, every activity
 * ends. At launch and on each return to the foreground.
 */
export function reconcileActivities(userId: string | null): Promise<void> {
  if (!userId) return endAllActivities();
  return serial(async () => {
    const running = instances();
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(ACTIVITY_PREFIX));
    if (running.length === 0 && keys.length === 0) return;
    const [ops, kg, lb, pairs] = await Promise.all([
      pendingWrites(userId),
      listDeviceWorkouts(userId, 'kg'),
      listDeviceWorkouts(userId, 'lb'),
      AsyncStorage.multiGet(keys),
    ]);
    const open = new Set(openDeviceWorkouts([...kg, ...lb], ops).map((w) => w.id));
    const workoutFor = new Map<string, string>();
    const stale: string[] = [];
    for (const [k, activityId] of pairs) {
      const workoutId = k.slice(ACTIVITY_PREFIX.length);
      if (activityId && open.has(workoutId)) workoutFor.set(activityId, workoutId);
      else stale.push(k);
    }
    const runningIds = new Set(running.map((a) => a.getId()));
    for (const [activityId, workoutId] of workoutFor) {
      // Dismissed from the lock screen: forget it; the next sync starts one.
      if (!runningIds.has(activityId)) {
        stale.push(key(workoutId));
        lastSent.delete(workoutId);
      }
    }
    await Promise.all(running.filter((a) => !workoutFor.has(a.getId())).map(end));
    if (stale.length > 0) await AsyncStorage.multiRemove(stale);
  });
}
