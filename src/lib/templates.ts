import { supabase } from "@/integrations/supabase/client";
import { EVENTS, track, trackWorkoutStartFailed } from "@/lib/analytics";
import { populateWorkoutExercises } from "@/lib/start-workout";

export type TemplateRow = {
  id: string;
  name: string;
  is_system?: boolean;
  program?: string | null;
  program_blurb?: string | null;
  program_order?: number | null;
  hide_from_onboarding?: boolean | null;
  template_exercises: { exercise_id: string; position: number }[];
};

export type ProgramGroup = {
  program: string;
  blurb: string | null;
  order: number;
  templates: TemplateRow[];
};

/** Rolls flat template rows up into their program (Arnold Split, PPL, …) so a
 *  multi-day program reads as one thing with its days beneath it. */
export function groupPrograms(rows: TemplateRow[]): ProgramGroup[] {
  const map = new Map<string, ProgramGroup>();
  for (const t of rows) {
    const program = t.program?.trim() || "Other routines";
    let g = map.get(program);
    if (!g) {
      g = { program, blurb: t.program_blurb ?? null, order: t.program_order ?? 99, templates: [] };
      map.set(program, g);
    }
    if (!g.blurb && t.program_blurb) g.blurb = t.program_blurb;
    g.order = Math.min(g.order, t.program_order ?? 99);
    g.templates.push(t);
  }
  return [...map.values()]
    .map((g) => ({ ...g, templates: g.templates.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.order - b.order || a.program.localeCompare(b.program));
}

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
