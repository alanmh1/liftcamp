import {
  cardioSeconds,
  hasPendingFor,
  mergeHomePending,
  nextTimeLabel,
  pendingWorkoutNotes,
  setVolume,
  suggestProgression,
  type HistorySession,
  type WeightUnit,
} from '@liftcamp/shared';

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
import {
  getPriorSets,
  getWorkoutTargets,
  workoutPrSetIds,
  type ActiveWorkout,
  type SetTarget,
} from '@/data/workouts';
import { pendingWrites } from '@/data/write-queue';

/** Everything the summary screen shows, from wherever it came. */
export type SummarySource = {
  detail: WorkoutDetail;
  prSetIds: Set<string> | null;
  count: number;
  target: number;
  weekDates: string[];
  /** Every finished workout date, this one included, for the medal it earned (workoutMedal). */
  streakDates: string[];
  name: string | null;
};

/** The parts of Home's cache the summary reads (see home.readHomeCache). */
type CachedHome = {
  profile?: { weeklyTarget: number };
  streakDates?: string[];
  finishedCount?: number;
};

/** A finished copy of a workout as the detail the summary draws. */
function detailFromCopy(w: ActiveWorkout, finishedAt: string, notes: string | null): WorkoutDetail {
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
      duration_seconds: s.duration_seconds ?? null,
      distance_meters: s.distance_meters ?? null,
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
    notes,
    exercises,
    volume,
    cardioSeconds: cardioSeconds(exercises),
    completedSets,
    exerciseIds: exercises.map((we) => we.exercise.id),
    templateId: w.templateId ?? null,
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
  const queuedNotes = pendingWorkoutNotes(pending, workoutId);

  const prSetIds = new Set<string>();
  for (const we of copy.exercises) {
    for (const setId of workoutPrSetIds(we, copy.bodyweight)) prSetIds.add(setId);
  }

  const from = localDateIso(startOfWeek());
  const to = localDateIso(endOfWeek());
  const weekDates = [...new Set((home.streakDates ?? []).filter((d) => d >= from && d <= to))];

  return {
    // A note typed on the summary after the finish is in the queue, not the copy.
    detail: detailFromCopy(copy, copy.finishedAt, queuedNotes !== undefined ? queuedNotes : (copy.notes ?? null)),
    prSetIds,
    // With no full load on this phone yet, at least the finishes it made.
    count: Math.max(home.finishedCount ?? 0, phone.finished.length, 1),
    target: cached?.profile?.weeklyTarget ?? DEFAULT_WEEKLY_TARGET,
    weekDates,
    streakDates: home.streakDates ?? [],
    name,
  };
}

/** One exercise in the summary's "Next time" block. */
export type NextTimeRow = {
  exerciseId: string;
  name: string;
  /** "75 × 8", weight left and reps right. */
  label: string;
  reason: string;
};

/**
 * Pro progression for each exercise of a finished workout: what to aim for
 * next time. The caller checks `useProgressionGate` first; nothing here is
 * gated, so a free user's summary must never call it.
 *
 * The session just finished goes first, then the history. Both come from
 * the phone's copy of the workout when it has them, which is how an
 * unsynced finish gets the block with no signal. Otherwise each
 * exercise's history is one `getPriorSets` read, all at once, with this
 * workout dropped from the result so it is never counted twice.
 *
 * Exercises with nothing to suggest (unsupported, nothing logged) are left
 * out.
 */
export async function getNextTime(
  userId: string,
  detail: WorkoutDetail,
  unit: WeightUnit,
): Promise<NextTimeRow[]> {
  const copy = await readDeviceWorkout(userId, detail.id, unit);

  // An exercise done twice in the workout is one session: its rows in
  // position order, completed sets only.
  const byExercise = new Map<
    string,
    { exercise: WorkoutDetail['exercises'][number]['exercise']; sets: HistorySession['sets']; planned: number }
  >();
  for (const we of detail.exercises) {
    const entry = byExercise.get(we.exercise.id) ?? { exercise: we.exercise, sets: [], planned: 0 };
    for (const s of we.sets) {
      if (s.completed) entry.sets.push({ weight_value: s.weight_value, weight_unit: unit, reps: s.reps });
    }
    // Rows left unticked make this a partial session (see getPriorSets).
    if (we.sets.some((s) => s.completed)) entry.planned += we.sets.length;
    byExercise.set(we.exercise.id, entry);
  }

  const fromCopy = (exerciseId: string) => copy?.exercises.find((we) => we.exercise.id === exerciseId);
  const needsRead = [...byExercise.keys()].some((id) => fromCopy(id)?.history == null);
  const targets: Map<string, SetTarget> | null = needsRead ? await getWorkoutTargets(userId, detail.id) : null;

  const rows = await Promise.all(
    [...byExercise.entries()].map(async ([exerciseId, { exercise, sets, planned }]): Promise<NextTimeRow | null> => {
      const local = fromCopy(exerciseId);
      const history = local?.history ?? (await getPriorSets(userId, exerciseId, unit, detail.id)).history;
      const progression = suggestProgression({
        exercise,
        history: [
          { workoutId: detail.id, date: detail.workoutDate, sets, plannedSets: planned },
          ...history.filter((h) => h.workoutId !== detail.id),
        ],
        unit,
        target: local?.target ?? targets?.get(exerciseId) ?? null,
        setCount: 0,
        today: localDateIso(),
      });
      if (progression.outcome === 'unsupported' || progression.outcome === 'first-session') return null;
      const label = nextTimeLabel(progression, exercise, unit);
      return label ? { exerciseId, name: exercise.name, label, reason: progression.reason } : null;
    }),
  );
  return rows.filter((r): r is NextTimeRow => r != null);
}
