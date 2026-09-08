import { supabase } from "@/integrations/supabase/client";
import { coldStartSuggestion, priorSetForPosition } from "@liftcamp/shared";
import { getPriorSets } from "@/lib/prior-session";

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

    const prior = await getPriorSets(userId, exerciseId, weData.id);

    if (prior.length > 0) {
      // Seed position for position so a ramp comes back as a ramp.
      const rows = prior.map((_, idx) => {
        const src = priorSetForPosition(prior, idx);
        return {
          workout_exercise_id: weData.id,
          user_id: userId,
          position: idx,
          weight_value: src?.weight_value ?? null,
          reps: src?.reps ?? null,
        };
      });
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
        reps: sugg.reps,
      }));
      await supabase.from("sets").insert(rows);
    }
  }
}
