import { describe, expect, it } from "vitest";

import { exerciseRecords, isRepBased, summarizeSession, type ExerciseSession } from "./exercise-progress";

const barbell = { weight_type: "standard", equipment: "barbell", is_unilateral: false };
const set = (weight_value: number | null, reps: number | null) => ({ weight: "", weight_value, reps });

describe("summarizeSession", () => {
  it("summarizes a normal barbell session", () => {
    const s = summarizeSession([set(100, 5), set(110, 5), set(120, 3)], barbell, null);
    expect(s.heaviest).toBe(120);
    expect(s.volume).toBe(100 * 5 + 110 * 5 + 120 * 3);
    expect(s.mostReps).toBe(5);
    expect(s.totalReps).toBe(13);
    expect(s.sets).toBe(3);
    // Epley: 120 * (1 + 3/30) = 132, 110 * (1 + 5/30) = 128.3
    expect(s.estimatedMax).toBeCloseTo(132, 5);
    expect(s.bestSet).toEqual({ load: 120, reps: 3, estimatedMax: 132 });
  });

  it("lets a set of 10 beat a heavier set of 3 on estimated max", () => {
    const s = summarizeSession([set(120, 3), set(100, 10)], barbell, null);
    // 100 * (1 + 10/30) = 133.3 > 120 * (1 + 3/30) = 132
    expect(s.bestSet?.load).toBe(100);
    expect(s.bestSet?.reps).toBe(10);
    expect(s.heaviest).toBe(120);
  });

  it("doubles volume for a unilateral exercise", () => {
    const s = summarizeSession([set(20, 10)], { ...barbell, is_unilateral: true }, null);
    expect(s.volume).toBe(400);
  });

  it("leaves warm-ups out of volume, reps and the set count", () => {
    const warmup = (weight_value: number, reps: number) => ({ ...set(weight_value, reps), set_type: "warmup" });
    const s = summarizeSession([warmup(45, 12), warmup(95, 5), set(135, 5), set(135, 5)], barbell, null);
    expect(s.volume).toBe(1350);
    expect(s.totalReps).toBe(10);
    expect(s.mostReps).toBe(5);
    expect(s.sets).toBe(2);
  });
});

describe("isRepBased", () => {
  it("is false for a loaded barbell exercise", () => {
    expect(isRepBased(barbell, null, [set(100, 5)])).toBe(false);
  });

  it("is true for a body-only exercise with no loads", () => {
    const pushUp = { weight_type: "standard", equipment: "body only" };
    expect(isRepBased(pushUp, null, [set(null, 12), set(null, 10)])).toBe(true);
    expect(isRepBased(pushUp, null, [])).toBe(true);
  });

  it("is false for a body-only exercise once a set carries a load", () => {
    const dip = { weight_type: "standard", equipment: "body only" };
    expect(isRepBased(dip, null, [set(null, 12), set(20, 8)])).toBe(false);
  });

  it("is true for a bodyweight-type exercise with no profile bodyweight, false with one", () => {
    const pullUp = { weight_type: "bodyweight", equipment: "body only" };
    expect(isRepBased(pullUp, null, [set(0, 8)])).toBe(true);
    expect(isRepBased(pullUp, 80, [set(0, 8)])).toBe(false);
  });
});

describe("exerciseRecords", () => {
  const session = (workoutId: string, workoutDate: string, sets: ReturnType<typeof set>[]): ExerciseSession => ({
    workoutId,
    workoutDate,
    summary: summarizeSession(sets, barbell, null),
  });

  it("keeps the workout each record came from", () => {
    const r = exerciseRecords([
      session("w3", "2026-09-10", [set(100, 8)]),
      session("w1", "2026-08-01", [set(120, 3), set(120, 3), set(120, 3)]),
      session("w2", "2026-08-20", [set(60, 20)]),
    ]);
    // 100 x 8 = 126.7, 120 x 3 = 132, 60 x 20 = 100
    expect(r.estimatedMax?.workoutId).toBe("w1");
    expect(r.estimatedMax?.bestSet).toEqual({ load: 120, reps: 3, estimatedMax: 132 });
    expect(r.heaviest).toMatchObject({ value: 120, workoutId: "w1" });
    expect(r.mostVolume).toMatchObject({ value: 1200, workoutId: "w2" });
    expect(r.mostRepsSet).toMatchObject({ value: 20, workoutId: "w2" });
    expect(r.mostRepsSession).toMatchObject({ value: 20, workoutId: "w2" });
  });

  it("gives a tie to the session that set the record first", () => {
    const r = exerciseRecords([
      session("later", "2026-09-10", [set(100, 5)]),
      session("first", "2026-09-01", [set(100, 5)]),
    ]);
    expect(r.heaviest?.workoutId).toBe("first");
    expect(r.estimatedMax?.workoutId).toBe("first");
  });

  it("handles a single session", () => {
    const r = exerciseRecords([session("only", "2026-09-01", [set(50, 10)])]);
    expect(r.estimatedMax?.workoutId).toBe("only");
    expect(r.mostVolume?.value).toBe(500);
  });

  it("has no load records for a rep-based session", () => {
    const pushUp = { weight_type: "standard", equipment: "body only" };
    const r = exerciseRecords([
      { workoutId: "w", workoutDate: "2026-09-01", summary: summarizeSession([set(null, 15), set(null, 12)], pushUp, null) },
    ]);
    expect(r.estimatedMax).toBeNull();
    expect(r.heaviest).toBeNull();
    expect(r.mostVolume).toBeNull();
    expect(r.mostRepsSet?.value).toBe(15);
    expect(r.mostRepsSession?.value).toBe(27);
  });
});
