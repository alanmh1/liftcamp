import type { WeightUnit } from "./units";

/**
 * Strength levels: where an estimated max sits against LiftCamp's own
 * standards, for a lifter of a given sex, bodyweight and age.
 *
 * The table is LiftCamp's, written for this app, not copied from any
 * published standard. Everything here works in kg; the screen converts to
 * and from the user's unit.
 */

export const STRENGTH_LEVELS = ["Beginner", "Novice", "Intermediate", "Advanced", "Elite"] as const;
export type StrengthLevelName = (typeof STRENGTH_LEVELS)[number];

export type StrengthSex = "male" | "female";

/** The bodyweight each multiple is written for. */
export const REFERENCE_BODYWEIGHT_KG: Record<StrengthSex, number> = { male: 80, female: 65 };

/**
 * Heavier lifters lift more in total but less per kg of bodyweight, so the
 * thresholds scale with bodyweight to this power rather than linearly.
 */
export const BODYWEIGHT_EXPONENT = 0.67;

type Multiples = readonly [novice: number, intermediate: number, advanced: number, elite: number];

type Standard = {
  name: string;
  /** What the logged weight is: the whole bar, the stack, or one dumbbell. */
  load: "bar" | "stack" | "one dumbbell";
  male: Multiples;
  female: Multiples;
};

/**
 * Multiples of bodyweight at which each level starts, at the reference
 * bodyweight. Below Novice is Beginner.
 */
export const STRENGTH_STANDARDS: Record<string, Standard> = {
  "85495e85-bd72-445d-a6c8-5961f17ec2e5": {
    name: "Barbell Squat",
    load: "bar",
    male: [1.0, 1.5, 2.0, 2.5],
    female: [0.65, 1.0, 1.5, 1.9],
  },
  "d5f93fa3-b43b-4306-8081-ee5bff0d4ca6": {
    name: "Barbell Bench Press",
    load: "bar",
    male: [0.75, 1.0, 1.5, 2.0],
    female: [0.4, 0.65, 0.9, 1.2],
  },
  "034ebb98-56b3-4073-a726-1709d14b4455": {
    name: "Barbell Deadlift",
    load: "bar",
    male: [1.25, 1.75, 2.5, 3.0],
    female: [0.9, 1.25, 1.75, 2.25],
  },
  "83e390eb-2f53-427e-8870-2997eb172279": {
    name: "Standing Military Press",
    load: "bar",
    male: [0.5, 0.7, 0.9, 1.15],
    female: [0.3, 0.45, 0.6, 0.8],
  },
  "7492d613-b2ff-41c0-9131-af0bb9832438": {
    name: "Bent Over Barbell Row",
    load: "bar",
    male: [0.6, 0.85, 1.1, 1.4],
    female: [0.35, 0.55, 0.75, 1.0],
  },
  "21e9e394-1151-4a07-bb3a-2fd487e461dd": {
    name: "Romanian Deadlift",
    load: "bar",
    male: [0.9, 1.3, 1.8, 2.3],
    female: [0.6, 0.9, 1.3, 1.7],
  },
  "653288a1-8c39-4840-a2bc-c6eb64790c82": {
    name: "Wide-Grip Lat Pulldown",
    load: "stack",
    male: [0.65, 0.9, 1.15, 1.45],
    female: [0.4, 0.6, 0.8, 1.0],
  },
  "05510482-9385-455f-85b4-96aef279939c": {
    name: "Dumbbell Bench Press",
    load: "one dumbbell",
    male: [0.3, 0.45, 0.6, 0.8],
    female: [0.15, 0.25, 0.35, 0.48],
  },
  "6db0743b-b1be-4071-b663-af358c7f47bb": {
    name: "Dumbbell Shoulder Press",
    load: "one dumbbell",
    male: [0.2, 0.3, 0.4, 0.52],
    female: [0.1, 0.16, 0.23, 0.31],
  },
};

/**
 * The exercises that show a strength level. The two dumbbell presses have
 * standards above but are off until dumbbell logging is unambiguous: users
 * have logged both dumbbells together as well as one, and the standards
 * assume one, so a level there could be double the truth.
 */
