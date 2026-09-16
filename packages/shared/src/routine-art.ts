import { groupPrograms, type TemplateRow } from "./templates";

/**
 * Which equipment illustration a routine card shows.
 *
 * Fourteen images, each tagged with the `exercises.equipment` values it
 * depicts and a focus (push, pull, legs, or any). A routine scores every
 * image on how much of it uses that equipment and how much of it trains
 * that focus, and routines take images in turn so two leg days do not
 * both show the leg press. The walk is in creation order, so adding a
 * routine never changes an earlier one's image.
 */

export const ROUTINE_IMAGE_KEYS = [
  "leg-press",
  "leg-curl",
  "chest-press",
  "lat-pulldown",
  "power-rack",
  "smith-machine",
  "adjustable-bench",
  "ez-bar",
  "barbell",
  "dumbbells",
  "kettlebell",
  "cable-machine",
  "resistance-bands",
  "bodyweight-mat",
] as const;

export type RoutineImageKey = (typeof ROUTINE_IMAGE_KEYS)[number];

export type Focus = "push" | "pull" | "legs" | "core" | "any";

type ImageTag = { key: RoutineImageKey; equipment: readonly string[]; focus: Focus };

/** In priority order: a tie in score goes to the earlier row. */
export const ROUTINE_IMAGES: readonly ImageTag[] = [
  { key: "leg-press", equipment: ["machine"], focus: "legs" },
  { key: "leg-curl", equipment: ["machine"], focus: "legs" },
  { key: "chest-press", equipment: ["machine"], focus: "push" },
  { key: "lat-pulldown", equipment: ["machine", "cable"], focus: "pull" },
  { key: "power-rack", equipment: ["barbell"], focus: "legs" },
  { key: "smith-machine", equipment: ["smith machine"], focus: "legs" },
  { key: "adjustable-bench", equipment: ["barbell", "dumbbell"], focus: "push" },
  { key: "ez-bar", equipment: ["e-z curl bar"], focus: "any" },
  { key: "barbell", equipment: ["barbell"], focus: "any" },
  { key: "dumbbells", equipment: ["dumbbell"], focus: "any" },
  { key: "kettlebell", equipment: ["kettlebells"], focus: "any" },
  { key: "cable-machine", equipment: ["cable"], focus: "any" },
  { key: "resistance-bands", equipment: ["bands"], focus: "any" },
  { key: "bodyweight-mat", equipment: ["body only"], focus: "any" },
];

/** Primary muscle to focus group. Medicine ball, foam roll, exercise ball and other match no image. */
export const FOCUS_GROUPS: Readonly<Record<Exclude<Focus, "any">, readonly string[]>> = {
  push: ["chest", "shoulders", "triceps"],
  pull: ["lats", "upper back", "traps", "biceps", "forearms"],
  legs: ["quads", "hamstrings", "glutes", "calves", "adductors", "abductors"],
  core: ["abs", "lower back"],
};

/** A routine with no exercises shows this, without reserving it. */
export const FALLBACK_IMAGE: RoutineImageKey = "dumbbells";

/** A routine takes an unused image only if it scores at least this share of its best. */
const REUSE_THRESHOLD = 0.6;

export type RoutineForArt = {
  id: string;
  exercises: readonly { equipment: string | null; primary_muscle: string | null }[];
};

/** 0.6 equipment share plus 0.4 focus share; focus is 0.5 for an "any" image. */
export function scoreImage(routine: RoutineForArt, image: ImageTag): number {
  const total = routine.exercises.length;
  if (total === 0) return 0;
  const withEquipment = routine.exercises.filter((e) => e.equipment != null && image.equipment.includes(e.equipment)).length;
  const equipment = withEquipment / total;
  const group = image.focus === "any" ? null : FOCUS_GROUPS[image.focus];
  const focus = group
    ? routine.exercises.filter((e) => e.primary_muscle != null && group.includes(e.primary_muscle)).length / total
    : 0.5;
  return 0.6 * equipment + 0.4 * focus;
}

/**
 * One image key per routine, keyed by routine id, walking the routines in
 * the order given. Each routine takes its highest-scoring image not yet
 * taken, if that scores at least 60% of its best possible; otherwise it
 * reuses its best. The result for a routine depends only on the routines
 * before it, so appending never changes an earlier card.
 */
export function pickRoutineImages(routines: readonly RoutineForArt[]): Map<string, RoutineImageKey> {
  const out = new Map<string, RoutineImageKey>();
  const used = new Set<RoutineImageKey>();
  for (const routine of routines) {
    if (routine.exercises.length === 0) {
      out.set(routine.id, FALLBACK_IMAGE);
      continue;
    }
    const scored = ROUTINE_IMAGES.map((image) => ({ key: image.key, score: scoreImage(routine, image) }));
    // Stable sort: table order breaks ties.
    const ranked = scored
      .map((s, i) => ({ ...s, i }))
      .sort((a, b) => b.score - a.score || a.i - b.i);
    const best = ranked[0];
    const bestUnused = ranked.find((s) => !used.has(s.key));
    if (bestUnused && bestUnused.score >= REUSE_THRESHOLD * best.score) {
      out.set(routine.id, bestUnused.key);
      used.add(bestUnused.key);
    } else {
      out.set(routine.id, best.key);
    }
  }
  return out;
}

/**
 * The images for a set of templates, keyed by program name, as the routine
 * grid shows them. Run over the full list in one fixed order (earliest
 * variation's `created_at`, then program name), so a filtered or reordered
 * grid looks up the same image for a card as the full grid does. The
 * exercises of every variation count toward the program's image.
 */
export function routineArtByProgram(rows: readonly TemplateRow[]): Map<string, RoutineImageKey> {
  const groups = groupPrograms([...rows]);
  const inOrder = [...groups].sort((a, b) => {
    const ca = a.templates.map((t) => t.created_at ?? "").sort()[0] ?? "";
    const cb = b.templates.map((t) => t.created_at ?? "").sort()[0] ?? "";
    return ca.localeCompare(cb) || a.program.localeCompare(b.program);
  });
  const routines: RoutineForArt[] = inOrder.map((g) => ({
    id: g.program,
    exercises: g.templates.flatMap((t) =>
      t.template_exercises.map((te) => ({
        equipment: te.exercises?.equipment ?? null,
        primary_muscle: te.exercises?.primary_muscle ?? null,
      })),
    ),
  }));
  return pickRoutineImages(routines);
}
