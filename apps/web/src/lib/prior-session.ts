import { supabase } from "@/integrations/supabase/client";
import { normalizePriorSets, type PriorSet, type PriorSetRow } from "@liftcamp/shared";

/**
 * The user's most recent other session of an exercise, as an ordered set list.
 *
 * "Most recent" is by the workout's own `workout_date`, so a backdated workout
 * sorts where the user put it rather than where it happened to be inserted.
 * `created_at` breaks ties for two workouts on the same day.
 *
 * Returns [] when the user has never logged the exercise before.
 */
export async function getPriorSets(
  userId: string,
  exerciseId: string,
  excludeWorkoutExerciseId?: string | null,
): Promise<PriorSet[]> {
  let q = supabase
    .from("workouts")
    .select(
      "id, workout_date, created_at, workout_exercises!inner(id, exercise_id, sets(position, weight, weight_value, reps))",
    )
    .eq("user_id", userId)
    .eq("workout_exercises.exercise_id", exerciseId);

  if (excludeWorkoutExerciseId) {
    q = q.neq("workout_exercises.id", excludeWorkoutExerciseId);
  }

  const { data, error } = await q
    .order("workout_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    return [];
  }
  if (!data) return [];

  const rows = (data.workout_exercises ?? []) as unknown as {
    id: string;
    sets: PriorSetRow[] | null;
  }[];

  return normalizePriorSets(rows);
}
