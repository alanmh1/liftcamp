import { CANONICAL_SLUG_OVERRIDES } from "./muscle-regions";

// Which guides cover which exercises. Guides are static components with no
// related-exercise field, so the link between the two lives here, by hand.
// It drives two things: the "Guides" section on /exercises/<slug>, and the
// "Exercises in this guide" list at the foot of each mapped guide.
//
// Every slug below was checked against the live exercises table on
// 1 Nov 2026. A slug that stops existing simply drops out: both sides only
// render rows found in the catalog.

/** A list of exercise slugs, every exercise with one equipment value, or
 *  every indexable exercise (one with a beginner_notes row). */
export type GuideExerciseRule =
  | { kind: "slugs"; slugs: readonly string[] }
  | { kind: "equipment"; value: string; hub: string }
  | { kind: "indexed" };

export const GUIDE_EXERCISES: Readonly<Record<string, GuideExerciseRule>> = {
  "leg-press-setup": { kind: "slugs", slugs: ["leg-press"] },
  // 28 rows in Nov 2026, so the guide lists the authored one first and
  // sends the rest to the equipment hub.
  "smith-machine-bar-weight": {
    kind: "equipment",
    value: "smith machine",
    hub: "smith-machine",
  },
  "what-is-an-ez-bar": { kind: "slugs", slugs: ["ez-bar-curl"] },
  "farmers-walk-at-home": { kind: "slugs", slugs: ["farmers-walk"] },
  "squat-without-a-rack": {
    kind: "slugs",
    slugs: ["barbell-squat", "goblet-squat", "dumbbell-squat"],
  },
  "bench-press-hurts-shoulders": {
    kind: "slugs",
    slugs: ["barbell-bench-press", "incline-barbell-bench-press"],
  },
  "dumbbell-press-hurts-shoulders": {
    kind: "slugs",
    slugs: ["dumbbell-bench-press", "incline-dumbbell-press"],
  },
  // The leg press plus the machines the guide names as swaps: hack squat,
  // machine deadlift, machine chest press, Smith bench, machine shoulder
  // press and machine row.
  "what-to-do-when-the-machine-is-taken": {
    kind: "slugs",
    slugs: [
      "leg-press",
      "hack-squat",
      "leverage-deadlift",
      "machine-bench-press",
      "smith-machine-bench-press",
      "leverage-shoulder-press",
      "leverage-high-row",
    ],
  },
  "picking-your-starting-weight": { kind: "indexed" },
};

/** Guide slugs that cover an exercise, in the order `guideOrder` gives. */
export function guidesForExercise(
  exercise: { slug: string; equipment: string | null; indexed: boolean },
  guideOrder: readonly string[],
): string[] {
  return guideOrder.filter((guide) => {
    const rule = GUIDE_EXERCISES[guide];
    if (!rule) return false;
    if (rule.kind === "slugs") return rule.slugs.includes(exercise.slug);
    if (rule.kind === "equipment") return exercise.equipment?.toLowerCase() === rule.value;
    return exercise.indexed;
  });
}

/** The catalog rows a guide lists, in map order for a slug list, authored
 *  rows first then by name for an equipment rule. An `indexed` rule lists
 *  nothing here: the guide links the A to Z page instead of 86 rows. */
export function exercisesForGuide<
  T extends { slug: string; name: string; equipment: string | null; has_notes: boolean },
>(guide: string, rows: readonly T[]): T[] {
  const rule = GUIDE_EXERCISES[guide];
  if (!rule || rule.kind === "indexed") return [];
  if (rule.kind === "slugs") {
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    return rule.slugs.map((s) => bySlug.get(s)).filter((r): r is T => !!r);
  }
  // A row whose canonical points at another row is left out: the list
  // links the canonical one.
  return rows
    .filter((r) => r.equipment?.toLowerCase() === rule.value && !CANONICAL_SLUG_OVERRIDES[r.slug])
    .sort((a, b) => Number(b.has_notes) - Number(a.has_notes) || a.name.localeCompare(b.name));
}
