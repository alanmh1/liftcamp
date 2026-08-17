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

/** Question-shaped content for the region pages. Guides answer "how"; these
 *  answer the things people actually type into a search box. Rendered as plain
 *  visible copy — no FAQPage markup, which no longer earns a rich result. */
export const REGION_FAQ: Readonly<Record<Region, readonly { q: string; a: string }[]>> = {
  chest: [
    {
      q: "How many chest exercises should I do in one workout?",
      a: "Two is enough for most people: one press and one fly or push-up variation. Three sets each. Adding a fourth chest movement usually adds fatigue rather than progress, because the first press already did most of the work.",
    },
    {
      q: "How often should I train chest?",
      a: "Twice a week beats once, spread a few days apart. A full-body routine three days a week already covers this: you press in every session and never need a dedicated chest day.",
    },
    {
      q: "Do I need incline and flat bench?",
      a: "No. Pick one as your main press and run it for months. Incline emphasises the upper chest and shoulders slightly more, flat lets you load heavier, and the difference matters far less than adding weight over time.",
    },
    {
      q: "Why do my shoulders hurt when I bench?",
      a: "Usually flaring the elbows straight out to the sides, or lowering the bar to the collarbone rather than the lower chest. Tuck the elbows to roughly 45 degrees, drop the weight, and rebuild. Pain that persists after that is worth showing a physio.",
    },
  ],
  back: [
    {
      q: "Is one row and one pulldown enough for back?",
      a: "Yes. A horizontal pull and a vertical pull cover the whole back for a beginner. Three sets each, twice a week, and add weight when you hit the top of your rep range.",
    },
    {
      q: "I can't do a pull-up yet. What should I do?",
      a: "Use the lat pulldown as your vertical pull and work up in weight. Assisted pull-ups and slow lowering from the top also build the same pattern. Most people need months, and that is normal.",
    },
    {
      q: "How do I stop my biceps taking over rows?",
      a: "Think about pulling with your elbows rather than your hands, and pause for a second at the top with the shoulder blades pulled together. If the weight only moves when you curl it, it is too heavy.",
    },
    {
      q: "Do deadlifts count as back work?",
      a: "They load the lower back and traps hard, but they don't replace a row or a pulldown. If you deadlift, still do one horizontal pull in the same week.",
    },
  ],
  shoulders: [
    {
      q: "Do I need direct shoulder work if I bench press?",
      a: "Pressing hits the front delts already. What benching misses is the side and rear delts, so one lateral raise and one rear-delt movement is the useful addition, not another press.",
    },
    {
      q: "How heavy should lateral raises be?",
      a: "Lighter than you think. Five or ten pound dumbbells for sets of 12–15, raised with no swing, is correct for most beginners and stays correct for a long time.",
    },
    {
      q: "Overhead press: barbell or dumbbells?",
      a: "Dumbbells if your shoulders are cranky or you train alone, barbell if you want to load heavier and track the number cleanly. Either works; pick one and stay with it.",
    },
    {
      q: "How do I fix rounded, forward shoulders?",
      a: "Rear delts and upper back, twice a week (face pulls, rear-delt flyes, rows), plus not living in one position all day. It's a slow change measured in months, not sessions.",
    },
  ],
  arms: [
    {
      q: "Do I need direct arm work?",
      a: "Rows and presses train the arms, but if bigger arms are the goal, add one curl and one triceps movement. Three sets of each at the end of a session is plenty.",
    },
    {
      q: "How many sets of biceps per week?",
      a: "Six to ten hard sets a week is a sensible range for a beginner, spread across two sessions. More than that mostly buys soreness.",
    },
    {
      q: "Why do my elbows hurt on curls and skullcrushers?",
      a: "Usually a straight bar forcing the wrists into a fixed position, plus too much weight swung at the bottom. Switch to an EZ-bar or dumbbells, cut the load, and control the lowering.",
    },
    {
      q: "Are triceps or biceps more important for arm size?",
      a: "Triceps. They make up roughly two thirds of the upper arm. If you only have time for one, press-downs or an overhead extension beats a curl.",
    },
  ],
  legs: [
    {
      q: "Can I train legs without squatting?",
      a: "Yes. A leg press or hack squat covers the same pattern, and split squats or lunges work if loading a bar hurts. Pair any of them with a hinge such as a Romanian deadlift.",
    },
    {
      q: "How often should I train legs?",
      a: "Twice a week, which a three-day full-body routine gives you automatically. One brutal leg day a week leaves you sore for three days and progresses slower.",
    },
    {
      q: "How low should I squat?",
      a: "As low as you can go with your lower back staying neutral, which for most people means thighs at or just below parallel. Depth beyond that is a mobility question, not a requirement.",
    },
    {
      q: "Do leg extensions and curls do anything?",
      a: "Yes, they add direct quad and hamstring work and they are easy to load and progress. They're a supplement to squats and hinges, not a replacement.",
    },
  ],
  core: [
    {
      q: "Will core exercises give me abs?",
      a: "They build the muscle; whether it shows depends on body fat. Train the core because a braced midsection makes squats, deadlifts and carries safer and stronger.",
    },
    {
      q: "How long should I hold a plank?",
      a: "Thirty to sixty seconds with hips level and glutes squeezed. If you can hold two minutes, add load or switch to a harder variation instead of holding longer.",
    },
    {
      q: "Are sit-ups bad for your back?",
      a: "Not inherently, but repeated full flexion under load bothers a lot of people. Planks, dead bugs and cable or machine crunches give you the same work with fewer complaints.",
    },
    {
      q: "How often should I train abs?",
      a: "Two or three short sessions a week, tacked onto the end of a workout. Five to ten minutes is enough.",
    },
  ],
};
