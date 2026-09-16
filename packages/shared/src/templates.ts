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
  /** The exercise's equipment and primary muscle, when the select joins them; the routine art reads these. */
  exercises?: { equipment: string | null; primary_muscle: string | null } | null;
};

export type TemplateRow = {
  id: string;
  name: string;
  is_system?: boolean;
  program?: string | null;
  program_slug?: string | null;
  program_blurb?: string | null;
  /** Training order of this variation within its routine, from 1. Null sorts last. */
  position?: number | null;
  program_order?: number | null;
  hide_from_onboarding?: boolean | null;
  /** "beginner" | "intermediate" | "advanced" on system templates; null on user ones. */
  level?: string | null;
  days_per_week?: number | null;
  /** "gym" | "dumbbells" | "bodyweight" | "bands" on system templates. */
  equipment?: string | null;
  /** When the select includes it; the routine art walks templates in this order. */
  created_at?: string | null;
  template_exercises: TemplateExerciseRow[];
};

/** Title-cased level for display, or null when the template has none. */
/** "3 × 8-10"; "8-10" with no set count; "3 sets" with no reps; null when empty. */
export function formatSetTarget(target: { sets: number | null; reps: string | null } | null | undefined): string | null {
  if (!target) return null;
  const sets = target.sets != null && target.sets > 0 ? target.sets : null;
  const reps = target.reps?.trim() || null;
  if (sets != null && reps) return `${sets} × ${reps}`;
  if (reps) return reps;
  if (sets != null) return `${sets} set${sets === 1 ? "" : "s"}`;
  return null;
}

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

/** Variations in training order: `templates.position` first, null last, then
 *  name for rows without one. The one ordering for a routine's days. */
export function byVariationOrder(
  a: { position?: number | null; name: string },
  b: { position?: number | null; name: string },
): number {
  const pa = a.position ?? Number.MAX_SAFE_INTEGER;
  const pb = b.position ?? Number.MAX_SAFE_INTEGER;
  return pa - pb || a.name.localeCompare(b.name);
}

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
    .map((g) => ({ ...g, templates: g.templates.sort(byVariationOrder) }))
    .sort((a, b) => a.order - b.order || a.program.localeCompare(b.program));
}

// ---------------------------------------------------------------------------
// Matching programs to a user's level and equipment
// ---------------------------------------------------------------------------

/** `user_profiles.training_level` and `templates.level`. */
export const TRAINING_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type TrainingLevel = (typeof TRAINING_LEVELS)[number];

/** `user_profiles.equipment_access` and `templates.equipment`. */
export const EQUIPMENT_ACCESS = ["gym", "dumbbells", "bodyweight", "bands"] as const;
export type EquipmentAccess = (typeof EQUIPMENT_ACCESS)[number];

export const TRAINING_LEVEL_LABELS: Record<TrainingLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const EQUIPMENT_ACCESS_LABELS: Record<EquipmentAccess, string> = {
  gym: "Gym",
  dumbbells: "Dumbbells",
  bodyweight: "Bodyweight",
  bands: "Bands",
};

export function isTrainingLevel(v: string | null | undefined): v is TrainingLevel {
  return (TRAINING_LEVELS as readonly string[]).includes(v ?? "");
}

export function isEquipmentAccess(v: string | null | undefined): v is EquipmentAccess {
  return (EQUIPMENT_ACCESS as readonly string[]).includes(v ?? "");
}

export type ProgramMatch = {
  programs: ProgramGroup[];
  /** False when the level-and-equipment pair returned nothing and the list widened. */
  exact: boolean;
};

/**
 * The programs for a level and equipment pair, as program groups.
 *
 * Exact on both. Five of the twelve pairs return nothing (no intermediate
 * bodyweight or bands, no advanced dumbbells, bodyweight or bands), so an
 * empty exact match widens to the same level with any equipment, which every
 * level has; `exact` tells the screen to say so. Either answer missing means
 * no filter on that axis. `hide_from_onboarding` is not consulted here: it
 * kept the unfiltered list short, and a filtered list is short already.
 */
export function matchPrograms(
  rows: TemplateRow[],
  level: TrainingLevel | null,
  equipment: EquipmentAccess | null,
): ProgramMatch {
  const byLevel = level ? rows.filter((t) => t.level === level) : rows;
  const both = equipment ? byLevel.filter((t) => t.equipment === equipment) : byLevel;
  if (both.length > 0 || !equipment) return { programs: groupPrograms(both), exact: true };
  if (byLevel.length > 0) return { programs: groupPrograms(byLevel), exact: false };
  return { programs: groupPrograms(rows), exact: false };
}

/** "For beginners with dumbbells": the one line that says why these programs. */
export function matchHeading(level: TrainingLevel, equipment: EquipmentAccess | null): string {
  const who = { beginner: "beginners", intermediate: "intermediates", advanced: "advanced lifters" }[level];
  const kit = equipment
    ? { gym: "a full gym", dumbbells: "dumbbells", bodyweight: "no equipment", bands: "bands" }[equipment]
    : null;
  return kit ? `For ${who} with ${kit}` : `For ${who}`;
}
