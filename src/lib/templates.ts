import { supabase } from "@/integrations/supabase/client";
import { EVENTS, track } from "@/lib/analytics";
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
