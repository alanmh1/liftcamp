/**
 * Presentation-layer prescription for the public routine pages.
 *
 * `template_exercises` stores order only — there is no sets/reps column, and
 * adding one would mean authoring numbers for every row of every system
 * routine. What the pages need is the honest beginner default that the guides
 * already recommend, derived from what the movement is: heavy compounds get
 * fewer reps and longer rest, isolation work gets more reps and less. The
 * numbers are therefore computed here, in one place, rather than stored.
 */

export type Prescription = {
  sets: number;
  /** Display range, e.g. "8–12". */
  reps: string;
  /** Rest between sets, seconds. Feeds the session-length estimate. */
  restSec: number;
  kind: "heavy" | "compound" | "isolation";
};

/** Barbell/bodyweight movements that carry the session. Matched on the name so
 *  a "Barbell Bench Press" and a "Dumbbell Bench Press" both read as presses. */
const HEAVY = [
  "squat",
  "deadlift",
  "bench press",
  "overhead press",
  "military press",
  "hip thrust",
  "romanian",
  "power clean",
  "front squat",
];

const COMPOUND = [
  "press",
  "row",
  "pull-up",
  "pullup",
  "chin-up",
  "chinup",
  "pulldown",
  "dip",
  "lunge",
  "split squat",
  "leg press",
  "push-up",
  "pushup",
  "step-up",
];

function classify(name: string): Prescription["kind"] {
  const n = name.toLowerCase();
  if (HEAVY.some((k) => n.includes(k))) return "heavy";
  if (COMPOUND.some((k) => n.includes(k))) return "compound";
  return "isolation";
}

export function prescribe(name: string): Prescription {
  const kind = classify(name);
  if (kind === "heavy") return { sets: 3, reps: "5–8", restSec: 150, kind };
  if (kind === "compound") return { sets: 3, reps: "8–12", restSec: 105, kind };
  return { sets: 3, reps: "10–15", restSec: 60, kind };
}

const WORK_SEC_PER_SET = 40;
const WARMUP_SEC = 6 * 60;

/** Rough session length in minutes, rounded to the nearest five. Deliberately
 *  a single number rather than a range: "~50 min" sets an expectation, a range
 *  makes the reader do the arithmetic. */
export function estimateMinutes(names: string[]): number {
  const seconds = names.reduce((total, name) => {
    const p = prescribe(name);
    return total + p.sets * (WORK_SEC_PER_SET + p.restSec);
  }, WARMUP_SEC);
  return Math.max(15, Math.round(seconds / 60 / 5) * 5);
}

// ---------------------------------------------------------------------------
// Difficulty
// ---------------------------------------------------------------------------

export type RoutineDifficulty = "Beginner" | "Intermediate" | "Advanced";

/** Authored where the honest answer is not the one the day count implies:
 *  PPL runs on three days but asks more of you than full body, and the
 *  machine/dumbbell plans are gentler than their schedules suggest. */
const AUTHORED: Record<string, RoutineDifficulty> = {
  "full-body-3-day": "Beginner",
  "machines-only-workout": "Beginner",
  "dumbbell-only-workout": "Beginner",
  "bodyweight-workout-plan": "Beginner",
  "upper-lower-split": "Intermediate",
  "push-pull-legs": "Intermediate",
  "glute-workout-plan": "Intermediate",
  "5x5-strength": "Intermediate",
  "bro-split": "Advanced",
  "push-pull-legs-6-day": "Advanced",
  "arnold-split": "Advanced",
};

export function routineDifficulty(slug: string, dayCount: number): RoutineDifficulty {
  return AUTHORED[slug] ?? (dayCount <= 3 ? "Beginner" : dayCount <= 4 ? "Intermediate" : "Advanced");
}

export const DIFFICULTY_ORDER: RoutineDifficulty[] = ["Beginner", "Intermediate", "Advanced"];

/** Muted pill colours, one per level. Tokens rather than raw colours so the
 *  pills follow the theme like everything else on these pages. */
export function difficultyClass(level: RoutineDifficulty): string {
  if (level === "Beginner") return "bg-primary/10 text-primary";
  if (level === "Intermediate") return "bg-accent text-accent-foreground";
  return "bg-muted text-muted-foreground";
}

// ---------------------------------------------------------------------------
// Equipment grouping, for the index filters
// ---------------------------------------------------------------------------

export type EquipmentGroup = "Bodyweight" | "Dumbbells" | "Barbell" | "Machines" | "Cables";

export function equipmentGroup(equipment: string | null | undefined): EquipmentGroup | null {
  if (!equipment) return null;
  const k = equipment.toLowerCase();
  if (k.includes("body") || k.includes("band")) return "Bodyweight";
  if (k.includes("dumbbell") || k.includes("kettlebell")) return "Dumbbells";
  if (k.includes("cable")) return "Cables";
  if (k.includes("machine") || k.includes("smith")) return "Machines";
  if (k.includes("bar")) return "Barbell";
  return null;
}
