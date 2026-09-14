import { supabase } from "@/integrations/supabase/client";
import { coldStartSuggestion, priorSetForPosition } from "@liftcamp/shared";
import { getPriorSets } from "@/lib/prior-session";

/** One exercise to seed. `targetSets` comes from a routine; others leave it out. */
export type SeedPlan = { exerciseId: string; targetSets?: number | null };

// Shared workout bootstrapping: creates workout_exercises rows and seeds each
// with either the user's last performance or a cold-start suggestion.
//
// Row count: a routine's target_sets when given, else the prior session's
// count, else the cold-start suggestion. Position N takes prior N, repeating
// the last prior set past its end, so what the user actually did still wins.
// Same rule as the mobile seed path.
export async function populateWorkoutExercises(
  userId: string,
  workoutId: string,
  plan: (string | SeedPlan)[],
): Promise<void> {
  const items = plan.map((p) => (typeof p === "string" ? { exerciseId: p } : p));
  for (let i = 0; i < items.length; i++) {
    const { exerciseId, targetSets } = items[i];
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
    const fromRoutine = targetSets != null && targetSets > 0;

    let count: number;
    let coldReps: number | null = null;
    if (fromRoutine) {
      count = targetSets;
    } else if (prior.length > 0) {
      count = prior.length;
    } else {
      const { data: exRow } = await supabase
        .from("exercises")
        .select("mechanic, level, equipment")
        .eq("id", exerciseId)
        .maybeSingle();
      const sugg = coldStartSuggestion(exRow ?? {});
      count = sugg.sets;
      coldReps = sugg.reps;
    }

    // Seed position for position so a ramp comes back as a ramp. A routine
    // with no prior leaves reps empty: the target is guidance, not a value.
    const rows = Array.from({ length: count }, (_, idx) => {
      const src = priorSetForPosition(prior, idx);
      return {
        workout_exercise_id: weData.id,
        user_id: userId,
        position: idx,
        weight_value: src?.weight_value ?? null,
        reps: src?.reps ?? coldReps,
      };
    });
    await supabase.from("sets").insert(rows);
  }
}
