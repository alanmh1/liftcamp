/**
 * Routine templates as both apps read them from `templates` joined to
 * `template_exercises`. Grouping is pure; starting a workout from a template
 * is I/O and lives in each app's data layer.
 */
export type TemplateExerciseRow = {
  exercise_id: string;
  position: number;
  /** How many sets to seed. Null on user templates; callers fall back. */
  target_sets?: number | null;
  /**
   * Free text, shown as guidance and never parsed into a value: a range
   * ("8-10"), a number ("5"), time ("30s"), or per side ("8 each").
   */
  target_reps?: string | null;
};

export type TemplateRow = {
  id: string;
  name: string;
  is_system?: boolean;
  program?: string | null;
  program_blurb?: string | null;
  program_order?: number | null;
  hide_from_onboarding?: boolean | null;
  /** "beginner" | "intermediate" | "advanced" on system templates; null on user ones. */
  level?: string | null;
  days_per_week?: number | null;
  /** "gym" | "dumbbells" | "bodyweight" | "bands" on system templates. */
  equipment?: string | null;
  template_exercises: TemplateExerciseRow[];
};

/** Title-cased level for display, or null when the template has none. */
export function templateLevelLabel(level: string | null | undefined): string | null {
  if (!level) return null;
  const k = level.trim().toLowerCase();
  return k ? k.charAt(0).toUpperCase() + k.slice(1) : null;
}

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
