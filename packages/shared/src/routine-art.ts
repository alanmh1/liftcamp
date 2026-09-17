import { groupPrograms, type TemplateRow } from "./templates";

/**
 * Which equipment illustration a routine card shows.
 *
 * Fourteen images, each tagged with the `exercises.equipment` values it
 * depicts and a focus (push, pull, legs, or any). A routine scores every
 * image on how much of it uses that equipment and how much of it trains
 * that focus, and routines take images in turn so two leg days do not
 * both show the leg press.
 *
 * Two walks. The system routines are fixed, so they walk most constrained
 * first (the routine with the fewest acceptable images picks first), which
 * spreads the images best. A user's own routines walk in creation order,
 * so adding one never changes an earlier one's image.
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

/** Every image's score for a routine, in table order. */
function scoreAll(routine: RoutineForArt): { key: RoutineImageKey; score: number; i: number }[] {
  return ROUTINE_IMAGES.map((image, i) => ({ key: image.key, score: scoreImage(routine, image), i }));
}

/**
 * How many images a routine would accept: those scoring at least the
 * reuse threshold of its best. Fewer means more constrained. An empty
 * routine accepts anything, since it takes the fallback regardless.
 */
export function constraintOf(routine: RoutineForArt): number {
  if (routine.exercises.length === 0) return ROUTINE_IMAGES.length;
  const scores = scoreAll(routine);
  const best = Math.max(...scores.map((s) => s.score));
  if (best === 0) return ROUTINE_IMAGES.length;
  return scores.filter((s) => s.score >= REUSE_THRESHOLD * best).length;
}

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
 * before it, so for a list in creation order, appending never changes an
 * earlier card. That is the walk for a user's own routines.
 */
export function pickRoutineImages(routines: readonly RoutineForArt[]): Map<string, RoutineImageKey> {
  const out = new Map<string, RoutineImageKey>();
  const used = new Set<RoutineImageKey>();
  for (const routine of routines) {
    if (routine.exercises.length === 0) {
      out.set(routine.id, FALLBACK_IMAGE);
      continue;
    }
    // Stable sort: table order breaks ties.
    const ranked = scoreAll(routine).sort((a, b) => b.score - a.score || a.i - b.i);
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
 * The walk for a fixed set: most constrained first, so the routine with
 * the fewest acceptable images picks before one that would be happy with
 * many. Ties break on `createdAt`, then `tieId`, so the order is the same
 * from any input order.
 */
export function mostConstrainedFirst<T extends RoutineForArt & { createdAt: string; tieId: string }>(
  routines: readonly T[],
): T[] {
  return routines
    .map((r) => ({ r, constraint: constraintOf(r) }))
    .sort(
      (a, b) =>
        a.constraint - b.constraint ||
        a.r.createdAt.localeCompare(b.r.createdAt) ||
        a.r.tieId.localeCompare(b.r.tieId),
    )
    .map((x) => x.r);
}

/**
 * The images for the system templates, keyed by program name, as the
 * routine grid shows them. The system set is fixed, so it walks most
 * constrained first; a program's `createdAt` is its earliest variation's
 * and its tie id that variation's id. Run over the full list and looked
 * up per card, so a filtered or reordered grid shows the same image the
 * full grid does. The exercises of every variation count toward the
 * program's image.
 */
export function routineArtByProgram(rows: readonly TemplateRow[]): Map<string, RoutineImageKey> {
  const groups = groupPrograms([...rows]);
  const routines = groups.map((g) => {
    const earliest = [...g.templates].sort(
      (a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id),
    )[0];
    return {
      id: g.program,
      createdAt: earliest?.created_at ?? "",
      tieId: earliest?.id ?? "",
      exercises: g.templates.flatMap((t) =>
        t.template_exercises.map((te) => ({
          equipment: te.exercises?.equipment ?? null,
          primary_muscle: te.exercises?.primary_muscle ?? null,
        })),
      ),
    };
  });
  return pickRoutineImages(mostConstrainedFirst(routines));
}
