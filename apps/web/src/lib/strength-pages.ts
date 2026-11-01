// Strength standards pages: /strength-standards and one page per lift.
//
// The seven lifts are the ones that show a strength level in the app
// (STRENGTH_EXERCISES in packages/shared). Every threshold on these pages is
// computed from the shared table at render time, so the copy never carries a
// number of its own: the functions below fill the templates.
//
// The MCP strength_level tool reads `STRENGTH_PAGES` for its closing link and
// `LOAD_NOTE` for the line under its table.

import {
  convertWeight,
  roundLoadNearest,
  STRENGTH_STANDARDS,
  strengthThresholds,
  type StrengthSex,
  type WeightUnit,
} from "@liftcamp/shared";

export type StrengthPage = {
  /** URL slug under /strength-standards. */
  slug: string;
  exerciseId: string;
  /** The exercise detail page's slug, for the link card and og:image. */
  exerciseSlug: string;
  /** Sentence case, e.g. "Bench press". */
  name: string;
  h1: string;
  title: string;
  /** The second intro paragraph; the first is the shared template. */
  intro2: string;
  /** The beginner question. Its answer is the shared template. */
  beginnerQ: string;
  q2: { q: string; a: string };
};

const PAGES: readonly StrengthPage[] = [
  {
    slug: "bench-press",
    exerciseId: "d5f93fa3-b43b-4306-8081-ee5bff0d4ca6",
    exerciseSlug: "barbell-bench-press",
    name: "Bench press",
    h1: "Bench Press Standards",
    title: "Bench Press Standards: How Much Should You Bench? | LiftCamp",
    intro2:
      "Most people start under Novice, and that's the normal place to be in your first few months. The empty bar weighs 45 lb (20 kg), and pressing it for a few weeks before adding plates is a fine start.",
    beginnerQ: "How much should a beginner bench?",
    q2: {
      q: "Is a bodyweight bench press good?",
      a: "Yes. At an average bodyweight, benching your own weight is around the start of Intermediate for men and around Advanced for women.",
    },
  },
  {
    slug: "squat",
    exerciseId: "85495e85-bd72-445d-a6c8-5961f17ec2e5",
    exerciseSlug: "barbell-squat",
    name: "Squat",
    h1: "Squat Standards",
    title: "Squat Standards: How Much Should You Squat? | LiftCamp",
    intro2:
      "The numbers are for a barbell back squat to at least parallel, bar included. Goblet squats and dumbbell squats count as training, and they're a good way in, but they aren't on this table.",
    beginnerQ: "How much should a beginner squat?",
    q2: {
      q: "Is a bodyweight squat good?",
      a: "At an average bodyweight, squatting your own weight is around the start of Novice for men and around the start of Intermediate for women.",
    },
  },
  {
    slug: "deadlift",
    exerciseId: "034ebb98-56b3-4073-a726-1709d14b4455",
    exerciseSlug: "barbell-deadlift",
    name: "Deadlift",
    h1: "Deadlift Standards",
    title: "Deadlift Standards: How Much Should You Deadlift? | LiftCamp",
    intro2:
      "The deadlift has the biggest numbers of any lift here, so compare it with other people's deadlifts and leave your squat and bench out of it. The weight is the whole bar plus plates, pulled from the floor.",
    beginnerQ: "How much should a beginner deadlift?",
    q2: {
      q: "Is a 2x bodyweight deadlift good?",
      a: "Yes. At an average bodyweight, pulling twice your weight is solidly Intermediate for men and Advanced for women.",
    },
  },
  {
    slug: "overhead-press",
    exerciseId: "83e390eb-2f53-427e-8870-2997eb172279",
    exerciseSlug: "standing-military-press",
    name: "Overhead press",
    h1: "Overhead Press Standards",
    title: "Overhead Press Standards: How Much Should You Press? | LiftCamp",
    intro2:
      "This is the standing barbell press, also called the military press, from your shoulders to locked out overhead. It has the smallest numbers of the main lifts, so small jumps of 2.5 lb a side are normal.",
    beginnerQ: "How much should a beginner overhead press?",
    q2: {
      q: "Why is my overhead press so much lower than my bench?",
      a: "Pressing overhead uses smaller muscles and a longer path. On this table the overhead press is roughly two thirds of the bench press at each level.",
    },
  },
  {
    slug: "barbell-row",
    exerciseId: "7492d613-b2ff-41c0-9131-af0bb9832438",
    exerciseSlug: "bent-over-barbell-row",
    name: "Barbell row",
    h1: "Barbell Row Standards",
    title: "Barbell Row Standards by Bodyweight | LiftCamp",
    intro2:
      "This is the bent-over barbell row with your torso close to parallel to the floor. Standing more upright lets you row more weight, so numbers from an upright row will read high here.",
    beginnerQ: "What's a good barbell row for a beginner?",
    q2: {
      q: "How should my row compare to my bench?",
      a: "On this table the barbell row is a little under the bench press, roughly 70 to 90% of it at each level.",
    },
  },
  {
    slug: "romanian-deadlift",
    exerciseId: "21e9e394-1151-4a07-bb3a-2fd487e461dd",
    exerciseSlug: "romanian-deadlift",
    name: "Romanian deadlift",
    h1: "Romanian Deadlift Standards",
    title: "Romanian Deadlift Standards by Bodyweight | LiftCamp",
    intro2:
      "The Romanian deadlift starts standing and lowers the bar to about mid-shin with soft knees, so its numbers sit below the deadlift. The table puts it at about three quarters of the deadlift at every level.",
    beginnerQ: "What's a good Romanian deadlift for a beginner?",
    q2: {
      q: "Should my Romanian deadlift be as heavy as my deadlift?",
      a: "No. It stops short of the floor and keeps the work on your hamstrings, so expect about three quarters of your deadlift.",
    },
  },
  {
    slug: "lat-pulldown",
    exerciseId: "653288a1-8c39-4840-a2bc-c6eb64790c82",
    exerciseSlug: "wide-grip-lat-pulldown",
    name: "Lat pulldown",
    h1: "Lat Pulldown Standards",
    title: "Lat Pulldown Standards by Bodyweight | LiftCamp",
    intro2:
      "The weight is the number on the stack. Stacks differ between machines and brands, so treat your level here as a rough guide and compare against yourself on the same machine.",
    beginnerQ: "What's a good lat pulldown for a beginner?",
    q2: {
      q: "Is pulling my bodyweight on the pulldown good?",
      a: "Yes. At an average bodyweight it's past Intermediate for men and around the start of Elite for women. Stacks vary, so take it as a rough read.",
    },
  },
];