export const STRENGTH_EXERCISES: readonly string[] = [
  "85495e85-bd72-445d-a6c8-5961f17ec2e5", // Barbell Squat
  "d5f93fa3-b43b-4306-8081-ee5bff0d4ca6", // Barbell Bench Press
  "034ebb98-56b3-4073-a726-1709d14b4455", // Barbell Deadlift
  "83e390eb-2f53-427e-8870-2997eb172279", // Standing Military Press
  "7492d613-b2ff-41c0-9131-af0bb9832438", // Bent Over Barbell Row
  "21e9e394-1151-4a07-bb3a-2fd487e461dd", // Romanian Deadlift
  "653288a1-8c39-4840-a2bc-c6eb64790c82", // Wide-Grip Lat Pulldown
];

export function hasStrengthLevel(exerciseId: string): boolean {
  return STRENGTH_EXERCISES.includes(exerciseId);
}

/** Every threshold is multiplied by this for the lifter's age. Null age is 1. */
export function ageFactor(age: number | null): number {
  if (age == null) return 1;
  if (age < 18) return 0.85;
  if (age < 40) return 1;
  if (age < 50) return 0.95;
  if (age < 60) return 0.87;
  if (age < 70) return 0.78;
  return 0.7;
}

/** Current year minus birth year. Null birth year gives null. */
export function ageFromBirthYear(birthYear: number | null, now = new Date()): number | null {
  return birthYear == null ? null : now.getFullYear() - birthYear;
}

/** Novice, Intermediate, Advanced and Elite start at these, in kg. */
export type StrengthThresholds = readonly [number, number, number, number];

/**
 * The four thresholds in kg for this lifter, or null when the exercise has
 * no level or sex is anything other than `male` or `female`.
 */
export function strengthThresholds(
  exerciseId: string,
  sex: string | null,
  bodyweightKg: number,
  age: number | null,
): StrengthThresholds | null {
  if (!hasStrengthLevel(exerciseId)) return null;
  if (sex !== "male" && sex !== "female") return null;
  if (!Number.isFinite(bodyweightKg) || bodyweightKg <= 0) return null;
  const standard = STRENGTH_STANDARDS[exerciseId];
  if (!standard) return null;
  const ref = REFERENCE_BODYWEIGHT_KG[sex];
  const scale = ref * Math.pow(bodyweightKg / ref, BODYWEIGHT_EXPONENT) * ageFactor(age);
  const [n, i, a, e] = standard[sex];
  return [n * scale, i * scale, a * scale, e * scale];
}

export type StrengthLevel = {
  level: StrengthLevelName;
  /** 0 for Beginner up to 4 for Elite. */
  index: number;
  /** The next level's name. Null at Elite. */
  next: StrengthLevelName | null;
  /** Kg still needed to reach `next`. Null at Elite. */
  toNext: number | null;
};

/** Reaching a threshold exactly counts as reaching the level. */
export function strengthLevel(estimatedMaxKg: number, thresholds: StrengthThresholds): StrengthLevel {
  let index = 0;
  for (const t of thresholds) {
    if (estimatedMaxKg >= t) index += 1;
  }
  if (index >= thresholds.length) {
    return { level: STRENGTH_LEVELS[index], index, next: null, toNext: null };
  }
  return {
    level: STRENGTH_LEVELS[index],
    index,
    next: STRENGTH_LEVELS[index + 1],
    toNext: thresholds[index] - estimatedMaxKg,
  };
}

/**
 * Where the marker sits on a bar of five equal segments, from 0 to 1.
 * Beginner runs from 0 to Novice; inside a segment the marker sits
 * proportionally between its two thresholds; Elite fills its segment.
 */
export function strengthBarPosition(estimatedMaxKg: number, thresholds: StrengthThresholds): number {
  const segments = STRENGTH_LEVELS.length;
  const { index } = strengthLevel(estimatedMaxKg, thresholds);
  if (index >= thresholds.length) return 1;
  const lower = index === 0 ? 0 : thresholds[index - 1];
  const upper = thresholds[index];
  const within = upper > lower ? Math.min(1, Math.max(0, (estimatedMaxKg - lower) / (upper - lower))) : 0;
  return (index + within) / segments;
}

/** The step loads are shown in: 5 lbs or 2.5 kg. */
export function loadStep(unit: WeightUnit): number {
  return unit === "kg" ? 2.5 : 5;
}

/** A threshold for display, to the nearest step. */
export function roundLoadNearest(value: number, unit: WeightUnit): number {
  const step = loadStep(unit);
  return Math.round(value / step) * step;
}

/** A gap for display, up to the next step, so it is never short. */
export function roundLoadUp(value: number, unit: WeightUnit): number {
  const step = loadStep(unit);
  // The epsilon keeps a gap of exactly 25 from floating up to 30.
  return Math.ceil(value / step - 1e-9) * step;
}
