import { describe, expect, it } from "vitest";

import { exercisePrSetIds, finishStats, type FinishExercise, type FinishSet } from "./finish-stats";

const set = (id: string, weight: number | null, reps: number | null, completed = true): FinishSet => ({
  id,
  completed,
  weight_value: weight,
  reps,
});

const bench = (sets: FinishSet[], priorBestOrm: number | null, extra: Partial<FinishExercise> = {}): FinishExercise => ({
  id: "we-bench",
  exercise: { id: "bench", weight_type: "standard" },
  priorBestOrm,
  sets,
  ...extra,
});

describe("exercisePrSetIds", () => {
  it("marks only sets that beat the prior best and every earlier set", () => {
    const ids = exercisePrSetIds([set("a", 100, 5), set("b", 100, 5), set("c", 105, 5)], { weight_type: "standard" }, 110, null);
    // 100 x 5 is about 116.7: a PR over 110. The same again is not. 105 x 5 beats it.
    expect([...ids]).toEqual(["a", "c"]);
  });

  it("skips sets that are not completed", () => {
    const ids = exercisePrSetIds([set("a", 200, 5, false)], { weight_type: "standard" }, 100, null);
    expect(ids.size).toBe(0);
  });

  it("counts the first set of a first-ever session, and only sets that climb after it", () => {
    const ids = exercisePrSetIds([set("a", 60, 8), set("b", 60, 8), set("c", 50, 8)], { weight_type: "standard" }, null, null);
    expect([...ids]).toEqual(["a"]);
  });
});

describe("finishStats", () => {
  it("leaves warm-up sets out of the volume and the PRs", () => {
    const warmup = { ...set("w", 100, 10), set_type: "warmup" };
    const stats = finishStats({
      exercises: [bench([warmup, set("a", 60, 5)], 200)],
      bodyweight: null,
      unit: "kg",
    });
    expect(stats.volume).toBe(300);
    expect(stats.pr_count).toBe(0);
    expect(stats.pr_exercise_ids).toEqual([]);
  });

  it("adds completed sets only, in the workout's unit", () => {
    const stats = finishStats({
      exercises: [bench([set("a", 100, 5), set("b", 100, 5, false)], 200)],
      bodyweight: null,
      unit: "kg",
    });
    expect(stats).toEqual({ volume: 500, volume_unit: "kg", pr_count: 0, pr_exercise_ids: [] });
  });

  it("scores a bodyweight exercise with the owner's bodyweight, as the summary does", () => {
    const pullUp: FinishExercise = {
      id: "we-pull",
      exercise: { id: "pull", weight_type: "bodyweight" },
      priorBestOrm: 1000,
      sets: [set("a", 0, 10)],
    };
    const stats = finishStats({ exercises: [pullUp], bodyweight: 80, unit: "kg" });
    expect(stats.volume).toBe(800);
  });

  it("names each exercise with a PR set and counts the sets", () => {
    const squat: FinishExercise = {
      id: "we-squat",
      exercise: { id: "squat", weight_type: "standard" },
      priorBestOrm: 10,
      sets: [set("s1", 100, 5), set("s2", 110, 5)],
    };
    const stats = finishStats({
      exercises: [bench([set("a", 50, 5)], 500), squat],
      bodyweight: null,
      unit: "lb",
    });
    expect(stats.pr_count).toBe(2);
    expect(stats.pr_exercise_ids).toEqual(["we-squat"]);
  });

  it("leaves the PRs unknown when the baselines never arrived, and still writes the volume", () => {
    const stats = finishStats({
      exercises: [bench([set("a", 100, 5)], null, { baselineKnown: false })],
      bodyweight: null,
      unit: "lb",
    });
    expect(stats).toEqual({ volume: 500, volume_unit: "lb", pr_count: null, pr_exercise_ids: null });
  });

  it("leaves the PRs unknown when any one exercise's baseline is unknown", () => {
    const squat: FinishExercise = {
      id: "we-squat",
      exercise: { id: "squat", weight_type: "standard" },
      priorBestOrm: 10,
      baselineKnown: true,
      sets: [set("s1", 100, 5)],
    };
    const stats = finishStats({
      exercises: [squat, bench([set("a", 100, 5)], null, { baselineKnown: false })],
      bodyweight: null,
      unit: "lb",
    });
    expect(stats.pr_count).toBeNull();
    expect(stats.pr_exercise_ids).toBeNull();
  });

  it("ignores an unknown baseline on an exercise with nothing completed", () => {
    const stats = finishStats({
      exercises: [bench([set("a", 100, 5, false)], null, { baselineKnown: false })],
      bodyweight: null,
      unit: "lb",
    });
    expect(stats.pr_count).toBe(0);
  });
});
