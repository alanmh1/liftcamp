import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { parseHevy } from "./hevy";
import { equipmentFirst, matchExercises } from "./match";
import { buildImportPlan, importTag, type ImportChoice, type ImportPlanOptions, type PlanCatalogEntry } from "./plan";
import type { ImportRow } from "./row";
import { parseStrong } from "./strong";

const fixture = (name: string) => readFileSync(resolve(__dirname, "__fixtures__", name), "utf8");

function rowsOf(p: ReturnType<typeof parseStrong> | ReturnType<typeof parseHevy>): ImportRow[] {
  if (!p.ok) throw new Error(`expected ok, got ${p.reason}`);
  return p.rows;
}

const HEVY_KG = rowsOf(parseHevy(fixture("hevy-kg.csv")));
const HEVY_LBS = rowsOf(parseHevy(fixture("hevy-lbs.csv")));
const STRONG_IOS = rowsOf(parseStrong(fixture("strong-ios.csv")));
const STRONG_ANDROID = rowsOf(parseStrong(fixture("strong-android.csv")));

/** A small catalog in the live shapes (weight_type, equipment, set_type). */
const CATALOG: (PlanCatalogEntry & { name: string; alias_text?: string | null })[] = [
  { id: "bb-bench", name: "Barbell Bench Press", weight_type: "standard", equipment: "barbell" },
  { id: "incline-db", name: "Incline Dumbbell Press", weight_type: "standard", equipment: "dumbbell" },
  { id: "db-curl", name: "Dumbbell Bicep Curl", weight_type: "standard", equipment: "dumbbell" },
  { id: "pullup", name: "Pullups", weight_type: "bodyweight", equipment: "body only" },
  { id: "weighted-pullup", name: "Weighted Pull Ups", weight_type: "standard", equipment: "body only" },
  { id: "run", name: "Outdoor Run", weight_type: "standard", set_type: "cardio", has_incline: false },
  { id: "treadmill", name: "Treadmill Run", weight_type: "standard", set_type: "cardio", has_incline: true },
  { id: "bb-squat", name: "Barbell Squat", weight_type: "standard", equipment: "barbell" },
  { id: "deadlift", name: "Barbell Deadlift", weight_type: "standard", equipment: "barbell" },
  { id: "ohp", name: "Alternating Cable Shoulder Press", weight_type: "standard", equipment: "cable", alias_text: "overheadpressbarbell" },
  { id: "pushup", name: "Push-Up", weight_type: "bodyweight", equipment: "body only" },
  { id: "plank", name: "Plank Hold", weight_type: "standard", equipment: "body only" },
];

const utcDate = (iso: string) => iso.slice(0, 10);

function opts(source: ImportPlanOptions["source"], extra: Partial<ImportPlanOptions> = {}): ImportPlanOptions {
  return { source, existingDates: new Set(), importedStarts: new Set(), localDate: utcDate, ...extra };
}

const HEVY_CHOICES: Record<string, ImportChoice> = {
  "Bench Press (Barbell)": "bb-bench",
  "Incline Bench Press (Dumbbell)": "incline-db",
  "Pull Up": "pullup",
  "Pull Up (Weighted)": "weighted-pullup",
  Running: "run",
  "Warm Up": "skip",
  "Squat (Barbell)": "bb-squat",
};

describe("matchExercises, for Strong and Hevy names", () => {
  it("matches Squat (Barbell) with no map row through the rewrite, as exact", () => {
    expect(matchExercises(["Squat (Barbell)"], [], CATALOG)).toEqual([
      { name: "Squat (Barbell)", sets: 1, exerciseId: "bb-squat", close: false },
    ]);
  });

  it("calls an alias match close", () => {
    expect(matchExercises(["Overhead Press (Barbell)"], [], CATALOG)).toEqual([
      { name: "Overhead Press (Barbell)", sets: 1, exerciseId: "ohp", close: true },
    ]);
  });

  it("tries the exact name before the rewrite, and the map before both", () => {
    const catalog = [
      { id: "exact", name: "Squat (Barbell)" },
      { id: "rewritten", name: "Barbell Squat" },
    ];
    expect(matchExercises(["Squat (Barbell)"], [], catalog)[0].exerciseId).toBe("exact");
    const map = [{ source_name: "Squat (Barbell)", exercise_id: "rewritten", close: true }];
    expect(matchExercises(["Squat (Barbell)"], map, catalog)[0]).toMatchObject({ exerciseId: "rewritten", close: true });
  });

  it("rewrites only Base (Equipment) names", () => {
    expect(equipmentFirst("Squat (Barbell)")).toBe("Barbell Squat");
    expect(equipmentFirst("Bench Press - Close Grip (Barbell)")).toBe("Barbell Bench Press - Close Grip");
    expect(equipmentFirst("Pull Up")).toBeNull();
  });
});

