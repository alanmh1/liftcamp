import { describe, expect, it } from "vitest";

import { oneRepMaxNumeric, weightForReps } from "./one-rep-max";
import type { HistorySession, HistorySet, ProgressionExercise } from "./progression";
import {
  equipmentFamily,
  startingWeight,
  type SiblingHistory,
  type StartingWeightInput,
} from "./starting-weight";
import { standardThresholds, strengthThresholds } from "./strength-standards";

const BENCH_ID = "d5f93fa3-b43b-4306-8081-ee5bff0d4ca6";
const SQUAT_ID = "85495e85-bd72-445d-a6c8-5961f17ec2e5";
const DB_BENCH_ID = "05510482-9385-455f-85b4-96aef279939c";

const exercise = (over: Partial<ProgressionExercise> = {}): ProgressionExercise => ({
  id: "ex",
  equipment: "barbell",
  weight_type: "standard",
  mechanic: "compound",
  primary_muscle: "chest",
  ...over,
});

const bench = exercise({ id: BENCH_ID });
const closeGrip = exercise({ id: "close-grip" });

const sets = (pairs: [number, number][], unit = "lb"): HistorySet[] =>
  pairs.map(([weight_value, reps]) => ({ weight_value, reps, weight_unit: unit }));

const session = (date: string, s: HistorySet[]): HistorySession => ({ workoutId: date, date, sets: s });

const sibling = (name: string, over: Partial<ProgressionExercise>, sessions: HistorySession[]): SiblingHistory => ({
  exercise: { ...exercise({ id: name }), ...over, name },
  sessions,
});

const benchHistory = sibling("Barbell Bench Press", { id: BENCH_ID }, [
  session("2026-10-20", sets([[95, 8], [95, 8], [95, 8]])),
]);

const input = (over: Partial<StartingWeightInput> = {}): StartingWeightInput => ({
  unit: "lb",
  sex: null,
  bodyweightKg: null,
  age: null,
  reps: 8,
  sets: 3,
  siblings: [],
  barWeight: 45,
  ...over,
});

const male80 = { sex: "male", bodyweightKg: 80, age: 30 };

describe("weightForReps", () => {
  it("is the inverse of the 1RM estimate", () => {
    for (const [w, r] of [
      [100, 8],
      [62.5, 1],
      [135, 12],
    ]) {
      expect(weightForReps(oneRepMaxNumeric(w, r), r)).toBeCloseTo(w, 9);
    }
  });

  it("is null without a max or reps", () => {
    expect(weightForReps(null, 8)).toBeNull();
    expect(weightForReps(100, 0)).toBeNull();
  });
});

describe("standardThresholds", () => {
  it("covers the dumbbell presses the strength level leaves off", () => {
    expect(strengthThresholds(DB_BENCH_ID, "male", 80, 30)).toBeNull();
    expect(standardThresholds(DB_BENCH_ID, "male", 80, 30)?.[0]).toBeCloseTo(24, 9);
  });

  it("matches strengthThresholds where both apply", () => {
    expect(standardThresholds(BENCH_ID, "female", 65, null)).toEqual(strengthThresholds(BENCH_ID, "female", 65, null));
  });
});

describe("startingWeight from the strength standards", () => {
  it("takes 60% of the Novice weight for the reps, rounded to the step", () => {
    // Novice 60 kg = 132.3 lb 1RM; 104.4 for 8; 60% is 62.7, so 65.
    expect(startingWeight(bench, input(male80))).toEqual({ weight: 65, reps: 8, sets: 3, source: "standards" });
  });

  it("works in kg", () => {
    // 60 kg 1RM; 47.4 for 8; 60% is 28.4, so 27.5.
    expect(startingWeight(bench, input({ ...male80, unit: "kg", barWeight: 20 }))?.weight).toBe(27.5);
  });

  it("uses the 10 lb step for a lower-body lift", () => {
    // Novice 80 kg = 176.4 lb; 151.2 for 5; 60% is 90.7, so 90.
    expect(startingWeight(exercise({ id: SQUAT_ID, primary_muscle: "quads" }), input({ ...male80, reps: 5 }))?.weight).toBe(90);
  });

  it("rounds onto the dumbbell ladder", () => {
    const db = exercise({ id: DB_BENCH_ID, equipment: "dumbbell" });
    // Novice 24 kg = 52.9 lb; 39.7 for 10; 60% is 23.8, nearest 25.
    expect(startingWeight(db, input({ ...male80, reps: 10 }))?.weight).toBe(25);
    // Novice 9.75 kg = 21.5 lb; 16.1 for 10; 60% is 9.7, nearest 10.
    expect(startingWeight(db, input({ sex: "female", bodyweightKg: 65, age: null, reps: 10 }))?.weight).toBe(10);
  });

  it("scales with age", () => {
    const young = startingWeight(bench, input(male80))?.weight as number;
    const older = startingWeight(bench, input({ ...male80, age: 65 }))?.weight as number;
    expect(older).toBeLessThan(young);
  });

  it("never goes under the empty bar", () => {
    // Novice for a 40 kg woman is about 12 kg; well under the bar.
    expect(startingWeight(bench, input({ sex: "female", bodyweightKg: 40, age: 75, reps: 12 }))).toEqual({
      weight: 45,
      reps: 12,
      sets: 3,
      source: "standards",
    });
  });
});