export const STRENGTH_PAGES: Readonly<Record<string, StrengthPage>> = Object.fromEntries(
  PAGES.map((p) => [p.slug, p]),
);

const BY_EXERCISE_ID: ReadonlyMap<string, StrengthPage> = new Map(
  PAGES.map((p) => [p.exerciseId, p]),
);

/** Every lift page, in table order. */
export function strengthPages(): readonly StrengthPage[] {
  return PAGES;
}

/** The page for an exercise id, or undefined when the exercise has none. */
export function strengthPageForExercise(
  exerciseId: string | null | undefined,
): StrengthPage | undefined {
  return exerciseId ? BY_EXERCISE_ID.get(exerciseId) : undefined;
}

/** What the logged weight is, by the standard's `load`. */
export const LOAD_NOTE = {
  bar: "The weight is the whole bar, plates included.",
  stack: "The weight is the number on the stack.",
  "one dumbbell": "The weight is one dumbbell.",
} as const;

export function loadNoteFor(page: StrengthPage): string {
  const load = STRENGTH_STANDARDS[page.exerciseId]?.load ?? "bar";
  return LOAD_NOTE[load];
}

// ---------------------------------------------------------------------------
// Reference lifters and table rows
// ---------------------------------------------------------------------------

/** The two lifters the copy quotes: a 180 lb man and a 140 lb woman. In kg
 *  mode the hub's summary table uses 82 kg and 64 kg. */
export const REFERENCE_LIFTER: Record<StrengthSex, Record<WeightUnit, number>> = {
  male: { lb: 180, kg: 82 },
  female: { lb: 140, kg: 64 },
};

/** Table rows, by sex and unit. */
export const TABLE_BODYWEIGHTS: Record<StrengthSex, Record<WeightUnit, readonly number[]>> = {
  male: { lb: range(120, 280, 20), kg: range(55, 125, 10) },
  female: { lb: range(100, 240, 20), kg: range(45, 105, 10) },
};

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
}

/** The row closest to `bodyweight`, or null with no bodyweight. A tie goes to
 *  the lighter row. */
export function closestBodyweight(
  rows: readonly number[],
  bodyweight: number | null,
): number | null {
  if (bodyweight == null || !Number.isFinite(bodyweight) || rows.length === 0) return null;
  let best = rows[0]!;
  for (const r of rows) if (Math.abs(r - bodyweight) < Math.abs(best - bodyweight)) best = r;
  return best;
}

/**
 * A threshold for the reference lifter as copy writes it, "135 lb (60 kg)":
 * the exact threshold for a 180 lb man (or 140 lb woman), rounded to the
 * display step in each unit on its own.
 */
export function referenceLoad(exerciseId: string, sex: StrengthSex, level: number): string {
  const t = strengthThresholds(
    exerciseId,
    sex,
    convertWeight(REFERENCE_LIFTER[sex].lb, "lb", "kg"),
    null,
  );
  if (!t) return "";
  const kg = t[level]!;
  const lb = roundLoadNearest(convertWeight(kg, "kg", "lb"), "lb");
  return `${lb} lb (${formatNumber(roundLoadNearest(kg, "kg"))} kg)`;
}

