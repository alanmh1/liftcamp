import { describe, expect, it } from "vitest";

import { applyPendingOps, type OverlayWorkout } from "./pending-overlay";
import { EMPTY_QUEUE, addOp, type WriteOp, type WriteOpBody } from "./write-queue";
import { E, W, ops } from "./write-queue.fixtures";

function queued(bodies: WriteOpBody[]): WriteOp[] {
  return bodies.reduce((s, b) => addOp(s, b, { userId: "u1", now: 0, inFlightSeq: null }), EMPTY_QUEUE).ops;
}

function server(): OverlayWorkout {
  return {
    id: W,
    name: "Push",
    finished_at: null,
    workout_exercises: [
      {
        id: E,
        position: 0,
        exercise_id: "x1",
        sets: [
          { id: "s1", position: 0, reps: 5, completed: false },
          { id: "s2", position: 1, reps: 5, completed: false },
        ],
      },
    ],
  };
}

describe("applyPendingOps", () => {
  it("returns the server's workout when nothing is queued", () => {
    expect(applyPendingOps(W, server(), [])).toEqual(server());
  });

  it("does not change the server rows it was given", () => {
    const s = server();
    applyPendingOps(W, s, queued([ops.setUpdate("s1", { reps: 9 }), ops.setDelete("s2")]));
    expect(s).toEqual(server());
  });

  it("adds an exercise the server does not have yet, with its sets and meta", () => {
    const addE2: WriteOpBody = {
      kind: "insert",
      table: "workout_exercises",
      rows: [
        {
          id: "we2",
          parents: [W],
          values: { id: "we2", workout_id: W, exercise_id: "x2", position: 1 },
          meta: { exercises: { id: "x2", name: "Squat" } },
        },
      ],
    };
    const w = applyPendingOps(W, server(), queued([addE2, ops.sets(["t1", "t2"], "we2")]));
    const we2 = w?.workout_exercises?.find((we) => we.id === "we2");
    expect(we2).toMatchObject({ exercise_id: "x2", exercises: { name: "Squat" } });
    expect(we2?.sets?.map((s) => s.id)).toEqual(["t1", "t2"]);
  });

  it("ignores an exercise queued for another workout", () => {
    const w = applyPendingOps(W, server(), queued([ops.exercise("we9", "w2")]));
    expect(w?.workout_exercises).toHaveLength(1);
  });

  it("lets a queued update win over the server's value", () => {
    const w = applyPendingOps(W, server(), queued([ops.setUpdate("s1", { reps: 8, completed: true })]));
    expect(w?.workout_exercises?.[0].sets?.[0]).toMatchObject({ reps: 8, completed: true });
  });

  it("hides a set the queue deletes, and brings back one it restores", () => {
    const restore: WriteOpBody = {
      kind: "insert",
      table: "sets",
      rows: [{ id: "s2", parents: [W, E], values: { id: "s2", workout_exercise_id: E, position: 1, reps: 6 } }],
    };
    const deleted = applyPendingOps(W, server(), queued([ops.setDelete("s2")]));
    expect(deleted?.workout_exercises?.[0].sets?.map((s) => s.id)).toEqual(["s1"]);
    const restored = applyPendingOps(W, server(), queued([ops.setDelete("s2"), restore]));
    expect(restored?.workout_exercises?.[0].sets?.find((s) => s.id === "s2")).toMatchObject({ reps: 6 });
  });

  it("applies a queued finish, but not over one the server already has", () => {
    expect(applyPendingOps(W, server(), queued([ops.finish()]))?.finished_at).toBe("2026-09-29T18:00:00.000Z");
    const finished = { ...server(), finished_at: "2026-09-29T17:00:00.000Z" };
    expect(applyPendingOps(W, finished, queued([ops.finish()]))?.finished_at).toBe("2026-09-29T17:00:00.000Z");
  });

  it("swaps a replaced exercise's display fields from meta", () => {
    const replace: WriteOpBody = {
      kind: "update",
      table: "workout_exercises",
      id: E,
      parents: [W],
      patch: { exercise_id: "x3" },
      meta: { exercises: { id: "x3", name: "Dip" } },
    };
    const w = applyPendingOps(W, server(), queued([replace]));
    expect(w?.workout_exercises?.[0]).toMatchObject({ exercise_id: "x3", exercises: { name: "Dip" } });
  });

  it("removes an exercise the queue deletes", () => {
    const removeE: WriteOpBody = { kind: "delete", table: "workout_exercises", id: E, parents: [W] };
    expect(applyPendingOps(W, server(), queued([removeE]))?.workout_exercises).toEqual([]);
  });

  it("is null for a workout the queue discards", () => {
    expect(applyPendingOps(W, server(), queued([ops.discard()]))).toBeNull();
  });

  it("builds a workout only the queue has", () => {
    const w = applyPendingOps(W, null, queued([ops.workout(), ops.exercise(), ops.sets(["s1"])]));
    expect(w).toMatchObject({ id: W, workout_exercises: [{ id: E, sets: [{ id: "s1" }] }] });
  });

  it("is null when neither side has it", () => {
    expect(applyPendingOps(W, null, queued([ops.workout("w2")]))).toBeNull();
  });
});