describe("buildImportPlan, for Hevy", () => {
  it("keeps the name, the file's note and the real finish", () => {
    const { workouts } = buildImportPlan(HEVY_KG, HEVY_CHOICES, CATALOG, opts("hevy"));
    expect(workouts).toHaveLength(2);
    expect(workouts[0]).toMatchObject({
      name: "Push day",
      notes: 'Felt strong, "easy" day',
      finished_at: new Date(2025, 9, 14, 19, 20).toISOString(),
    });
    expect(workouts[1]).toMatchObject({ name: "Legs", notes: "Imported from Hevy" });
  });

  it("puts exercise_notes on the first set only", () => {
    const [push] = buildImportPlan(HEVY_KG, HEVY_CHOICES, CATALOG, opts("hevy")).workouts;
    expect(push.exercises[0].sets.map((s) => s.note)).toEqual(["Pause on chest", null, null]);
    expect(push.exercises[0].sets.map((s) => s.set_type)).toEqual(["warmup", null, null]);
  });

  it("logs an empty weight on Pull Up as 0 once matched to a bodyweight exercise", () => {
    const [push] = buildImportPlan(HEVY_KG, HEVY_CHOICES, CATALOG, opts("hevy")).workouts;
    const pullup = push.exercises.find((e) => e.exercise_id === "pullup");
    expect(pullup?.sets).toEqual([
      { weight: 0, unit: "kg", reps: 10, duration: null, distance: null, incline: null, set_type: null, note: null },
    ]);
    const weighted = push.exercises.find((e) => e.exercise_id === "weighted-pullup");
    expect(weighted?.sets[0]).toMatchObject({ weight: 10, unit: "kg", reps: 6 });
  });

  it("gives cardio its time and meters", () => {
    const [push] = buildImportPlan(HEVY_KG, HEVY_CHOICES, CATALOG, opts("hevy")).workouts;
    expect(push.exercises.find((e) => e.exercise_id === "run")?.sets[0]).toMatchObject({
      weight: null,
      reps: null,
      duration: 1680,
      distance: 5200,
    });
  });

  it("halves dumbbell weights when both were logged together", () => {
    const one = buildImportPlan(HEVY_KG, HEVY_CHOICES, CATALOG, opts("hevy")).workouts[0];
    expect(one.exercises[1].sets.map((s) => s.weight)).toEqual([36, 24]);
    const both = buildImportPlan(HEVY_KG, HEVY_CHOICES, CATALOG, opts("hevy", { dumbbellsCombined: true })).workouts[0];
    expect(both.exercises[1].sets.map((s) => s.weight)).toEqual([18, 12]);
    // Barbell work is untouched.
    expect(both.exercises[0].sets.map((s) => s.weight)).toEqual([40, 80, 80]);
  });

  it("stores weight_lbs sets as lb, unconverted, and distance_miles as meters", () => {
    const choices = { "Squat (Barbell)": "bb-squat", "Bicep Curl (Dumbbell)": "db-curl", Treadmill: "treadmill", "Deadlift (Barbell)": "deadlift" };
    const [full] = buildImportPlan(HEVY_LBS, choices, CATALOG, opts("hevy", { unit: "kg" })).workouts;
    expect(full.exercises[0].sets.map((s) => [s.weight, s.unit])).toEqual([
      [45, "lb"],
      [230, "lb"],
    ]);
    expect(full.exercises[2].sets[0]).toMatchObject({ distance: 2414.02, duration: 1200, unit: null });
  });

  it("estimates the finish when the file has none", () => {
    const rows = HEVY_KG.map((r) => ({ ...r, finishedAt: null }));
    const [, legs] = buildImportPlan(rows, HEVY_CHOICES, CATALOG, opts("hevy")).workouts;
    // 1 set, raised to 15 minutes.
    expect(legs.finished_at).toBe(new Date(new Date(2025, 9, 16, 7, 30).getTime() + 15 * 60 * 1000).toISOString());
  });

  it("skips a start already imported from Hevy", () => {
    const started = new Date(2025, 9, 14, 18, 5).toISOString();
    const { summary } = buildImportPlan(HEVY_KG, HEVY_CHOICES, CATALOG, opts("hevy", { importedStarts: new Set([started]) }));
    expect(summary).toMatchObject({ workouts: 1, alreadyImported: 1 });
    expect(importTag("hevy")).toBe("hevy-csv");
    expect(importTag("strong")).toBe("strong-csv");
  });
});

