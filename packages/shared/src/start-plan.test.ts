import { describe, expect, it } from "vitest";

import { startSetCount, withServerDetails } from "./start-plan";

describe("startSetCount", () => {
  it("takes the routine's target first", () => {
    expect(startSetCount(4, 2, 3)).toBe(4);
  });

  it("takes the repeated workout's count when the routine sets none", () => {
    expect(startSetCount(null, 5, 3)).toBe(5);
    expect(startSetCount(0, 5, 3)).toBe(5);
  });

  it("falls back to the cold-start suggestion", () => {
    expect(startSetCount(null, null, 3)).toBe(3);
    expect(startSetCount(undefined, 0, 2)).toBe(2);
  });
});

describe("withServerDetails", () => {
  const exercise = (id: string, exerciseId: string, extra: Record<string, unknown> = {}) => ({
    id,
    exercise: { id: exerciseId, name: exerciseId },
    prior: [] as unknown[],
    history: [] as unknown[],
    priorBestOrm: null as number | null,
    finishedSessions: 0,
    target: null as unknown,
    sets: [{ id: `${id}-s1`, reps: null as number | null }],
    ...extra,
  });

  it("fills in the server's details and keeps the phone's sets and order", () => {
    const local = {
      bodyweight: null as number | null,
      exercises: [exercise("b", "x2", { sets: [{ id: "b-s1", reps: 8 }] }), exercise("a", "x1")],
    };
    const server = {
      bodyweight: 180,
      exercises: [
        exercise("a", "x1", { prior: [{ reps: 5 }], priorBestOrm: 100, finishedSessions: 3 }),
        exercise("b", "x2", { prior: [{ reps: 6 }], priorBestOrm: 50, sets: [] }),
      ],
    };
    const merged = withServerDetails(local, server);
    expect(merged.bodyweight).toBe(180);
    expect(merged.exercises.map((we) => we.id)).toEqual(["b", "a"]);
    expect(merged.exercises[0]).toMatchObject({ priorBestOrm: 50, sets: [{ id: "b-s1", reps: 8 }] });
    expect(merged.exercises[1]).toMatchObject({ priorBestOrm: 100, finishedSessions: 3, prior: [{ reps: 5 }] });
  });

  it("takes the server's history, and keeps the phone's for a swapped exercise", () => {
    const local = { bodyweight: null, exercises: [exercise("a", "x1"), exercise("b", "x3", { history: [] })] };
    const server = {
      bodyweight: null,
      exercises: [exercise("a", "x1", { history: [{ workoutId: "w1" }] }), exercise("b", "x2", { history: [{ workoutId: "w2" }] })],
    };
    const merged = withServerDetails(local, server);
    expect(merged.exercises[0].history).toEqual([{ workoutId: "w1" }]);
    expect(merged.exercises[1].history).toEqual([]);
  });

  it("keeps an exercise the phone added that the server does not have yet", () => {
    const local = { bodyweight: null, exercises: [exercise("new", "x9")] };
    const merged = withServerDetails(local, { bodyweight: null, exercises: [] });
    expect(merged.exercises).toEqual(local.exercises);
  });

  it("does not take the details of an exercise the phone swapped out", () => {
    const local = { bodyweight: null, exercises: [exercise("a", "x2")] };
    const server = { bodyweight: null, exercises: [exercise("a", "x1", { priorBestOrm: 100 })] };
    expect(withServerDetails(local, server).exercises[0]).toMatchObject({ exercise: { id: "x2" }, priorBestOrm: null });
  });

  it("keeps the phone's routine target and takes the server's when the phone has none", () => {
    const local = { bodyweight: null, exercises: [exercise("a", "x1", { target: { sets: 3 } }), exercise("b", "x2")] };
    const server = {
      bodyweight: null,
      exercises: [exercise("a", "x1", { target: { sets: 5 } }), exercise("b", "x2", { target: { sets: 4 } })],
    };
    const merged = withServerDetails(local, server);
    expect(merged.exercises.map((we) => we.target)).toEqual([{ sets: 3 }, { sets: 4 }]);
  });
});
