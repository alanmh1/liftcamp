// Sub-muscle pages: /exercises/lats, /exercises/glutes, …
//
// 14 of the 17 canonical muscles get their own page under a region hub. The
// three that do not: chest and shoulders are a whole hub already, and neck
// (8 exercises) stays a section on the shoulders hub. The hub keeps an
// anchored section for each of these muscles, so /exercises/back#lats still
// lands, and its heading links here.
//
// Slugs resolve in the /exercises/[slug] route before the database lookup,
// like the region and equipment slugs. Checked against the exercises table
// when added (27 Oct 2026): no row claims any of them.
//
// `description` is a function of the live count so the number never goes
// stale; every other string is the authored copy verbatim.

import type { CanonicalMuscle } from "@liftcamp/shared";
import { muscleAnchor, type Region } from "./muscle-regions";

export type SubmusclePage = {
  /** URL slug, e.g. "upper-back". Same shape as the hub anchor. */
  slug: string;
  muscle: CanonicalMuscle;
  /** The breadcrumb parent. Lower back is under back here even though the
   *  core hub also has a lower back section. */
  parent: Region;
  /** Short name for links and the breadcrumb, e.g. "Upper back". */
  label: string;
  h1: string;
  title: string;
  description: (count: number) => string;
  /** Two paragraphs under the H1. */
  intro: readonly [string, string];
  /** Exercise slugs for the "Start with" row, in order. Each has a beginner
   *  block, so its card shows the starting-weight sentence. */
  start: readonly string[];
  /** Program slug of a routine card shown after the list. */
  routine?: string;
};

