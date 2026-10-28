import { describe, expect, it } from "vitest";

import { routineChanges, type RoutineEntry } from "./routine-changes";
import type { RoutineSourceExercise, RoutineSourceSet } from "./routine-from-workout";

/** Sets in position order from [reps, completed] pairs. */
function sets(...rows: [number | null, boolean][]): RoutineSourceSet[] {
  return rows.map(([reps, completed], position) => ({ position, reps, completed }));
}

/** A workout exercise with `done` completed sets of `reps`. */
function did(exerciseId: string, done: number, reps = 10): RoutineSourceExercise {
  return { exerciseId, sets: sets(...Array.from({ length: done }, (): [number, boolean] => [reps, true])) };
}

/** A workout exercise that is still in the workout with nothing ticked. */
function skipped(exerciseId: string): RoutineSourceExercise {
  return { exerciseId, sets: sets([10, false], [10, false], [10, false]) };
}

const entry = (exerciseId: string, targetSets: number | null = 3, targetReps: string | null = "8-12"): RoutineEntry => ({
  exerciseId,
  targetSets,
  targetReps,
});

// M - Upper Body, as a routine.
const upper: RoutineEntry[] = [entry("bench", 3, "8"), entry("row", 3, "10"), entry("pulldown", 3, "10-12")];

describe("routineChanges", () => {
  it("offers a swap, putting the new exercise where it was done (Justin's case)", () => {
    expect(routineChanges(upper, [did("bench", 3, 8), did("row", 3), did("cable-row", 3, 12)])).toEqual([
      entry("bench", 3, "8"),
      entry("row", 3, "10"),
      { exerciseId: "cable-row", targetSets: 3, targetReps: "12" },
    ]);
  });

  it("offers an added exercise, with targets from what was done", () => {
    expect(
      routineChanges(upper, [did("bench", 4, 8), did("row", 3), did("pulldown", 3), did("curl", 2, 15)]),
    ).toEqual([...upper, { exerciseId: "curl", targetSets: 2, targetReps: "15" }]);
  });

  it("offers a removed exercise", () => {
    expect(routineChanges(upper, [did("bench", 3), did("pulldown", 3)])).toEqual([
      entry("bench", 3, "8"),
      entry("pulldown", 3, "10-12"),
    ]);
  });

  it("does not prompt when an exercise was only skipped", () => {
    expect(routineChanges(upper, [did("bench", 3), skipped("row"), did("pulldown", 3)])).toBeNull();
  });

  it("keeps a skipped routine exercise, with its targets, when something else changed", () => {
    expect(routineChanges(upper, [did("bench", 3), skipped("row"), did("chin-up", 3, 6)])).toEqual([
      entry("bench", 3, "8"),
      entry("row", 3, "10"),
      { exerciseId: "chin-up", targetSets: 3, targetReps: "6" },
    ]);
  });

  it("does not prompt for a reorder alone", () => {
    expect(routineChanges(upper, [did("pulldown", 3), did("bench", 3), did("row", 3)])).toBeNull();
  });

  it("writes the workout's order when it does prompt", () => {
    expect(routineChanges(upper, [did("pulldown", 3), did("curl", 2), did("bench", 3)])).toEqual([
      entry("pulldown", 3, "10-12"),
      { exerciseId: "curl", targetSets: 2, targetReps: "10" },
      entry("bench", 3, "8"),
    ]);
  });

  it("does not prompt for extra sets or different reps alone", () => {
    expect(routineChanges(upper, [did("bench", 5, 5), did("row", 1, 20), did("pulldown", 4, 12)])).toBeNull();
  });

  it("drops a new exercise with no completed set, and does not prompt when that is the only change", () => {
    expect(routineChanges(upper, [did("bench", 3), did("row", 3), did("pulldown", 3), skipped("curl")])).toBeNull();
  });

  it("drops a new exercise with no completed set when something else changed", () => {
    expect(routineChanges(upper, [did("bench", 3), did("row", 3), skipped("curl")])).toEqual([
      entry("bench", 3, "8"),
      entry("row", 3, "10"),
    ]);
  });

  it("matches duplicate ids in order and does not prompt for an extra copy alone", () => {
    const twice = [entry("bench", 3, "5"), entry("row"), entry("bench", 2, "12")];
    expect(routineChanges(twice, [did("bench", 3), did("row", 3), did("bench", 2)])).toBeNull();
    expect(routineChanges(twice, [did("bench", 3), did("row", 3)])).toBeNull();
    expect(routineChanges(upper, [did("bench", 3), did("bench", 3), did("row", 3), did("pulldown", 3)])).toBeNull();
  });

  it("keeps each duplicate's own targets and gives an extra copy the workout's", () => {
    const twice = [entry("bench", 3, "5"), entry("row"), entry("bench", 2, "12")];
    expect(
      routineChanges(twice, [did("bench", 3), did("bench", 2), did("bench", 1, 3), did("dip", 3)]),
    ).toEqual([
      entry("bench", 3, "5"),
      entry("bench", 2, "12"),
      { exerciseId: "bench", targetSets: 1, targetReps: "3" },
      { exerciseId: "dip", targetSets: 3, targetReps: "10" },
    ]);
  });

  it("does not offer a routine with nothing left in it", () => {
    expect(routineChanges(upper, [skipped("curl")])).toBeNull();
    expect(routineChanges(upper, [])).toBeNull();
  });

  it("keeps a routine's empty targets as they are", () => {
    expect(routineChanges([entry("bench", null, null)], [did("bench", 3), did("dip", 3)])).toEqual([
      entry("bench", null, null),
      { exerciseId: "dip", targetSets: 3, targetReps: "10" },
    ]);
  });
});
