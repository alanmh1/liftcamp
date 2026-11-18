import { describe, expect, it } from "vitest";

import { dumbbellCount, dumbbellHint, holdsPair, ONE_DUMBBELL_EXERCISES } from "./dumbbell-load";
import { buildImportPlan, type ImportPlanOptions } from "./import/plan";
import type { ImportRow } from "./import/row";

// Live rows (equipment, weight_type, is_unilateral), checked 17 Nov 2026.
const DB_BENCH = { id: "05510482-9385-455f-85b4-96aef279939c", equipment: "dumbbell", weight_type: "standard", is_unilateral: false };
const LUNGES = { id: "91ca5bfe-50dd-4fba-9b7b-b342077c9bd4", equipment: "dumbbell", weight_type: "standard", is_unilateral: true };
const ONE_ARM_ROW = { id: "5e3e2c88-2b18-42fb-b39d-c6aca546d3be", equipment: "dumbbell", weight_type: "standard", is_unilateral: true };
const CONCENTRATION_CURL = { id: "2814340e-d3d0-4060-ac0b-57219da15ff4", equipment: "dumbbell", weight_type: "standard", is_unilateral: true };
const GOBLET = { id: "43284cd1-4bb4-44c7-87b6-617ed5f03dbf", equipment: "dumbbell", weight_type: "standard", is_unilateral: false };
const CALF_RAISE_ON_DB = { id: "592ddd5f-d72d-40a4-9ce4-7bc21006eb67", equipment: "dumbbell", weight_type: "bodyweight", is_unilateral: false };
const SQUAT = { id: "85495e85-bd72-445d-a6c8-5961f17ec2e5", equipment: "barbell", weight_type: "standard", is_unilateral: false };

const NOT_BOTH = "Log one dumbbell's weight, not both";
const PLAIN = "Log the dumbbell's weight";

describe("holdsPair and dumbbellHint", () => {
  it("dumbbell bench and lunges hold a pair and get the 'not both' hint", () => {
    for (const e of [DB_BENCH, LUNGES]) {
      expect(holdsPair(e)).toBe(true);
      expect(dumbbellHint(e)).toBe(NOT_BOTH);
    }
  });

  it("one-arm row, concentration curl and goblet squat get the plain hint and do not hold a pair", () => {
    for (const e of [ONE_ARM_ROW, CONCENTRATION_CURL, GOBLET]) {
      expect(holdsPair(e)).toBe(false);
      expect(dumbbellHint(e)).toBe(PLAIN);
    }
  });

  it("every one-dumbbell, two-hand movement gets the plain hint", () => {
    for (const id of ONE_DUMBBELL_EXERCISES) {
      const e = { id, equipment: "dumbbell", weight_type: "standard", is_unilateral: false };
      expect(holdsPair(e)).toBe(false);
      expect(dumbbellHint(e)).toBe(PLAIN);
    }
  });

  it("a bodyweight dumbbell exercise gets no hint, one dumbbell, no pair", () => {
    expect(dumbbellHint(CALF_RAISE_ON_DB)).toBeNull();
    expect(holdsPair(CALF_RAISE_ON_DB)).toBe(false);
    expect(dumbbellCount(CALF_RAISE_ON_DB)).toBe(1);
    // Bodyweight wins even on a shape that would otherwise be a pair.
    expect(dumbbellCount({ ...DB_BENCH, weight_type: "bodyweight" })).toBe(1);
    expect(dumbbellHint({ ...DB_BENCH, weight_type: "bodyweight" })).toBeNull();
  });

  it("anything that is not a dumbbell gets no hint", () => {
    expect(dumbbellHint(SQUAT)).toBeNull();
    expect(dumbbellHint({ ...GOBLET, equipment: "kettlebells" })).toBeNull();
    expect(dumbbellHint(null)).toBeNull();
    expect(holdsPair(SQUAT)).toBe(false);
  });
});

describe("import with both dumbbells logged together", () => {
  const row = (exercise: string, weight: number): ImportRow => ({
    sessionKey: "s1",
    startedAt: "2026-11-01T10:00:00Z",
    finishedAt: "2026-11-01T11:00:00Z",
    workoutName: null,
    workoutNote: null,
    exercise,
    warmup: false,
    weight,
    unit: "kg",
    reps: 10,
    durationS: null,
    distanceM: null,
    incline: null,
    note: null,
  });
  const opts: ImportPlanOptions = {
    source: "hevy",
    existingDates: new Set(),
    importedStarts: new Set(),
    localDate: (iso) => iso.slice(0, 10),
    dumbbellsCombined: true,
  };

  it("halves dumbbell bench but not goblet squat or one-arm row", () => {
    const rows = [row("Bench Press (Dumbbell)", 40), row("Goblet Squat", 20), row("Dumbbell Row", 30)];
    const choices = { "Bench Press (Dumbbell)": DB_BENCH.id, "Goblet Squat": GOBLET.id, "Dumbbell Row": ONE_ARM_ROW.id };
    const [w] = buildImportPlan(rows, choices, [DB_BENCH, GOBLET, ONE_ARM_ROW], opts).workouts;
    const weightOf = (id: string) => w.exercises.find((e) => e.exercise_id === id)?.sets[0].weight;
    expect(weightOf(DB_BENCH.id)).toBe(20);
    expect(weightOf(GOBLET.id)).toBe(20);
    expect(weightOf(ONE_ARM_ROW.id)).toBe(30);
  });
});