describe("buildImportPlan, for Strong", () => {
  const IOS_CHOICES: Record<string, ImportChoice> = {
    "Bench Press (Barbell)": "bb-bench",
    "Incline Bench Press (Dumbbell)": "incline-db",
    "Push Up": "pushup",
    Plank: "plank",
    "Running (Treadmill)": "treadmill",
    "jake's custom curl": "skip",
    "Squat (Barbell)": "bb-squat",
    "Deadlift (Barbell)": "deadlift",
  };

  it("groups by Date and Workout Name, with the name, note and Strong's tag line", () => {
    const { workouts } = buildImportPlan(STRONG_IOS, IOS_CHOICES, CATALOG, opts("strong", { unit: "lb" }));
    expect(workouts.map((w) => [w.name, w.notes])).toEqual([
      ["Push Day", "Felt good, slept well"],
      ["Legs", "Imported from Strong"],
      ["Long", "Imported from Strong"],
    ]);
  });

  it("uses Strong's duration, and the estimate for 264h 1m", () => {
    const [push, , long] = buildImportPlan(STRONG_IOS, IOS_CHOICES, CATALOG, opts("strong", { unit: "lb" })).workouts;
    expect(push.finished_at).toBe(new Date(2025, 2, 4, 19, 35, 12).toISOString());
    expect(long.finished_at).toBe(new Date(new Date(2025, 2, 8, 9, 15).getTime() + 15 * 60 * 1000).toISOString());
  });

  it("fills the iOS file's unit from the answer, and reads its distance by it", () => {
    const lb = buildImportPlan(STRONG_IOS, IOS_CHOICES, CATALOG, opts("strong", { unit: "lb" })).workouts[0];
    expect(lb.exercises[0].sets.map((s) => [s.weight, s.unit])).toEqual([
      [95, "lb"],
      [185, "lb"],
      [185, "lb"],
    ]);
    const treadmillLb = lb.exercises.find((e) => e.exercise_id === "treadmill")?.sets[0];
    expect(treadmillLb).toMatchObject({ distance: 2414.02, duration: 900 });

    const kg = buildImportPlan(STRONG_IOS, IOS_CHOICES, CATALOG, opts("strong", { unit: "kg" })).workouts[0];
    expect(kg.exercises[0].sets[1]).toMatchObject({ weight: 185, unit: "kg" });
    expect(kg.exercises.find((e) => e.exercise_id === "treadmill")?.sets[0]).toMatchObject({ distance: 1500 });
  });

  it("keeps a bodyweight 0 and a hold's seconds, and drops a non-bodyweight 0", () => {
    const [push] = buildImportPlan(STRONG_IOS, IOS_CHOICES, CATALOG, opts("strong", { unit: "lb" })).workouts;
    expect(push.exercises.find((e) => e.exercise_id === "pushup")?.sets[0]).toMatchObject({ weight: 0, unit: "lb", reps: 20 });
    expect(push.exercises.find((e) => e.exercise_id === "plank")?.sets[0]).toMatchObject({
      weight: null,
      unit: null,
      reps: null,
      duration: 60,
    });
  });

  it("halves Incline Bench Press (Dumbbell) when both dumbbells were logged together", () => {
    const [push] = buildImportPlan(STRONG_IOS, IOS_CHOICES, CATALOG, opts("strong", { unit: "lb", dumbbellsCombined: true })).workouts;
    expect(push.exercises[1].sets.map((s) => s.weight)).toEqual([25, 17.5]);
  });

  it("keeps Android's per-row units and fills an empty one from the option", () => {
    const choices = { "Overhead Press (Barbell)": "bb-bench", "Pull Up": "pullup", "Squat (Barbell)": "bb-squat" };
    const [upper, lower] = buildImportPlan(STRONG_ANDROID, choices, CATALOG, opts("strong", { unit: "kg" })).workouts;
    expect(upper.exercises[0].sets[0]).toMatchObject({ weight: 95, unit: "lb" });
    expect(upper.exercises[1].sets[0]).toMatchObject({ weight: 0, unit: "kg", reps: 8 });
    expect(lower.exercises[0].sets[0]).toMatchObject({ weight: 100, unit: "kg" });
  });
});
