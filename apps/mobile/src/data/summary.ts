import { hasPendingFor, mergeHomePending, setVolume, type WeightUnit } from '@liftcamp/shared';

import { readDeviceWorkout } from '@/data/device-workout';
import type { WorkoutDetail } from '@/data/history';
import {
  DEFAULT_WEEKLY_TARGET,
  cachedUsername,
  endOfWeek,
  getLocalHomeState,
  localDateIso,
  readHomeCache,
  startOfWeek,
} from '@/data/home';
import { workoutPrSetIds, type ActiveWorkout } from '@/data/workouts';
import { pendingWrites } from '@/data/write-queue';

/** Everything the summary screen shows, from wherever it came. */
export type SummarySource = {
  detail: WorkoutDetail;
  prSetIds: Set<string> | null;
  count: number;
  target: number;
  weekDates: string[];
  name: string | null;
};

/** The parts of Home's cache the summary reads (see home.readHomeCache). */
type CachedHome = {
  profile?: { weeklyTarget: number };
  streakDates?: string[];
  finishedCount?: number;
};

/** A finished copy of a workout as the detail the summary draws. */
function detailFromCopy(w: ActiveWorkout, finishedAt: string): WorkoutDetail {
  let volume = 0;
  let completedSets = 0;
  const exercises = w.exercises.map((we) => ({
    id: we.id,
    position: we.position,
    exercise: we.exercise,
    sets: we.sets.map((s) => ({
      id: s.id,
      position: s.position,
      weight: null,
      weight_value: s.weight_value,
      reps: s.reps,
      completed: s.completed,
      note: s.note,
    })),
  }));
  for (const we of exercises) {
    for (const s of we.sets) {
      if (!s.completed) continue;
      completedSets += 1;
      volume += setVolume(s, we.exercise, w.bodyweight);
    }
  }
  return {
    id: w.id,
    name: w.name,
    workoutDate: localDateIso(new Date(w.createdAt)),
    createdAt: w.createdAt,
    finishedAt,
    notes: null,
    exercises,
    volume,
    completedSets,
    exerciseIds: exercises.map((we) => we.exercise.id),
  };
}

/**
 * The summary from the phone alone, for a workout finished here whose
 * writes have not all reached the server. Null when the server has them
 * all (its read is then the whole truth), or the phone has no finished
 * copy.
 *
 * Made with no request: the sets from the workout's copy, the PRs against
 * the baselines the workout screen already had, the workout count and the
 * week from Home's last full load with the phone's own finishes added, and
 * the username the phone last saw.
 */
export async function summaryFromPhone(
  userId: string,
  workoutId: string,
  unit: WeightUnit,
): Promise<SummarySource | null> {
  const pending = await pendingWrites(userId);
  if (!hasPendingFor(pending, workoutId)) return null;
  const copy = await readDeviceWorkout(userId, workoutId, unit);
  if (!copy?.finishedAt) return null;

  const [cached, phone, name] = await Promise.all([
    readHomeCache<CachedHome>(userId, unit),
    getLocalHomeState(userId, unit),
    cachedUsername(userId),
  ]);
  const home = mergeHomePending(cached ?? {}, phone);

  const prSetIds = new Set<string>();
  for (const we of copy.exercises) {
    for (const setId of workoutPrSetIds(we, copy.bodyweight)) prSetIds.add(setId);
  }

  const from = localDateIso(startOfWeek());
  const to = localDateIso(endOfWeek());
  const weekDates = [...new Set((home.streakDates ?? []).filter((d) => d >= from && d <= to))];

  return {
    detail: detailFromCopy(copy, copy.finishedAt),
    prSetIds,
    // With no full load on this phone yet, at least the finishes it made.
    count: Math.max(home.finishedCount ?? 0, phone.finished.length, 1),
    target: cached?.profile?.weeklyTarget ?? DEFAULT_WEEKLY_TARGET,
    weekDates,
    name,
  };
}
