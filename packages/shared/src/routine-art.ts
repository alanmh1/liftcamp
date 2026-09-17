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
 * Two walks. The system routines are fixed, so they are grouped by level
 * and equipment (the lists a user sees together) and each group walks most
 * constrained first, the routine with the fewest acceptable images picking
 * first, taking any image not yet used in that group; images repeat freely
 * across groups. A user's own routines walk in creation order with one
 * shared pool, so adding one never changes an earlier one's image.
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
  "pull-up-bar",
] as const;

export type RoutineImageKey = (typeof ROUTINE_IMAGE_KEYS)[number];

export type Focus = "push" | "pull" | "legs" | "core" | "any";

type ImageTag = {
  key: RoutineImageKey;
  equipment: readonly string[];
  focus: Focus;
  /** Eligible only when these exercise ids make up at least `min` of the routine. */
  requires?: { exerciseIds: readonly string[]; min: number };
};

/** Pullups, Chin-Up, Dips - Chest Version, Dips - Triceps Version. */
export const PULL_UP_BAR_EXERCISES: readonly string[] = [
  "ec472562-635a-4216-91e9-165a09f623a6",
  "63c49305-7b82-4a51-87bc-9aa379b7e116",
  "61103781-eac4-4bdc-9879-2dd29a51e3db",
  "79ad90ae-052e-4b9e-8194-fa9058c6ffc6",
];

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
  // Before the mat, so a routine built around the bar prefers it; eligible
  // only when pull-ups, chin-ups and dips are a fifth of the routine.
  { key: "pull-up-bar", equipment: ["body only"], focus: "any", requires: { exerciseIds: PULL_UP_BAR_EXERCISES, min: 0.2 } },
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

/**
 * A routine takes an unused image only if it scores at least this share
 * of its best. A user's routines share one pool, so the bar is high; a
 * system group is small and its members are seen side by side, so it
 * accepts a weaker image to avoid a repeat.
 */
export const USER_REUSE_THRESHOLD = 0.6;
export const GROUP_REUSE_THRESHOLD = 0.4;

export type RoutineForArt = {
  id: string;
  exercises: readonly { equipment: string | null; primary_muscle: string | null; exercise_id?: string | null }[];
};

function eligible(routine: RoutineForArt, image: ImageTag): boolean {
  if (!image.requires || routine.exercises.length === 0) return !image.requires;
  const { exerciseIds, min } = image.requires;
  const count = routine.exercises.filter((e) => e.exercise_id != null && exerciseIds.includes(e.exercise_id)).length;
  return count / routine.exercises.length >= min;
}

/** Every eligible image's score for a routine, in table order. */
function scoreAll(routine: RoutineForArt): { key: RoutineImageKey; score: number; i: number }[] {
  return ROUTINE_IMAGES.map((image, i) => ({ key: image.key, score: scoreImage(routine, image), i })).filter(
    (s) => eligible(routine, ROUTINE_IMAGES[s.i]!),
  );
}

/**
 * How many images a routine would accept: those scoring at least the
 * threshold share of its best. Fewer means more constrained. An empty
 * routine accepts anything, since it takes the fallback regardless.
 */
export function constraintOf(routine: RoutineForArt, threshold = USER_REUSE_THRESHOLD): number {
  if (routine.exercises.length === 0) return ROUTINE_IMAGES.length;
  const scores = scoreAll(routine);
  const best = Math.max(...scores.map((s) => s.score));
  if (best === 0) return ROUTINE_IMAGES.length;
  return scores.filter((s) => s.score >= threshold * best).length;
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
 * the order given with one shared pool. Each routine takes its
 * highest-scoring image not yet taken, if that scores at least the
 * threshold share of its best possible; otherwise it reuses its best. The
 * result for a routine depends only on the routines before it, so for a
 * list in creation order, appending never changes an earlier card. That
 * is the walk for a user's own routines.
 */
export function pickRoutineImages(
  routines: readonly RoutineForArt[],
  threshold = USER_REUSE_THRESHOLD,
): Map<string, RoutineImageKey> {
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
    if (bestUnused && bestUnused.score >= threshold * best.score) {
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
  threshold = USER_REUSE_THRESHOLD,
): T[] {
  return routines
    .map((r) => ({ r, constraint: constraintOf(r, threshold) }))
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
 * routine grid shows them. Programs are grouped by level and equipment,
 * the lists a user sees together; each group walks most constrained
 * first (ties by the earliest variation's `created_at`, then its id) with
 * its own pool, at the group threshold. Run over the full list and looked
 * up per card, so a filtered or reordered grid shows the same image the
 * full grid does. The exercises of every variation count toward the
 * program's image.
 */
export function routineArtByProgram(rows: readonly TemplateRow[]): Map<string, RoutineImageKey> {
  const groups = groupPrograms([...rows]);
  const routines = groups.map((g) => {
    const first = g.templates[0];
    const earliest = [...g.templates].sort(
      (a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id),
    )[0];
    return {
      id: g.program,
      pool: `${first?.level ?? ""}|${first?.equipment ?? ""}`,
      createdAt: earliest?.created_at ?? "",
      tieId: earliest?.id ?? "",
      exercises: g.templates.flatMap((t) =>
        t.template_exercises.map((te) => ({
          equipment: te.exercises?.equipment ?? null,
          primary_muscle: te.exercises?.primary_muscle ?? null,
          exercise_id: te.exercise_id,
        })),
      ),
    };
  });
  const out = new Map<string, RoutineImageKey>();
  const pools = new Map<string, typeof routines>();
  for (const r of routines) {
    const list = pools.get(r.pool) ?? [];
    list.push(r);
    pools.set(r.pool, list);
  }
  for (const members of pools.values()) {
    for (const [id, key] of pickRoutineImages(mostConstrainedFirst(members, GROUP_REUSE_THRESHOLD), GROUP_REUSE_THRESHOLD)) {
      out.set(id, key);
    }
  }
  return out;
}