const PAGES: readonly SubmusclePage[] = [
  {
    slug: "lats",
    muscle: "lats",
    parent: "back",
    label: "Lats",
    h1: "Lat Exercises",
    title: "Lat Exercises: Pulldowns, Rows and Pull-Ups | LiftCamp",
    description: (n) =>
      `${n} lat exercises with instructions, equipment and difficulty. Where to start when you can't do a pull-up yet, and the pulldown weight that works on day one.`,
    intro: [
      "Your lats are the wide muscles down the sides of your back, the ones that pull your arms down and in toward your body. Every pull-up, chin-up, pulldown and most rows train them.",
      "Most beginners can't do a pull-up yet, and that is the normal starting point. The wide-grip lat pulldown lets you pick any weight, so start there and add pull-up negatives on the bar twice a week.",
    ],
    start: ["wide-grip-lat-pulldown", "pullups", "straight-arm-pulldown"],
  },
  {
    slug: "upper-back",
    muscle: "upper back",
    parent: "back",
    label: "Upper back",
    h1: "Upper Back Exercises",
    title: "Upper Back Exercises: Rows, Face Pulls and Rear Delt Work | LiftCamp",
    description: (n) =>
      `${n} upper back exercises with instructions, equipment and difficulty. The rows to start with and the weight to use so your torso stays still.`,
    intro: [
      "The upper back is the muscle between your shoulder blades, the rhomboids, middle traps and rear delts. It holds your shoulders back under a bar, and it gets skipped by people who only press.",
      "Rows do most of the work. A seated cable row or a one-arm dumbbell row is the easiest place to start, with a weight you can pull for 10 reps while your torso stays still.",
    ],
    start: ["seated-cable-rows", "one-arm-dumbbell-row", "face-pull"],
  },
  {
    slug: "lower-back",
    muscle: "lower back",
    parent: "back",
    label: "Lower back",
    h1: "Lower Back Exercises",
    title: "Lower Back Exercises: Hinges, Extensions and Deadlifts | LiftCamp",
    description: (n) =>
      `${n} lower back exercises with instructions, equipment and difficulty. Start with back extensions and a light Romanian deadlift, then work up to the deadlift.`,
    intro: [
      "The lower back holds your spine straight while your hips do the work. Deadlifts, Romanian deadlifts, good mornings and back extensions all train it, and so does every heavy squat.",
      "Start with bodyweight back extensions, then a Romanian deadlift lighter than you expect. The deadlift comes once the hinge feels natural. A lower back that rounds under load is the one form problem worth stopping a set over.",
    ],
    start: ["hyperextensions-back-extensions", "romanian-deadlift", "barbell-deadlift"],
  },
  {
    slug: "traps",
    muscle: "traps",
    parent: "back",
    label: "Traps",
    h1: "Trap Exercises",
    title: "Trap Exercises: Shrugs, Upright Rows and Carries | LiftCamp",
    description: (n) =>
      `${n} trap exercises with instructions, equipment and difficulty. Shrug weights for day one, and why deadlifts and carries already train your traps.`,
    intro: [
      "The traps run from your neck out to your shoulders and down your upper back. The upper part is the one you can see. It shrugs your shoulders and holds a heavy bar in your hands.",
      "Shrugs are simple and hard to get wrong. Deadlifts and farmer's walks train the traps without a single shrug, so if you already do those, add shrugs last in the session.",
    ],
    start: ["dumbbell-shrug", "barbell-shrug", "farmers-walk"],
  },
  {
    slug: "biceps",
    muscle: "biceps",
    parent: "arms",
    label: "Biceps",
    h1: "Bicep Exercises",
    title: "Bicep Exercises: Curls for Every Bar and Dumbbell | LiftCamp",
    description: (n) =>
      `${n} bicep exercises with instructions, equipment and difficulty. The dumbbell and EZ bar weights to start curling with, and the swing to avoid.`,
    intro: [
      "Biceps bend your elbow and turn your palm up. Curls are the direct work, and every row, pull-up and pulldown trains them too.",
      "Pick a weight you can curl for 10 controlled reps without your elbows swinging forward or your torso rocking. 10 or 15 lb dumbbells, or the empty EZ bar, is where most people should start.",
    ],
    start: ["dumbbell-bicep-curl", "ez-bar-curl", "hammer-curls"],
  },
  {
    slug: "triceps",
    muscle: "triceps",
    parent: "arms",
    label: "Triceps",
    h1: "Tricep Exercises",
    title: "Tricep Exercises: Pushdowns, Dips and Close-Grip Presses | LiftCamp",
    description: (n) =>
      `${n} tricep exercises with instructions, equipment and difficulty. The pushdown weight to start at, and when dips are ready for you.`,
    intro: [
      "Triceps straighten your elbow and make up most of your upper arm. Every press works them, and pushdowns, dips and the close-grip bench press hit them directly.",
      "Start with a rope pushdown at 20 to 30 lb, a weight you can push for 12 clean reps with your elbows pinned to your sides. Dips come once you can hold a straight-arm position on the bars for a few seconds.",
    ],
    start: ["triceps-pushdown-rope-attachment", "close-grip-barbell-bench-press", "bench-dips"],
  },
  {
    slug: "forearms",
    muscle: "forearms",
    parent: "arms",
    label: "Forearms",
    h1: "Forearm Exercises",
    title: "Forearm Exercises: Grip, Carries and Wrist Work | LiftCamp",
    description: (n) =>
      `${n} forearm exercises with instructions, equipment and difficulty. Why grip gives out first on deadlifts and rows, and the two exercises that fix it.`,
    intro: [
      "Forearms close your hand and bend your wrist. Grip is usually what gives out first on deadlifts, rows and pull-ups, so forearm work pays off in every other lift.",
      "Farmer's walks and hammer curls train them with no special equipment. Direct wrist curls can wait until grip is the thing holding back a lift.",
    ],
    start: ["farmers-walk", "hammer-curls", "alternate-hammer-curl"],
  },
  {
    slug: "quads",
    muscle: "quads",
    parent: "legs",
    label: "Quads",
    h1: "Quad Exercises",
    title: "Quad Exercises: Squats, Presses and Lunges | LiftCamp",
    description: (n) =>
      `${n} quad exercises with instructions, equipment and difficulty. The empty-bar squat, the goblet squat for gyms with no rack, and the leg press.`,
    intro: [
      "The quads are the front of your thigh. They straighten your knee, so every squat, leg press, lunge and leg extension trains them.",
      "The barbell squat with the empty bar is the standard start. If your gym has no rack or the bar feels like too much, a goblet squat with a 20 or 25 lb dumbbell teaches the same movement.",
    ],
    start: ["barbell-squat", "goblet-squat", "leg-press"],
  },
  {
    slug: "hamstrings",
    muscle: "hamstrings",
    parent: "legs",
    label: "Hamstrings",
    h1: "Hamstring Exercises",
    title: "Hamstring Exercises: Hinges, Curls and Deadlifts | LiftCamp",
    description: (n) =>
      `${n} hamstring exercises with instructions, equipment and difficulty. The Romanian deadlift weight that is enough on day one, and the seated curl to pair it with.`,
    intro: [
      "Hamstrings are the back of your thigh. They bend your knee and, more importantly for lifting, drive your hips forward, which is what every deadlift and hip hinge trains.",
      "Start the Romanian deadlift lighter than your other lifts. 95 lb done properly is enough to leave you sore for two days. A seated hamstring curl at 30 to 40 lb covers the knee-bend side.",
    ],
    start: ["romanian-deadlift", "seated-hamstring-curl", "stiff-legged-dumbbell-deadlift"],
  },
  {
    slug: "glutes",
    muscle: "glutes",
    parent: "legs",
    label: "Glutes",
    h1: "Glute Exercises",
    title: "Glute Exercises: Hip Thrusts, Bridges and Squats | LiftCamp",
    description: (n) =>
      `${n} glute exercises with instructions, equipment and difficulty. Start with the empty bar on a hip thrust or glute bridge, plus a three-day glute routine.`,
    intro: [
      "Glutes extend your hip. Squats and deadlifts train them hard, and hip thrusts and glute bridges isolate them with the load across your hips instead of on your back.",
      "Start with a barbell glute bridge or hip thrust using the empty 45 lb bar and a pad. Bulgarian split squats with bodyweight for the first two weeks cover one leg at a time.",
    ],
    start: ["barbell-hip-thrust", "barbell-glute-bridge", "bulgarian-split-squat"],
    routine: "glute-workout-plan",
  },
  {
    slug: "calves",
    muscle: "calves",
    parent: "legs",
    label: "Calves",
    h1: "Calf Exercises",
    title: "Calf Exercises: Standing and Seated Raises | LiftCamp",
    description: (n) =>
      `${n} calf exercises with instructions, equipment and difficulty. Starting weights for standing and seated raises, and the bounce that wastes most sets.`,
    intro: [
      "Calves point your foot down. Standing raises work the big muscle you can see. Seated raises work the one underneath, which is why both show up in most leg days.",
      "Start the standing calf raise at about half your bodyweight on the machine and the seated raise with one 45 lb plate. Pause at the top and the bottom. Bouncing through reps is the mistake almost everyone makes.",
    ],
    start: ["standing-calf-raises", "seated-calf-raise"],
  },
  {
    slug: "adductors",
    muscle: "adductors",
    parent: "legs",
    label: "Adductors",
    h1: "Adductor Exercises",
    title: "Adductor Exercises: Inner Thigh | LiftCamp",
    description: (n) =>
      `${n} adductor exercises with instructions, equipment and difficulty. Inner thigh work from sumo deadlifts and the adductor machine.`,
    intro: [
      "Adductors are the inner thigh. They pull your legs together and steady your knees in squats and lunges.",
      "Sumo deadlifts and wide-stance squats train them without a machine. The adductor machine isolates them, and the lightest plate or two is enough to start.",
    ],
    start: ["sumo-deadlift"],
  },
  {
    slug: "abductors",
    muscle: "abductors",
    parent: "legs",
    label: "Abductors",
    h1: "Abductor Exercises",
    title: "Abductor Exercises: Outer Hip and Glute Medius | LiftCamp",
    description: (n) =>
      `${n} abductor exercises with instructions, equipment and difficulty. Outer hip work from single-leg exercises, the abductor machine and banded walks.`,
    intro: [
      "Abductors are the outer hip, mostly the glute medius. They move your leg out to the side and keep your knee from caving in on squats and lunges.",
      "Single-leg work trains them with no machine. The abductor machine and banded side steps isolate them, and both start light.",
    ],
    start: ["bulgarian-split-squat", "bodyweight-walking-lunge"],
  },
  {
    slug: "abs",
    muscle: "abs",
    parent: "core",
    label: "Abs",
    h1: "Ab Exercises",
    title: "Ab Exercises: Planks, Crunches and Leg Raises | LiftCamp",
    description: (n) =>
      `${n} ab exercises with instructions, equipment and difficulty. How long to plank on day one, the cable crunch weight, and when hanging leg raises are ready.`,
    intro: [
      "Abs flex your trunk and, during a squat or deadlift, keep it from bending. Heavy compound lifts train them more than most people expect.",
      "Start with a plank for 20 to 30 seconds in three sets, and a cable crunch at 30 to 40 lb. Hanging leg raises come once you can hang from the bar long enough to do them with your knees tucked.",
    ],
    start: ["plank", "cable-crunch", "hanging-leg-raise"],
  },
];

export const SUBMUSCLE_PAGES: Readonly<Record<string, SubmusclePage>> = Object.fromEntries(
  PAGES.map((p) => [p.slug, p]),
);

const BY_MUSCLE: ReadonlyMap<string, SubmusclePage> = new Map(PAGES.map((p) => [p.muscle, p]));

export function isSubmusclePageSlug(v: string | null | undefined): boolean {
  return !!v && v in SUBMUSCLE_PAGES;
}

/** The page for a canonical muscle, or undefined for chest, shoulders and neck. */
export function submusclePageFor(muscle: string | null | undefined): SubmusclePage | undefined {
  return muscle ? BY_MUSCLE.get(muscle) : undefined;
}

/** Sub-muscle pages whose breadcrumb parent is `region`, in hub section order. */
export function submusclePagesIn(region: Region): SubmusclePage[] {
  return PAGES.filter((p) => p.parent === region);
}

/** Every page, in table order. */
export function submusclePages(): readonly SubmusclePage[] {
  return PAGES;
}