/** 62.5 stays 62.5; 60 prints as 60. */
export function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

export const LEVEL_MEANINGS: readonly { level: string; text: string }[] = [
  { level: "Beginner", text: "Under Novice. Where nearly everyone starts." },
  { level: "Novice", text: "A few months of steady training, usually 2 or 3 days a week." },
  { level: "Intermediate", text: "Usually a year or more of training with a plan." },
  { level: "Advanced", text: "Years of focused training." },
  { level: "Elite", text: "Competitive lifters. Few people reach it on any lift." },
];

export type FaqItem = { q: string; a: string };

const SHARED_FAQ: readonly FaqItem[] = [
  {
    q: "Do I need to test my 1-rep max?",
    a: "No. Put in any recent set of 1 to 12 reps and the calculator estimates your max with the Epley formula. Sets under 10 reps give the closest estimate.",
  },
  {
    q: "Where do these numbers come from?",
    a: "They're LiftCamp's own standards, set as multiples of bodyweight and scaled so heavier lifters need a little less per pound. They match the level the LiftCamp app shows on each lift. Other sites use different tables, so your level may differ by a step between them.",
  },
];

export const CTA_HEADING = "Track your level as you lift";
export const CTA_BODY =
  "The free LiftCamp app shows your strength level on all 7 of these lifts and how far you are from the next one, updated every time you log a set. Free on iPhone.";

const lower = (p: StrengthPage) => p.name.toLowerCase();

export function liftIntro1(p: StrengthPage): string {
  return `These are the ${lower(p)} numbers for each of LiftCamp's 5 levels, from Beginner to Elite, at your bodyweight. Put in a recent set and the calculator places you on the scale and shows how far it is to the next level.`;
}

export function liftAnswer(p: StrengthPage): string {
  const m = (i: number) => referenceLoad(p.exerciseId, "male", i);
  const f = (i: number) => referenceLoad(p.exerciseId, "female", i);
  return `For a 180 lb (82 kg) man, a Novice ${lower(p)} starts at ${m(0)} and Intermediate at ${m(1)}. For a 140 lb (64 kg) woman, Novice starts at ${f(0)} and Intermediate at ${f(1)}. Anything under Novice is Beginner, where nearly everyone starts.`;
}

export function liftDescription(p: StrengthPage): string {
  return `${p.name} standards for men and women at every bodyweight, from Beginner to Elite. Free calculator that estimates your max from any set and shows your next level.`;
}

/** "Bench Press standards for men": the H1 without "Standards". */
export function tableHeading(p: StrengthPage, sex: StrengthSex): string {
  return `${p.h1.replace(/ Standards$/, "")} standards for ${sex === "male" ? "men" : "women"}`;
}

export function liftFaq(p: StrengthPage): FaqItem[] {
  return [
    {
      q: p.beginnerQ,
      a: `For a 180 lb man, anything under ${referenceLoad(p.exerciseId, "male", 0)} is Beginner. For a 140 lb woman, it's anything under ${referenceLoad(p.exerciseId, "female", 0)}. In your first few months, pick a weight you can lift for 10 clean reps and add a little when every set hits its reps.`,
    },
    p.q2,
    ...SHARED_FAQ,
  ];
}

export const HUB = {
  title: "Strength Standards for Beginners: How Much Should You Lift? | LiftCamp",
  description:
    "Strength standards for bench, squat, deadlift, overhead press and 3 more lifts, for men and women at every bodyweight. Free calculator with your level and the next one.",
  h1: "Strength Standards",
  intro: [
    "How much should you lift? These tables show where each of LiftCamp's 5 levels starts on 7 lifts, for men and women at your bodyweight. Pick a lift, put in a recent set, and the calculator shows your level and how far it is to the next.",
    "Almost everyone starts at Beginner. Novice is a fair goal for your first 6 months, and moving up one level on any lift is real progress.",
  ] as const,
  faq: [
    {
      q: "What's a good strength level for a beginner?",
      a: "Beginner is where nearly everyone starts, and Novice is a fair goal for your first 6 months. Pick one lift you care about and watch it move up a level.",
    },
    ...SHARED_FAQ,
    {
      q: "Does age change my level?",
      a: "Yes, a little. The tables assume ages 18 to 39. From 40 the thresholds drop 5%, and they drop further each decade after that. Under 18 they're 15% lower. Add your age in the calculator and it adjusts.",
    },
  ] as readonly FaqItem[],
};

/** The line under the lift page's tables. */
export const AGE_NOTE = "Ages 18 to 39. The calculator adjusts for your age.";

/** The share text for a result. */
export function shareText(p: StrengthPage, level: string): string {
  return `I'm ${level} on the ${lower(p)}. See where you stand on LiftCamp.`;
}
