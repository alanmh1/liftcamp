import { supabase } from "@/integrations/supabase/client";
import { EVENTS, track, trackWorkoutStartFailed } from "@/lib/analytics";
import { populateWorkoutExercises } from "@/lib/start-workout";
import type { TemplateRow } from "@liftcamp/shared";

export async function startWorkoutFromTemplate(
  userId: string,
  template: TemplateRow,
): Promise<string | null> {
  const { data: workout, error: wErr } = await supabase
    .from("workouts")
    .insert({ user_id: userId, name: template.name })
    .select("id")
    .single();
  if (wErr || !workout) {
    trackWorkoutStartFailed("template", wErr);
    console.error(wErr);
    return null;
  }

  void track(EVENTS.routineChosen, {
    template: template.name,
    is_system: !!template.is_system,
  });
  void track(EVENTS.workoutStarted, { source: "template" });

  const ordered = [...template.template_exercises].sort((a, b) => a.position - b.position);
  await populateWorkoutExercises(userId, workout.id, ordered.map((te) => te.exercise_id));
  return workout.id;
}

/**
 * Creates a template from an ordered list of exercise ids. Used by the history
 * card and the finish-workout dialog, so a session you liked becomes a routine
 * without rebuilding it in the picker.
 */
export async function createTemplateFromExercises(
  userId: string,
  name: string,
  exerciseIds: string[],
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed || exerciseIds.length === 0) return null;

  const { data: tpl, error: tplErr } = await supabase
    .from("templates")
    .insert({ user_id: userId, name: trimmed })
    .select("id")
    .single();
  if (tplErr || !tpl) {
    console.error(tplErr);
    return null;
  }

  const rows = exerciseIds.map((exercise_id, position) => ({
    template_id: tpl.id,
    exercise_id,
    user_id: userId,
    position,
  }));
  const { error: teErr } = await supabase.from("template_exercises").insert(rows);
  if (teErr) {
    console.error(teErr);
    // Leaving an empty template behind would show as "0 exercises" on the home
    // screen, so clean it up rather than half-succeed.
    await supabase.from("templates").delete().eq("id", tpl.id);
    return null;
  }

  return tpl.id as string;
}
