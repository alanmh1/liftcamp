import { localDateFromIso } from "./birthday";
import { proseCount, proseNumber } from "./copy-numbers";
import { canonMuscle, muscleLabel } from "./muscle-vocab";

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
  /**
   * The exercise's equipment and primary muscle, when the select joins them;
   * the routine art reads these. The name, when joined, lists the exercises
   * on Home's saved routine rows.
   */
  exercises?: { equipment: string | null; primary_muscle: string | null; name?: string | null } | null;
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
  /** A user routine Up next goes through. Missing on an old Home cache: counts as on. */
  in_rotation?: boolean | null;
  /** Its place in the rotation, from 0. Set by the insert trigger, changed by set_rotation_order. */
  rotation_position?: number | null;
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

/**
 * The routine a saved day belongs to: its `program`, or, for a day saved
 * before copies carried one, the part of its name before " · " ("Bro
 * Split · Shoulders & Traps" is Bro Split). Null for a routine of its own.
 */
export function routineProgram(t: { program?: string | null; name: string }): string | null {
  const program = t.program?.trim();
  if (program) return program;
  const at = t.name.indexOf(" · ");
  if (at <= 0) return null;
  const prefix = t.name.slice(0, at).trim();
  return prefix && t.name.slice(at + 3).trim() ? prefix : null;
}

/**
 * "Done today", "Done yesterday", "Done 3 days ago", "Done 2 weeks ago", by
 * calendar days in local time from the workout's date (YYYY-MM-DD) to
 * `today`: a workout this afternoon is today, whatever the hour.
 */
export function lastDoneLabel(date: string | null, today: Date = new Date()): string {
  const done = localDateFromIso(date);
  if (!done) return "Not done yet";
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // Rounded, so a daylight saving change inside the gap cannot shift a day.
  const days = Math.round((midnight.getTime() - done.getTime()) / 86_400_000);
  if (days <= 0) return "Done today";
  if (days === 1) return "Done yesterday";
  if (days < 7) return `Done ${proseCount(days, "day")} ago`;
  return `Done ${proseCount(Math.round(days / 7), "week")} ago`;
}

/**
 * The muscles a routine day trains most, "Chest, Shoulders, Triceps": the
 * primary muscles of its exercises by how many exercises hit each, ties in
 * exercise order, at most `limit`. Empty when the select did not join the
 * exercises.
 */
export function routineMuscleSummary(
  template: { template_exercises: TemplateExerciseRow[] },
  limit = 3,
): string {
  const counts = new Map<string, { n: number; first: number }>();
  const ordered = [...template.template_exercises].sort((a, b) => a.position - b.position);
  ordered.forEach((te, i) => {
    const m = canonMuscle(te.exercises?.primary_muscle);
    if (!m) return;
    const c = counts.get(m);
    if (c) c.n += 1;
    else counts.set(m, { n: 1, first: i });
  });
  return [...counts.entries()]
    .sort(([, a], [, b]) => b.n - a.n || a.first - b.first)
    .slice(0, limit)
    .map(([m]) => muscleLabel(m))
    .join(", ");
}

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

/** One line under each level in onboarding, so the choice is not a guess. */
export const TRAINING_LEVEL_HINTS: Record<TrainingLevel, string> = {
  beginner: "New, or under 6 months",
  intermediate: "Training steadily for 6+ months",
  advanced: "Years of structured training",
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
  /**
   * When the list widened to a lower level with the same equipment, that
   * level. Null when it is exact or widened to any equipment.
   */
  fallbackLevel?: TrainingLevel | null;
};

/**
 * The programs for a level and equipment pair, as program groups.
 *
 * Exact on both. One of the twelve pairs returns nothing as of October
 * 2026 (advanced bands), so an empty exact match
 * widens first to the nearest lower level with the same equipment, since
 * someone with only bodyweight cannot run a barbell routine at any level,
 * then to the same level with any equipment, which every level has.
 * `exact` and `fallbackLevel` tell the screen which (see `matchHeading`).
 * Either answer missing means no filter on that axis.
 * `hide_from_onboarding` is not consulted here: it kept the unfiltered
 * list short, and a filtered list is short already.
 */
export function matchPrograms(
  rows: TemplateRow[],
  level: TrainingLevel | null,
  equipment: EquipmentAccess | null,
): ProgramMatch {
  const byLevel = level ? rows.filter((t) => t.level === level) : rows;
  const both = equipment ? byLevel.filter((t) => t.equipment === equipment) : byLevel;
  if (both.length > 0 || !equipment) return { programs: groupPrograms(both), exact: true, fallbackLevel: null };
  if (level) {
    for (let i = TRAINING_LEVELS.indexOf(level) - 1; i >= 0; i--) {
      const lower = TRAINING_LEVELS[i]!;
      const same = rows.filter((t) => t.level === lower && t.equipment === equipment);
      if (same.length > 0) return { programs: groupPrograms(same), exact: false, fallbackLevel: lower };
    }
  }
  if (byLevel.length > 0) return { programs: groupPrograms(byLevel), exact: false, fallbackLevel: null };
  return { programs: groupPrograms(rows), exact: false, fallbackLevel: null };
}

