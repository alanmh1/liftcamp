import {
  cardioSeconds,
  countedTotals,
  topWeightsByExercise,
  toUserUnit,
  type RoutineLastDone,
  type WeightUnit,
} from '@liftcamp/shared';

import { deletedWorkoutIds, idList } from '@/data/write-queue';
import { supabase } from '../../lib/supabase';

/**
 * Reads for the routine detail screen. Same rules as history.ts: screens
 * never import `supabase`, and every set passes through `toUserUnit`
 * before any volume or weight math.
 */

type LastRow = {
  id: string;
  workout_date: string;
  created_at: string;
  finished_at: string | null;
  workout_exercises:
    | {
        exercises: {
          id: string;
          equipment: string | null;
          weight_type: string | null;
          is_unilateral: boolean | null;
          set_type: string | null;
        } | null;
        sets:
          | {
              weight: string | null;
              weight_value: number | null;
              weight_unit: string;
              reps: number | null;
              duration_seconds: number | null;
              completed: boolean;
              set_type: string | null;
            }[]
          | null;
      }[]
    | null;
};

/**
 * The latest finished workout started from this routine day
 * (`workouts.template_id`, on the (user_id, template_id) index), with its
 * volume and each exercise's top weight. Null when there is none, when
 * the read fails, or when the only one is deleted on the phone and the
 * delete has not synced.
 */
export async function getRoutineLastDone(
  userId: string,
  templateId: string,
  unit: WeightUnit,
  bodyweightIn: number | null | Promise<number | null>,
): Promise<RoutineLastDone | null> {
  const deleted = await deletedWorkoutIds(userId);
  let q = supabase
    .from('workouts')
    .select(
      `id, workout_date, created_at, finished_at,
       workout_exercises(exercises(id, equipment, weight_type, is_unilateral, set_type),
         sets(weight, weight_value, weight_unit, reps, duration_seconds, completed, set_type))`,
    )
    .eq('user_id', userId)
    .eq('template_id', templateId)
    .not('finished_at', 'is', null);
  if (deleted.length > 0) q = q.not('id', 'in', idList(deleted));
  const { data, error } = await q.order('finished_at', { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as LastRow;
  if (!row.finished_at) return null;

  const exercises = (row.workout_exercises ?? []).map((we) => ({
    exercise: we.exercises,
    sets: (we.sets ?? []).map((s) => toUserUnit(s, unit)),
  }));
  const bodyweight = await bodyweightIn;
  const { volume } = countedTotals(exercises, bodyweight);
  return {
    workoutId: row.id,
    workoutDate: row.workout_date,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    volume,
    cardioSeconds: cardioSeconds(exercises),
    topWeights: topWeightsByExercise(exercises),
  };
}
