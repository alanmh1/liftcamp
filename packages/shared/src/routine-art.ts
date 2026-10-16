import { groupPrograms, type TemplateRow } from "./templates";

/**
 * Which equipment illustration a routine card shows.
 *
 * Seventeen images, each tagged with the `exercises.equipment` values it
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
  "dip-station",
  "chair",
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

/**
 * Body-only exercises done on a pull-up bar or a dip station, by id. The
 * database has no flag for this; ids resolved by exact name from the live
 * `exercises` table.
 */
export const PULL_UP_BAR_EXERCISES: readonly string[] = [
  "ec472562-635a-4216-91e9-165a09f623a6", // Pullups
  "63c49305-7b82-4a51-87bc-9aa379b7e116", // Chin-Up
  "61103781-eac4-4bdc-9879-2dd29a51e3db", // Dips - Chest Version
  "79ad90ae-052e-4b9e-8194-fa9058c6ffc6", // Dips - Triceps Version
  "33330454-1ac1-486f-8b3c-7adaf9df03b5", // Hanging Leg Raise
  "964336cf-96a9-449f-a942-c1e0a3a8e0d1", // Hanging Pike
  "04514ba4-40e6-44c7-bfad-ca67a40ebcab", // Knee/Hip Raise On Parallel Bars
  "ce0a7f4b-2ea1-4c9d-ba02-5d2a54f8675c", // Parallel Bar Dip
  "ae9cc78d-0d08-41d1-971b-45ec5c4b38b9", // Scapular Pull-Up
  "09338b26-cb15-4b56-8111-376ab3c64c85", // V-Bar Pullup
  "57013839-d3d1-483a-a315-706f4b8df26d", // Gorilla Chin/Crunch
  "8dd48da6-7cc3-4733-a7af-d235fe76bb97", // Muscle Up
  "d290bff9-4b7a-4578-b7da-609aca3d2686", // Kipping Muscle Up
  "aa47c3ac-1d5c-424b-bb9a-24007a9f244c", // Gironda Sternum Chins
  "15773abd-0904-446c-bbc7-d41f30c91b0e", // Rocky Pull-Ups/Pulldowns
  "224b3d38-3c61-4158-86ce-c7567bba0871", // Side To Side Chins
  "4630425d-05c2-4380-9d92-eec52dc2cc9e", // Weighted Pull Ups
  "75479290-038c-477f-a209-7f8b7ef20a17", // Wide-Grip Rear Pull-Up
  "f44d8cd1-ac9f-4bab-8698-b1a8e2420b2c", // Mixed Grip Chin
  "f58cb8bc-1488-4e1e-a0b7-2b6808548770", // One Arm Chin-Up
];

/** Exercises done on parallel bars or rings. Ring Dips is equipment `other`. */
export const DIP_STATION_EXERCISES: readonly string[] = [
  "61103781-eac4-4bdc-9879-2dd29a51e3db", // Dips - Chest Version
  "79ad90ae-052e-4b9e-8194-fa9058c6ffc6", // Dips - Triceps Version
  "ce0a7f4b-2ea1-4c9d-ba02-5d2a54f8675c", // Parallel Bar Dip
  "04514ba4-40e6-44c7-bfad-ca67a40ebcab", // Knee/Hip Raise On Parallel Bars
  "72a0683d-a35f-46e0-9fb0-fca48714e49d", // Ring Dips
];

/** Body-only strength exercises done on a bench, box, step or chair. */
export const CHAIR_EXERCISES: readonly string[] = [
  "eaf26682-55c5-4e48-bcbf-99ad98f3d123", // Bench Dips
  "01529b70-b400-4b26-8a2e-11b5d3595b25", // Body Tricep Press
  "c86ad38f-0c8f-435b-b69e-02d6d80b7d60", // Incline Push-Up
  "9e2468cd-46b6-43b6-abb3-07437053f632", // Incline Push-Up Medium
  "8744d821-3c5c-4cc4-8642-0f994128ab12", // Incline Push-Up Wide
  "5638f73c-588a-4371-a032-b46f37815efb", // Incline Push-Up Reverse Grip
  "52e88082-dd85-4125-a9bb-8b250b7ba788", // Incline Push-Up Close-Grip
  "f8d013bc-e091-42ad-a796-546fcd7ffe8e", // Decline Push-Up
  "245c9a6c-2aec-410f-8f51-61acf006a4c5", // Push-Ups With Feet Elevated
  "0bc5150a-e306-4957-ad04-f4e35ff9cbba", // Step-up with Knee Raise
  "9b6c4d1a-6fb3-4c7f-b521-ded3f0bb7922", // Single-Leg High Box Squat
  "ed61650b-d3b2-4835-b34c-e091cf74559c", // Flat Bench Leg Pull-In
  "95a0610d-7b79-4bb0-8248-5cef4ca24392", // Flat Bench Lying Leg Raise
  "293f4780-83fd-4862-a1fe-ea0b9da56eea", // Seated Flat Bench Leg Pull-In
  "20b9148d-abb0-4725-af33-ee508f9d1b46", // Decline Crunch
  "82fa82bd-65f1-409a-89e4-f936eb012b27", // Decline Oblique Crunch
  "3843fb4a-85ad-45bc-af02-9b0c361593b8", // Decline Reverse Crunch
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
  // Before the mat, so a routine built around a bar, dip station or chair
  // prefers that image; each is eligible only when its exercises make up
  // the given share of the routine. Ties go bar, dip station, chair, mat.
  { key: "pull-up-bar", equipment: ["body only"], focus: "any", requires: { exerciseIds: PULL_UP_BAR_EXERCISES, min: 0.2 } },
  { key: "dip-station", equipment: ["body only"], focus: "any", requires: { exerciseIds: DIP_STATION_EXERCISES, min: 0.1 } },
  { key: "chair", equipment: ["body only"], focus: "any", requires: { exerciseIds: CHAIR_EXERCISES, min: 0.2 } },
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