/** How many routines onboarding shows before See all. */
export const ROUTINE_SHORTLIST = 3;

/**
 * Every program, best fit first, for the three onboarding answers. Ranked
 * on, in order:
 *   1. level: exact first, then the nearest (intermediate is nearer to
 *      beginner than advanced is), and of two levels equally near, the
 *      lower, since an easier routine is the safer guess;
 *   2. equipment: a match first;
 *   3. days a week: nearest to the answer first;
 *   4. the catalog's own order.
 * With bodyweight, dumbbells or bands, equipment ranks before level: a
 * lifter without a gym cannot run a barbell routine at any level, so an
 * advanced lifter with only bodyweight gets a bodyweight routine of a
 * lower level before any advanced gym one. An intermediate with only
 * bodyweight gets Calisthenics Full Body, then the beginner bodyweight
 * routines, then the advanced Bodyweight Push / Pull / Legs.
 * A missing answer does not rank on its axis. No level at all ranks as a
 * beginner and leaves out programs flagged `hide_from_onboarding`, the
 * same default as the unanswered starter list. The first program is the
 * one onboarding marks Recommended.
 */
export function rankPrograms(
  rows: TemplateRow[],
  answers: { level: TrainingLevel | null; equipment: EquipmentAccess | null; days: number | null },
  /** Keep `hide_from_onboarding` programs with no level: an experienced lifter's list, which is every routine. */
  options: { keepHidden?: boolean } = {},
): ProgramGroup[] {
  const level = answers.level ?? "beginner";
  const pool = answers.level || options.keepHidden ? rows : rows.filter((t) => !t.hide_from_onboarding);
  const rank = (lv: string | null | undefined) => (isTrainingLevel(lv) ? TRAINING_LEVELS.indexOf(lv) : null);
  const want = TRAINING_LEVELS.indexOf(level);

  const scored = groupPrograms(pool).map((group) => {
    const first = group.templates[0];
    const lv = rank(first?.level);
    const days = first?.days_per_week ?? null;
    return {
      group,
      levelGap: lv == null ? TRAINING_LEVELS.length : Math.abs(lv - want),
      // Breaks a tie in levelGap: beginner before advanced for an intermediate.
      levelRank: lv ?? TRAINING_LEVELS.length,
      equipmentMiss: answers.equipment && first?.equipment !== answers.equipment ? 1 : 0,
      daysGap: answers.days == null ? 0 : days == null ? Number.MAX_SAFE_INTEGER : Math.abs(days - answers.days),
    };
  });
  const equipmentFirst = answers.equipment != null && answers.equipment !== "gym";
  const byLevel = (a: (typeof scored)[number], b: (typeof scored)[number]) =>
    a.levelGap - b.levelGap || a.levelRank - b.levelRank;
  scored.sort(
    (a, b) =>
      (equipmentFirst
        ? a.equipmentMiss - b.equipmentMiss || byLevel(a, b)
        : byLevel(a, b) || a.equipmentMiss - b.equipmentMiss) ||
      a.daysGap - b.daysGap ||
      a.group.order - b.group.order,
  );
  return scored.map((s) => s.group);
}

/** Whether a program matches the level and equipment answers exactly. */
export function programMatches(
  group: ProgramGroup | undefined,
  answers: { level: TrainingLevel | null; equipment: EquipmentAccess | null },
): boolean {
  const first = group?.templates[0];
  if (!first) return false;
  return (!answers.level || first.level === answers.level) && (!answers.equipment || first.equipment === answers.equipment);
}

/**
 * "For beginners with dumbbells": the one line that says why these
 * programs. Given a match that widened, it says so: "Nothing matches
 * exactly. For intermediates with no equipment" when it fell back to a
 * lower level with the same equipment, "Nothing matches exactly. For
 * advanced lifters, any equipment" when it fell back to any equipment.
 * No trailing period.
 */
export function matchHeading(
  level: TrainingLevel,
  equipment: EquipmentAccess | null,
  match?: Pick<ProgramMatch, "exact" | "fallbackLevel">,
): string {
  if (match && !match.exact) {
    return match.fallbackLevel && equipment
      ? `Nothing matches exactly. ${matchHeading(match.fallbackLevel, equipment)}`
      : `Nothing matches exactly. ${matchHeading(level, null)}, any equipment`;
  }
  const who = { beginner: "beginners", intermediate: "intermediates", advanced: "advanced lifters" }[level];
  const kit = equipment ? EQUIPMENT_KIT_WORDS[equipment] : null;
  return kit ? `For ${who} with ${kit}` : `For ${who}`;
}

