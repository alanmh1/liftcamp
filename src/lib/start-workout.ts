import { supabase } from "@/integrations/supabase/client";
import { coldStartSuggestion } from "@/lib/suggestions";

// Shared workout bootstrapping: creates workout_exercises rows and seeds each
// with either the user's last performance or a cold-start suggestion.
export async function populateWorkoutExercises(
  userId: string,
  workoutId: string,
  exerciseIds: string[],
): Promise<void> {
  for (let i = 0; i < exerciseIds.length; i++) {
    const exerciseId = exerciseIds[i];
    const { data: weData, error: weErr } = await supabase
      .from("workout_exercises")
      .insert({
        workout_id: workoutId,
        exercise_id: exerciseId,
        user_id: userId,
        position: i,
      })
      .select("id")
      .single();
    if (weErr || !weData) {
      console.error(weErr);
      continue;
    }

    const { data: prior } = await supabase
      .from("workout_exercises")
      .select("id, created_at, sets(position, weight, weight_value, reps)")
      .eq("user_id", userId)
      .eq("exercise_id", exerciseId)
      .neq("id", weData.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const priorSets = (prior?.sets ?? []) as {
      position: number;
      weight: string;
      weight_value: number | null;
      reps: number | null;
    }[];

    if (priorSets.length > 0) {
      const sorted = [...priorSets].sort((a, b) => a.position - b.position);
      const mostRecent = sorted[sorted.length - 1];
      const rows = sorted.map((_, idx) => ({
        workout_exercise_id: weData.id,
        user_id: userId,
        position: idx,
        weight: mostRecent.weight ?? "",
        weight_value: mostRecent.weight_value ?? null,
        reps: mostRecent.reps ?? null,
      }));
      await supabase.from("sets").insert(rows);
    } else {
      const { data: exRow } = await supabase
        .from("exercises")
        .select("mechanic, level, equipment")
        .eq("id", exerciseId)
        .maybeSingle();
      const sugg = coldStartSuggestion(exRow ?? {});
      const rows = Array.from({ length: sugg.sets }, (_, idx) => ({
        workout_exercise_id: weData.id,
        user_id: userId,
        position: idx,
        weight: "",
        reps: sugg.reps,
      }));
      await supabase.from("sets").insert(rows);
    }
  }
}