describe("startingWeight from a related lift", () => {
  it("takes 70% of the related lift's last working weight", () => {
    // 70% of 95 is 66.5, so 65.
    expect(startingWeight(closeGrip, input({ siblings: [benchHistory] }))).toEqual({
      weight: 65,
      reps: 8,
      sets: 3,
      source: "sibling",
      siblingName: "Barbell Bench Press",
    });
  });

  it("is what a user with no body details gets on a lift with standards", () => {
    const other = sibling("Incline Bench", {}, [session("2026-10-20", sets([[100, 8]]))]);
    expect(startingWeight(bench, input({ siblings: [other] }))?.source).toBe("sibling");
    expect(startingWeight(bench, input({ sex: "other", bodyweightKg: 80, siblings: [other] }))?.source).toBe("sibling");
  });

  it("needs the same primary muscle, mechanic and equipment family", () => {
    const back = sibling("Row", { primary_muscle: "middle back" }, [session("2026-10-20", sets([[95, 8]]))]);
    const iso = sibling("Fly", { mechanic: "isolation" }, [session("2026-10-20", sets([[95, 8]]))]);
    const db = sibling("DB Press", { equipment: "dumbbell" }, [session("2026-10-20", sets([[40, 8]]))]);
    expect(startingWeight(closeGrip, input({ siblings: [back, iso, db] }))?.source).toBe("floor");
  });

  it("counts Smith machine and EZ bar as the barbell family, and machine with cable", () => {
    const smith = sibling("Smith Bench", { equipment: "smith machine" }, [session("2026-10-20", sets([[135, 8]]))]);
    expect(startingWeight(closeGrip, input({ siblings: [smith] }))?.weight).toBe(95);
    const cable = sibling("Cable Press", { equipment: "cable" }, [session("2026-10-20", sets([[100, 8]]))]);
    expect(startingWeight(exercise({ equipment: "machine" }), input({ siblings: [cable] }))?.weight).toBe(70);
    expect(equipmentFamily("e-z curl bar")).toBe("bar");
    expect(equipmentFamily("kettlebells")).toBeNull();
  });

  it("takes the lift logged most recently", () => {
    const older = sibling("Old Press", {}, [session("2026-09-01", sets([[200, 8]]))]);
    expect(startingWeight(closeGrip, input({ siblings: [older, benchHistory] }))?.siblingName).toBe("Barbell Bench Press");
  });

  it("reads past warm-ups to the working weight, and converts the unit", () => {
    const warmed = sibling("Barbell Bench Press", {}, [session("2026-10-20", sets([[45, 10], [95, 8], [95, 8]]))]);
    expect(startingWeight(closeGrip, input({ siblings: [warmed] }))?.weight).toBe(65);
    const kg = sibling("Barbell Bench Press", {}, [session("2026-10-20", sets([[60, 8]], "kg"))]);
    // 60 kg = 132.3 lb; 70% is 92.6, so 95.
    expect(startingWeight(closeGrip, input({ siblings: [kg] }))?.weight).toBe(95);
  });

  it("never goes under the floor", () => {
    const light = sibling("Light Press", {}, [session("2026-10-20", sets([[50, 8]]))]);
    expect(startingWeight(closeGrip, input({ siblings: [light] }))).toMatchObject({ weight: 45, source: "sibling" });
  });

  it("skips its own history and a sibling with nothing loaded", () => {
    const self = sibling("ex", { id: closeGrip.id }, [session("2026-10-20", sets([[95, 8]]))]);
    const empty = sibling("Empty", {}, [session("2026-10-20", [])]);
    expect(startingWeight(closeGrip, input({ siblings: [self, empty] }))?.source).toBe("floor");
  });
});

describe("startingWeight at the floor", () => {
  const floor = (ex: Partial<ProgressionExercise>, over: Partial<StartingWeightInput> = {}) =>
    startingWeight(exercise(ex), input(over));

  it("is the empty bar on a barbell or Smith machine, and the bar setting", () => {
    expect(floor({})).toEqual({ weight: 45, reps: 8, sets: 3, source: "floor" });
    expect(floor({ equipment: "smith machine" })?.weight).toBe(45);
    expect(floor({}, { barWeight: 35 })?.weight).toBe(35);
    expect(floor({}, { unit: "kg", barWeight: 20 })?.weight).toBe(20);
  });

  it("is 25 lb on an EZ bar", () => {
    expect(floor({ equipment: "e-z curl bar" })?.weight).toBe(25);
  });

  it("is the ladder's first weight for dumbbells and kettlebells", () => {
    expect(floor({ equipment: "dumbbell" })?.weight).toBe(5);
    expect(floor({ equipment: "dumbbell" }, { unit: "kg" })?.weight).toBe(2);
    expect(floor({ equipment: "kettlebells" })?.weight).toBe(10);
  });

  it("is the lightest plate on the stack for machines and cables", () => {
    expect(floor({ equipment: "machine" })?.weight).toBe(10);
    expect(floor({ equipment: "cable" })?.weight).toBe(5);
    expect(floor({ equipment: "cable" }, { unit: "kg" })?.weight).toBe(2.5);
  });

  it("is null for body only, bodyweight, bands, balls, other and cardio", () => {
    expect(floor({ equipment: "body only" })).toBeNull();
    expect(floor({ weight_type: "bodyweight", equipment: "other" })).toBeNull();
    expect(floor({ equipment: "bands" })).toBeNull();
    expect(floor({ equipment: "medicine ball" })).toBeNull();
    expect(floor({ equipment: "other" })).toBeNull();
    expect(floor({ equipment: "machine", set_type: "cardio" })).toBeNull();
    expect(floor({ equipment: null })).toBeNull();
  });
});
