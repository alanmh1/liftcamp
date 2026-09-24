/**
 * Presentation-layer prescription for the public routine pages.
 *
 * `templates` carries `level`, `days_per_week` and `equipment`, and
 * `template_exercises` carries `target_sets` and `target_reps`. Those columns
 * are the source of truth and every system routine has them filled in. The
 * heuristics here are the fallback for a template that left them null: sets
 * and reps derived from what the movement is (heavy compounds get fewer reps
 * and longer rest, isolation work gets more reps and less), and difficulty
 * derived from the program slug or the day count.
 */

import { formatEquipmentLabel, templateLevelLabel } from "@liftcamp/shared";

export type Prescription = {
  sets: number;
  /** Display range, e.g. "8-12". */
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
  if (kind === "heavy") return { sets: 3, reps: "5-8", restSec: 150, kind };
  if (kind === "compound") return { sets: 3, reps: "8-12", restSec: 105, kind };
  return { sets: 3, reps: "10-15", restSec: 60, kind };
}

export type SetTarget = { sets: number | null; reps: string | null };

/** The stored target where it exists, the name heuristic for whichever half
 *  is null. Rest always comes from the heuristic; nothing stores it. */
export function prescribeWithTarget(name: string, target: SetTarget | null | undefined): Prescription {
  const p = prescribe(name);
  const sets = target?.sets != null && target.sets > 0 ? target.sets : p.sets;
  const reps = target?.reps?.trim() || p.reps;
  return { ...p, sets, reps };
}

const WORK_SEC_PER_SET = 40;
const WARMUP_SEC = 6 * 60;

/** Rough session length in minutes, rounded to the nearest five. Deliberately
 *  a single number rather than a range: "~50 min" sets an expectation, a range
 *  makes the reader do the arithmetic. */
export function estimateMinutes(prescriptions: Prescription[]): number {
  const seconds = prescriptions.reduce(
    (total, p) => total + p.sets * (WORK_SEC_PER_SET + p.restSec),
    WARMUP_SEC,
  );
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

/** `templates.level` when set ("beginner" reads as Beginner), otherwise the
 *  authored or day-count guess. */
export function resolveDifficulty(
  level: string | null | undefined,
  slug: string,
  daysPerWeek: number,
): string {
  return templateLevelLabel(level) ?? routineDifficulty(slug, daysPerWeek);
}

export const DIFFICULTY_ORDER: RoutineDifficulty[] = ["Beginner", "Intermediate", "Advanced"];

/** Difficulty pills: green for beginner, gold for intermediate, red for
 *  advanced. Uses the same semantic chip tokens as the rest of the app so the
 *  colours adapt in dark mode. */
export function difficultyClass(level: string): string {
  if (level === "Beginner") return "bg-chip-green-bg text-chip-green-fg";
  if (level === "Intermediate") return "bg-chip-gold-bg text-chip-gold-fg";
  if (level === "Advanced") return "bg-chip-coral-bg text-chip-coral-fg";
  return "bg-muted text-muted-foreground";
}

// ---------------------------------------------------------------------------
// Equipment, for the index filters and the card meta line
// ---------------------------------------------------------------------------

/** Chip order on /routines. `templates.equipment` supplies the first four
 *  ("bodyweight", "bands", "dumbbells", "gym"); the rest come from the
 *  per-exercise fallback below. */
export const EQUIPMENT_FILTER_ORDER = [
  "Bodyweight",
  "Bands",
  "Dumbbells",
  "Barbell",
  "Machines",
  "Cables",
  "Gym",
] as const;

/** `templates.equipment` as a chip label, or null when the column is empty. */
export function templateEquipmentLabel(equipment: string | null | undefined): string | null {
  const label = formatEquipmentLabel(equipment);
  return label || null;
}

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
