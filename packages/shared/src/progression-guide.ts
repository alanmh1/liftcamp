import {
  DUMBBELL_LADDER_KG,
  DUMBBELL_LADDER_LB,
  PROGRESSION_RULES,
  loadRuleFor,
  type Ladder,
  type LoadRule,
} from "./progression";
import type { WeightUnit } from "./units";

/**
 * The "How progression works" guide, built from the same rules the engine
 * uses, so its numbers cannot drift from what the app suggests. Static:
 * nothing here needs the network. Free to read.
 */

export type GuideStep = { label: string; detail: string | null; value: string };

export type GuideSection = {
  title: string;
  paragraphs: string[];
  /** The weight steps table, in "Then add weight" only. */
  steps?: GuideStep[];
  /** Paragraphs after the table. */
  after?: string[];
};

function unitLabel(unit: WeightUnit): string {
  return unit === "kg" ? "kg" : "lbs";
}

function stepOf(rule: LoadRule): number {
  return rule.kind === "linear" || rule.kind === "bodyweight" ? rule.step : 0;
}

function ladderText(ladder: Ladder, unit: WeightUnit): string {
  return `${ladder.values.join(", ")}, then every ${ladder.then} ${unitLabel(unit)}`;
}

const base = { id: "guide", weight_type: "standard", mechanic: "compound", primary_muscle: "chest" };

export function progressionGuide(unit: WeightUnit): GuideSection[] {
  const u = unitLabel(unit);
  const range = PROGRESSION_RULES.defaultRange;
  const low = range.kind === "range" ? range.low : 8;
  const high = range.kind === "range" ? range.high : 12;
  const barbell = stepOf(loadRuleFor({ ...base, equipment: "barbell" }, unit));
  const lowerBody = stepOf(loadRuleFor({ ...base, equipment: "barbell", primary_muscle: "quads" }, unit));
  const machine = stepOf(loadRuleFor({ ...base, equipment: "machine" }, unit));
  const cable = stepOf(loadRuleFor({ ...base, equipment: "cable" }, unit));
  const assist = stepOf(loadRuleFor({ ...base, equipment: "body only", weight_type: "bodyweight" }, unit));
  const ladder = unit === "kg" ? DUMBBELL_LADDER_KG : DUMBBELL_LADDER_LB;
  const misses = PROGRESSION_RULES.deloadAfterMisses;
  const percent = Math.round((1 - PROGRESSION_RULES.deloadFactor) * 100);
  const weeks = Math.round(PROGRESSION_RULES.layoffDays / 7);

  return [
    {
      title: "Your rep range",
      paragraphs: [
        `Each exercise has a rep range, like ${low} to ${high}. Your routine sets it. With no routine, LiftCamp uses ${low} to ${high}.`,
        "The bottom number is the least to aim for on each set. The top number is when you have earned more weight.",
      ],
    },
    {
      title: "Add reps first",
      paragraphs: [
        "Keep the same weight as last time and try for one more rep on each set.",
        "When every set reaches the top of the range, the weight goes up next time.",
      ],
    },
    {
      title: "Then add weight",
      paragraphs: [
        "The weight goes up by the smallest step your equipment allows, and the reps start again at the bottom of the range.",
      ],
      steps: [
        { label: "Barbell", detail: null, value: `+${barbell} ${u}` },
        { label: "Barbell, lower body", detail: "Squat, deadlift, hip thrust", value: `+${lowerBody} ${u}` },
        { label: "Dumbbell", detail: ladderText(ladder, unit), value: "Next size up" },
        { label: "Machine", detail: null, value: `+${machine} ${u}` },
        { label: "Cable", detail: null, value: `+${cable} ${u}` },
      ],
      after: [
        `Bodyweight exercises like push-ups add reps instead. On an assisted machine, the help comes down ${assist} ${u} at a time.`,
      ],
    },
    {
      title: "Missed reps",
      paragraphs: [
        "If a set falls short of the bottom of the range, keep the same weight next time and aim for the bottom number on every set.",
        `Miss ${misses} sessions in a row at the same weight and LiftCamp suggests a lighter one, about ${percent}% less. That is a deload. You build back up from there.`,
        "A session you cut short, with sets left unticked, does not count as a miss.",
      ],
    },
    {
      title: "Coming back after a break",
      paragraphs: [
        `If it has been more than ${weeks} weeks since you last did an exercise, LiftCamp repeats your last session before adding anything.`,
      ],
    },
  ];
}