/** The equipment as a phrase: "a full gym", "dumbbells", "no equipment", "bands". */
export const EQUIPMENT_KIT_WORDS: Record<EquipmentAccess, string> = {
  gym: "a full gym",
  dumbbells: "dumbbells",
  bodyweight: "no equipment",
  bands: "bands",
};

/** The equipment filter chip on onboarding's routine list. */
export const EQUIPMENT_CHIP_LABELS: Record<EquipmentAccess, string> = {
  gym: "Full gym",
  dumbbells: "Dumbbells",
  bodyweight: "No equipment",
  bands: "Bands",
};

/**
 * Whether a program can be done with `access`: its equipment is the same,
 * or the access is a full gym and the program needs dumbbells or nothing
 * (a gym has both). No access filters nothing.
 */
export function equipmentFits(program: ProgramGroup, access: EquipmentAccess | null): boolean {
  if (!access) return true;
  const eq = program.templates[0]?.equipment ?? null;
  if (eq === access) return true;
  return access === "gym" && (eq === "dumbbells" || eq === "bodyweight");
}

/**
 * Plan view's subtitle: "Built for three days a week at a full gym.",
 * "Built for two days a week with dumbbells.", "Built for three days a
 * week." with no equipment answer.
 */
export function planSubtitle(days: number, equipment: EquipmentAccess | null): string {
  const perWeek = `${proseNumber(days)} ${days === 1 ? "day" : "days"} a week`;
  if (!equipment) return `Built for ${perWeek}.`;
  const kit = EQUIPMENT_KIT_WORDS[equipment];
  return `Built for ${perWeek} ${equipment === "gym" ? "at" : "with"} ${kit}.`;
}

/**
 * Plan view's meta line, digits as on every meta line: "Mon, Wed, Fri · 5
 * exercises" with a schedule, "3 days a week · 5 exercises" without. The
 * exercises are the first day's. Parts with nothing to say are left out.
 */
export function planMetaLine(group: ProgramGroup, schedule: string | null): string {
  const first = group.templates[0];
  const days = first?.days_per_week ?? null;
  const n = first?.template_exercises.length ?? 0;
  const when = schedule ?? (days ? `${days} ${days === 1 ? "day" : "days"} a week` : null);
  const exercises = n > 0 ? `${n} ${n === 1 ? "exercise" : "exercises"}` : null;
  return [when, exercises].filter(Boolean).join(" · ");
}

export type RoutineListFilters = {
  /** The level chip, on: only this level. Null when off or not offered. */
  level: TrainingLevel | null;
  /** The equipment chip, on. Null when off. */
  equipment: EquipmentAccess | null;
  /** The days chip, on: the weekly target. Null when off. */
  days: number | null;
  /** Every system routine, hidden ones too: the experienced lifter's list. */
  keepHidden?: boolean;
  /** Ranks on this level with no level chip (a returning user's saved level); filters nothing. */
  rankLevel?: TrainingLevel | null;
};

export type RoutineListSection = { title: string; programs: ProgramGroup[] };

/**
 * Onboarding's "Pick a routine" list, in sections, each best fit first
 * (`rankPrograms`). With the days chip on: "Fits three days a week", the
 * routines with exactly that many days, then "Fewer days", those with
 * fewer, left out when empty. With it off, one "Best matches" section with
 * everything. The equipment chip keeps what `equipmentFits` allows; the
 * level chip keeps that level. Empty sections are dropped, so an empty
 * list means nothing matches the chips.
 */
export function routineListSections(rows: TemplateRow[], filters: RoutineListFilters): RoutineListSection[] {
  const ranked = rankPrograms(
    rows,
    { level: filters.level ?? filters.rankLevel ?? null, equipment: filters.equipment, days: filters.days },
    { keepHidden: filters.keepHidden },
  ).filter(
    (g) =>
      equipmentFits(g, filters.equipment) && (!filters.level || g.templates[0]?.level === filters.level),
  );
  if (filters.days == null) {
    return ranked.length > 0 ? [{ title: "Best matches", programs: ranked }] : [];
  }
  const target = filters.days;
  const daysOf = (g: ProgramGroup) => g.templates[0]?.days_per_week ?? null;
  const fits = ranked.filter((g) => daysOf(g) === target);
  const fewer = ranked.filter((g) => {
    const d = daysOf(g);
    return d != null && d < target;
  });
  const sections: RoutineListSection[] = [];
  if (fits.length > 0) {
    sections.push({ title: `Fits ${proseNumber(target)} ${target === 1 ? "day" : "days"} a week`, programs: fits });
  }
  if (fewer.length > 0) sections.push({ title: "Fewer days", programs: fewer });
  return sections;
}
