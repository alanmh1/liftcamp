import { supabase } from "@/integrations/supabase/client";
import {
  firstCompletedPriorSession,
  type PriorExerciseRow,
  type PriorSet,
} from "@liftcamp/shared";

/**
 * How many recent workouts to consider before giving up. A workout where the
 * exercise was added but never logged is skipped, so more than one may be
 * needed to find real history.
 */
const LOOKBACK_WORKOUTS = 10;

/**
 * The user's most recent other session of an exercise, as an ordered set list.
 *
 * "Most recent" is by the workout's own `workout_date`, so a backdated workout
 * sorts where the user put it rather than where it happened to be inserted.
 * `created_at` breaks ties for two workouts on the same day.
 *
 * Only completed sets count as history. Returns [] when the user has never
 * logged the exercise before.
 */
export async function getPriorSets(
  userId: string,
  exerciseId: string,
  excludeWorkoutExerciseId?: string | null,
): Promise<PriorSet[]> {
  let q = supabase
    .from("workouts")
    .select(
      "id, workout_date, created_at, workout_exercises!inner(id, created_at, exercise_id, sets(position, weight, weight_value, reps, completed))",
    )
    .eq("user_id", userId)
    .eq("workout_exercises.exercise_id", exerciseId);

  if (excludeWorkoutExerciseId) {
    q = q.neq("workout_exercises.id", excludeWorkoutExerciseId);
  }

  const { data, error } = await q
    .order("workout_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LOOKBACK_WORKOUTS);

  if (error) {
    console.error(error);
    return [];
  }
  if (!data) return [];

  const workouts = data.map(
    (w) => (w.workout_exercises ?? []) as unknown as PriorExerciseRow[],
  );
  return firstCompletedPriorSession(workouts);
}
