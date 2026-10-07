import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  APP_STORAGE_PREFIX,
  currentSetFocus,
  formatLastLine,
  formatSetLine,
  lastLineRepeats,
  priorSetForPosition,
  upNextFocus,
  type WeightUnit,
} from '@liftcamp/shared';
import type { LiveActivity } from 'expo-widgets';
import { Platform } from 'react-native';

import { listDeviceWorkouts, openDeviceWorkouts } from '@/data/device-workout';
import { placeholderAt } from '@/data/placeholders';
import { pendingWrites } from '@/data/write-queue';
import type { ActiveWorkout } from '@/data/workouts';
import { islandIconUri } from '@/lib/island-icon';
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
 * The key also records that the workout has had its activity. A workout
 * with a key and no running activity was dismissed from the lock screen
 * (or ended by iOS), and stays without one. Only one activity runs at a
 * time: a sync ends any other workout's activity before its own.
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

/** Every workout with a key, mapped to its ActivityKit id. */
async function recordedActivities(): Promise<Map<string, string>> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(ACTIVITY_PREFIX));
  const out = new Map<string, string>();
  if (keys.length === 0) return out;
  for (const [k, activityId] of await AsyncStorage.multiGet(keys)) {
    if (activityId) out.set(k.slice(ACTIVITY_PREFIX.length), activityId);
  }
  return out;
}

/**
 * What the activity shows for this workout and rest, formatted here.
 *
 * During a rest it shows the set coming up (upNextFocus), with exactly the
 * values its row's gray boxes show on the card (placeholderAt, the card's
 * own placeholdersFor and progressionFor, so a Pro user's progression
 * target included). The banner labels it "UP NEXT" (`upNext`). A value
 * typed into the row wins, as it does on the card. With nothing left to
 * do it shows the set the workout is on, as between rests.
 *
 * `progressionOpen` is the screen's useProgressionGate.
 */
export function activityProps(
  workout: ActiveWorkout,
  rest: RunningRest | null,
  unit: WeightUnit,
  progressionOpen: boolean,
): WorkoutActivityProps {
  const restEndsAt = rest != null && rest.endsAt > Date.now() ? rest.endsAt : null;
  const restStartsAt = rest != null && restEndsAt != null ? Math.min(restEndsAt - rest.total * 1000, Date.now()) : null;
  const upNext = restEndsAt != null ? upNextFocus(workout, rest?.exerciseId) : null;
  if (upNext && upNext.set) {
    const we = upNext.exercise;
    const index = upNext.setIndex - 1;
    const gray = placeholderAt(we, index, unit, progressionOpen);
    const shown = formatSetLine(
      upNext.set,
      { weight_value: gray?.weight?.value ?? null, reps: gray?.reps ?? null },
      unit,
      we.exercise,
    );
    return {
      workoutId: workout.id,
      exerciseName: we.exercise.name,
      setIndex: upNext.setIndex,
      setCount: upNext.setCount,
      setLine: shown,
      upNext: true,
      lastLine: formatLastLine(we.prior, index, unit, we.exercise),
      lastLineRepeats: lastLineRepeats(upNext.set, we.prior, index, unit, we.exercise),
      restEndsAt,
      restStartsAt,
    };
  }
  const focus = currentSetFocus(workout, rest?.exerciseId);
  if (!focus) {
    return {
      workoutId: workout.id,
      exerciseName: workout.name ?? 'Workout',
      setIndex: 0,
      setCount: 0,
      setLine: null,
      upNext: false,
      lastLine: null,
      lastLineRepeats: false,
      restEndsAt,
      restStartsAt,
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
    upNext: false,
    lastLine: formatLastLine(we.prior, index, unit, we.exercise),
    lastLineRepeats: lastLineRepeats(focus.set, we.prior, index, unit, we.exercise),
    restEndsAt,
    restStartsAt,
  };
}

/**
 * Starts the workout's activity, or updates it when what it shows has
 * changed. Any other workout's activity is ended first, and its key
 * cleared, so going back to that workout later starts it afresh. A workout
 * whose activity was dismissed (a key, no running activity) gets no new
 * one. Stale at the rest's end during a rest, so the countdown's place
 * turns to "Rest time's up" without the app; otherwise two hours out, for a
 * workout left open and forgotten.
 */
export function syncWorkoutActivity(
  workout: ActiveWorkout,
  rest: RunningRest | null,
  unit: WeightUnit,
  progressionOpen: boolean,
): Promise<void> {
  return serial(async () => {
    if (workout.finishedAt || ended.has(workout.id) || !workoutActivity) return;
    const recorded = await recordedActivities();
    const mine = recorded.get(workout.id) ?? null;
    const running = instances();
    const others = running.filter((a) => a.getId() !== mine);
    if (others.length > 0) {
      await Promise.all(others.map(end));
      const otherIds = new Set(others.map((a) => a.getId()));
      const otherWorkouts = [...recorded].filter(([, activityId]) => otherIds.has(activityId)).map(([id]) => id);
      for (const id of otherWorkouts) lastSent.delete(id);
      if (otherWorkouts.length > 0) await AsyncStorage.multiRemove(otherWorkouts.map(key));
    }
    const activity = mine != null ? (running.find((a) => a.getId() === mine) ?? null) : null;
    // Dismissed from the lock screen, or ended by iOS: stays dismissed.
    if (!activity && mine != null) return;
    const props = { ...activityProps(workout, rest, unit, progressionOpen), iconUri: await islandIconUri() };
    const json = JSON.stringify(props);
    const staleDate = new Date(props.restEndsAt ?? Date.now() + IDLE_STALE_MS);
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
 * hours ago (the rule Home's Resume uses, openDeviceWorkouts), and clears
 * that workout's key. An activity with no workout on record is ended too.
 * An open workout keeps its key with or without a running activity, so a
 * dismissed one stays dismissed. With no user, every activity ends. At
 * launch and on each return to the foreground.
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
      if (activityId && open.has(workoutId)) {
        workoutFor.set(activityId, workoutId);
      } else {
        stale.push(k);
        lastSent.delete(workoutId);
      }
    }
    await Promise.all(running.filter((a) => !workoutFor.has(a.getId())).map(end));
    if (stale.length > 0) await AsyncStorage.multiRemove(stale);
  });
}
