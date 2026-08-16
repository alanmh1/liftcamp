// Region map for the public catalog.
//
// Two separate mechanisms that must not be collapsed into one:
//
//   MUSCLE_REGION  — muscle -> exactly one region. Used for breadcrumbs, so an
//                    exercise names one collection and one only.
//   REGION_MUSCLES — region -> ordered sections rendered on that page. "lower
//                    back" appears under BOTH back and core here, because a
//                    section is an anchor, not a row, and surfacing a hinge in
//                    both places duplicates nothing.
//
// Muscles are never routes. /exercises/back#lats is the destination; a muscle
// page below a region would be the same list under a second URL.

import type { CanonicalMuscle } from "./muscle-vocab";

export const REGIONS = ["chest", "back", "shoulders", "arms", "legs", "core"] as const;
export type Region = (typeof REGIONS)[number];

const REGION_SET: ReadonlySet<string> = new Set(REGIONS);
export function isRegion(v: string | null | undefined): v is Region {
  return !!v && REGION_SET.has(v);
}

/** Muscle -> its single canonical region. Breadcrumbs read this and nothing else. */
export const MUSCLE_REGION: Readonly<Record<CanonicalMuscle, Region>> = {
  chest: "chest",
  lats: "back",
  "upper back": "back",
  "lower back": "back",
  traps: "back",
  shoulders: "shoulders",
  neck: "shoulders",
  biceps: "arms",
  triceps: "arms",
  forearms: "arms",
  quads: "legs",
  hamstrings: "legs",
  glutes: "legs",
  calves: "legs",
  adductors: "legs",
  abductors: "legs",
  abs: "core",
};

/** Region -> ordered anchored sections. NOT the inverse of MUSCLE_REGION:
 *  "lower back" is deliberately listed twice, under back and under core. */
export const REGION_MUSCLES: Readonly<Record<Region, readonly CanonicalMuscle[]>> = {
  chest: ["chest"],
  back: ["lats", "upper back", "lower back", "traps"],
  shoulders: ["shoulders", "neck"],
  arms: ["biceps", "triceps", "forearms"],
  legs: ["quads", "hamstrings", "glutes", "calves", "adductors", "abductors"],
  core: ["abs", "lower back"],
};

/** Anchor id for a muscle section: "lower back" -> "lower-back". */
export function muscleAnchor(muscle: string): string {
  return muscle.trim().toLowerCase().replace(/\s+/g, "-");
}

/** The 17 muscle-name URLs that 301 onto their region anchor. Keyed by the
 *  same slug shape the exercise route receives. */
export const MUSCLE_SLUG_REDIRECTS: Readonly<Record<string, { region: Region; hash: string }>> =
  Object.fromEntries(
    (Object.keys(MUSCLE_REGION) as CanonicalMuscle[]).map((m) => [
      muscleAnchor(m),
      { region: MUSCLE_REGION[m], hash: muscleAnchor(m) },
    ]),
  );

export const REGION_META: Readonly<
  Record<Region, { h1: string; title: string; intro: string; description: string }>
> = {
  chest: {
    h1: "Chest Exercises",
    title: "Chest Exercises — Every Press and Fly | LiftCamp",
    intro:
      "Every pressing and fly movement in the library that loads your chest, with equipment, difficulty and step-by-step instructions written for people who have never done them.",
    description:
      "Chest exercises with instructions, equipment and difficulty — presses, flyes and push-up variations from the LiftCamp library.",
  },
  back: {
    h1: "Back Exercises",
    title: "Back Exercises — Lats, Upper Back, Traps | LiftCamp",
    intro:
      "Every pulling movement in the library, covering lats, upper back, lower back and traps, with equipment, difficulty and instructions written for people who have never done them.",
    description:
      "Back exercises for lats, upper back, lower back and traps — rows, pulldowns, pull-ups and hinges with step-by-step instructions.",
  },
  shoulders: {
    h1: "Shoulder Exercises",
    title: "Shoulder Exercises — Delts and Neck | LiftCamp",
    intro:
      "Overhead presses, raises and everything else that loads your shoulders and neck, with equipment, difficulty and instructions written for people who have never done them.",
    description:
      "Shoulder exercises — overhead presses, lateral and rear-delt raises, plus neck work, with equipment and step-by-step instructions.",
  },
  arms: {
    h1: "Arm Exercises",
    title: "Arm Exercises — Biceps, Triceps, Forearms | LiftCamp",
    intro:
      "Curls, extensions and grip work covering biceps, triceps and forearms, with equipment, difficulty and instructions written for people who have never done them.",
    description:
      "Arm exercises for biceps, triceps and forearms — curls, extensions, skullcrushers and grip work with step-by-step instructions.",
  },
  legs: {
    h1: "Leg Exercises",
    title: "Leg Exercises — Quads, Hamstrings, Glutes | LiftCamp",
    intro:
      "Squats, hinges and everything that loads your quads, hamstrings, glutes, calves, adductors and abductors, with equipment, difficulty and instructions written for people who have never done them.",
    description:
      "Leg exercises for quads, hamstrings, glutes, calves and hips — squats, hinges, lunges and presses with step-by-step instructions.",
  },
  core: {
    h1: "Core Exercises",
    title: "Core Exercises — Abs and Lower Back | LiftCamp",
    intro:
      "Bracing, flexion and anti-rotation work for your abs and lower back, with equipment, difficulty and instructions written for people who have never done them.",
    description:
      "Core exercises for abs and lower back — planks, carries, crunches and extensions with equipment and step-by-step instructions.",
  },
};

/** Slugs that changed after publication. Keyed old -> new, resolved before any
 *  database call, so a renamed row leaves no 404 behind. Entries are permanent:
 *  removing one turns an old link into a 404, which is the thing the map exists
 *  to prevent.
 *
 *  Distinct from CANONICAL_SLUG_OVERRIDES below. This map means "that URL moved"
 *  (301, one row). That map means "two rows, one movement, point rel=canonical
 *  at the better-named one" (200, both rows still live). */
export const LEGACY_SLUG_REDIRECTS: Readonly<Record<string, string>> = {
  "barbell-bench-press-medium-grip": "barbell-bench-press",
  "barbell-incline-bench-press-medium-grip": "incline-barbell-bench-press",
};

/** Cheap duplicate handling: two live rows describe one movement, so the outlier
 *  points rel=canonical at the row whose name matches the catalog's convention
 *  (24 rows are "Smith Machine …"; exactly one was not). Neither row is merged
 *  or deleted — that is the canonical_exercise_id work, still parked. */
export const CANONICAL_SLUG_OVERRIDES: Readonly<Record<string, string>> = {
  "close-grip-smith-machine-bench-press": "smith-machine-close-grip-bench-press",
  // Same lift under two rows. The catalog export shows identical secondary
  // muscles, force and mechanic on both; only `level` differs (beginner vs
  // intermediate). barbell-squat wins because it is the searched phrase.
  // Not merged: the intermediate row may carry logged history.
  "barbell-full-squat": "barbell-squat",
};
