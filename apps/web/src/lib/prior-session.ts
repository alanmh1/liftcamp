import { supabase } from "@/integrations/supabase/client";
import { numericWeight } from "@/lib/set-weight";
import type { PriorSet } from "@liftcamp/shared";

type PriorSetRow = {
  position: number;
  weight: string | null;
  weight_value: number | null;
  reps: number | null;
};

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

  // The exercise can appear more than once in one workout. Flatten every
  // matching workout_exercises row, then renumber, so the caller sees one
  // continuous list rather than two restarting at position 0.
  const rows = (data.workout_exercises ?? []) as unknown as {
    id: string;
    sets: PriorSetRow[] | null;
  }[];

  return rows
    .flatMap((we) => we.sets ?? [])
    .sort((a, b) => a.position - b.position)
    .map((s, i) => ({
      position: i,
      weight_value: numericWeight({ weight: s.weight, weight_value: s.weight_value }),
      reps: s.reps,
    }));
}
