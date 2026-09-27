import {
  exerciseRecords,
  hasStrengthLevel,
  recentPrsByExercise,
  setVolume,
  STRENGTH_EXERCISES,
  summarizeSession,
  trainingDaysByWeek,
  type ExerciseSession,
  type WeekDays,
  type WeightUnit,
} from '@liftcamp/shared';

import { getScanRows, markPrs, type ScanRow } from '@/data/history';
import { endOfWeek, getFinishedWorkoutCount, localDateIso, startOfWeek } from '@/data/home';
import { supabase } from '../../lib/supabase';

/**
 * Reads for the Profile tab. Same rules as the other data modules: screens
 * never import `supabase`, and this module only reads.
 *
 * Two kinds of read. The basics (workout count, first workout, the last 12
 * weeks of dates) are small and run on every focus. The stats (PRs, total
 * volume, strength levels) come from the account-wide PR scan, which the
 * session cache in scan-cache.ts holds until a set or workout write, a
 * bodyweight change or a pull to refresh; a unit change is a new key.
 */

export const PROFILE_WEEKS = 12;
export const RECENT_PR_LIMIT = 5;

export type ProfileBasics = {
  finishedCount: number;
  /** YYYY-MM-DD of the earliest finished workout. Null before the first. */
  firstWorkoutDate: string | null;
  /** Oldest first; the last entry is this week. */
  weeks: WeekDays[];
};

export async function getProfileBasics(userId: string): Promise<ProfileBasics> {
  const from = startOfWeek();
  from.setDate(from.getDate() - 7 * (PROFILE_WEEKS - 1));
  const [finishedCount, first, recent] = await Promise.all([
    getFinishedWorkoutCount(userId),
    supabase
      .from('workouts')
      .select('workout_date')
      .eq('user_id', userId)
      .not('finished_at', 'is', null)
      .order('workout_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    // Bounded on both ends like the week strip, so a workout dated into
    // next week does not count.
    supabase
      .from('workouts')
      .select('workout_date')
      .eq('user_id', userId)
      .not('finished_at', 'is', null)
      .gte('workout_date', localDateIso(from))
      .lte('workout_date', localDateIso(endOfWeek())),
  ]);
  const dates = (recent.data ?? []).map((r) => r.workout_date as string);
  return {
    finishedCount,
    firstWorkoutDate: (first.data?.workout_date as string | undefined) ?? null,
    weeks: trainingDaysByWeek(dates, PROFILE_WEEKS),
  };
}

export type RecentPr = {
  setId: string;
  exerciseId: string;
  exerciseName: string;
  weightType: string | null;
  weight: string | null;
  weight_value: number | null;
  reps: number | null;
  /** YYYY-MM-DD. */
  workoutDate: string;
};

export type LiftMax = {
  exerciseId: string;
  exerciseName: string;
  /** The Records estimated max, in the user's unit. */
  estimatedMax: number;
};

export type ProfileStats = {
  /** Every completed set in a finished workout, in the user's unit. */
  totalVolume: number;
  /** Each exercise's most recent PR set, newest first, at most RECENT_PR_LIMIT. */
  recentPrs: RecentPr[];
  /** One per logged strength-standard lift, in STRENGTH_EXERCISES order. */
  liftMaxes: LiftMax[];
};

/**
 * Pure, over a full scan. Only finished workouts count toward any of the
 * three, but PRs are marked over every workout first, exactly as the
 * ribbons are, so a PR listed here is one the user saw a ribbon for.
 *
 * The estimated max per lift is built the way the exercise screen builds
 * it: completed sets per finished workout, `summarizeSession`, then
 * `exerciseRecords`. So the level here and the level on that screen agree.
 */
export function profileStatsFromScan(rows: ScanRow[], bodyweight: number | null): ProfileStats {
  const { prSetIds } = markPrs(rows, bodyweight);
  let totalVolume = 0;
  const prs: (RecentPr & { createdAt: string; position: number })[] = [];
  const liftSets = new Map<string, Map<string, { date: string; sets: NonNullable<ScanRow['sets']> }>>();

  for (const row of rows) {
    const date = row.workouts?.workout_date;
    if (!row.workouts?.finished_at || !date) continue;
    const done = (row.sets ?? []).filter((s) => s.completed);
    for (const s of done) {
      totalVolume += setVolume(s, row.exercises, bodyweight);
      if (prSetIds.has(s.id) && row.exercises) {
        prs.push({
          setId: s.id,
          exerciseId: row.exercise_id,
          exerciseName: row.exercises.name,
          weightType: row.exercises.weight_type,
          weight: s.weight,
          weight_value: s.weight_value,
          reps: s.reps,
          workoutDate: date,
          createdAt: s.created_at ?? '',
          position: s.position,
        });
      }
    }
    if (hasStrengthLevel(row.exercise_id) && done.length > 0) {
      let byWorkout = liftSets.get(row.exercise_id);
      if (!byWorkout) liftSets.set(row.exercise_id, (byWorkout = new Map()));
      const session = byWorkout.get(row.workout_id) ?? { date, sets: [] };
      session.sets.push(...done);
      byWorkout.set(row.workout_id, session);
    }
  }

  const recentPrs = recentPrsByExercise(prs, RECENT_PR_LIMIT).map(({ createdAt: _c, position: _p, ...pr }) => pr);

  const names = new Map(rows.map((r) => [r.exercise_id, r.exercises]));
  const liftMaxes: LiftMax[] = [];
  for (const exerciseId of STRENGTH_EXERCISES) {
    const byWorkout = liftSets.get(exerciseId);
    const exercise = names.get(exerciseId);
    if (!byWorkout || !exercise) continue;
    const sessions: ExerciseSession[] = [...byWorkout].map(([workoutId, s]) => ({
      workoutId,
      workoutDate: s.date,
      summary: summarizeSession(
        [...s.sets].sort((a, b) => a.position - b.position),
        exercise,
        bodyweight,
      ),
    }));
    const max = exerciseRecords(sessions).estimatedMax;
    if (max) liftMaxes.push({ exerciseId, exerciseName: exercise.name, estimatedMax: max.value });
  }

  return { totalVolume, recentPrs, liftMaxes };
}

/**
 * The stats, derived from the session's cached PR scan (scan-cache.ts),
 * which History and the exercise screen share. Deriving is a pass over
 * rows already in memory, so only the scan itself is cached.
 *
 * Null when the scan was abandoned (past the PR scan's page cap) or
 * failed. A null is never cached, so the next focus tries again.
 */
export async function getProfileStats(
  userId: string,
  bodyweight: number | null,
  unit: WeightUnit,
  { force = false }: { force?: boolean } = {},
): Promise<ProfileStats | null> {
  const rows = await getScanRows(userId, unit, { force });
  return rows ? profileStatsFromScan(rows, bodyweight) : null;
}
