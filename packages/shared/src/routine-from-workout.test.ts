import { describe, expect, it } from "vitest";

import { modalReps, routineFromWorkout, type RoutineSourceSet } from "./routine-from-workout";

/** Sets in position order from [reps, completed] pairs. */
function sets(...rows: [number | null, boolean][]): RoutineSourceSet[] {
  return rows.map(([reps, completed], position) => ({ position, reps, completed }));
}

describe("modalReps", () => {
  it("picks the most common reps among completed sets", () => {
    expect(modalReps(sets([10, true], [8, true], [8, true]))).toBe(8);
  });

  it("gives a tie to the first completed set", () => {
    expect(modalReps(sets([12, true], [10, true], [10, true], [12, true]))).toBe(12);
    expect(modalReps(sets([5, false], [10, true], [12, true]))).toBe(10);
  });

  it("reads completion order by position, not array order", () => {
    const shuffled: RoutineSourceSet[] = [
      { position: 2, reps: 6, completed: true },
      { position: 0, reps: 8, completed: true },
      { position: 1, reps: 6, completed: false },
    ];
    expect(modalReps(shuffled)).toBe(8);
  });

  it("ignores incomplete sets, even when they are the majority", () => {
    expect(modalReps(sets([5, false], [5, false], [5, false], [10, true]))).toBe(10);
  });

  it("is null when no completed set has reps", () => {
    expect(modalReps(sets([null, true], [0, true], [8, false]))).toBeNull();
    expect(modalReps([])).toBeNull();
  });

  it("lets sets without reps sit out without breaking the tie rule", () => {
    expect(modalReps(sets([null, true], [6, true], [8, true]))).toBe(6);
  });
});

describe("routineFromWorkout", () => {
  it("counts completed sets and keeps the workout's order", () => {
    expect(
      routineFromWorkout([
        { exerciseId: "squat", sets: sets([5, true], [5, true], [5, true], [3, false]) },
        { exerciseId: "bench", sets: sets([8, true], [8, true]) },
      ]),
    ).toEqual([
      { exerciseId: "squat", targetSets: 3, targetReps: "5" },
      { exerciseId: "bench", targetSets: 2, targetReps: "8" },
    ]);
  });

  it("skips an exercise with no completed sets", () => {
    expect(
      routineFromWorkout([
        { exerciseId: "row", sets: sets([10, false], [10, false]) },
        { exerciseId: "curl", sets: [] },
        { exerciseId: "press", sets: sets([6, true]) },
      ]),
    ).toEqual([{ exerciseId: "press", targetSets: 1, targetReps: "6" }]);
  });

  it("keeps an exercise whose completed sets have no reps, with null target reps", () => {
    expect(routineFromWorkout([{ exerciseId: "plank", sets: sets([null, true], [null, true]) }])).toEqual([
      { exerciseId: "plank", targetSets: 2, targetReps: null },
    ]);
  });

  it("is empty when nothing was completed", () => {
    expect(routineFromWorkout([{ exerciseId: "squat", sets: sets([5, false]) }])).toEqual([]);
  });
});
