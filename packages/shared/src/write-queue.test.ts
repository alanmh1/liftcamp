import { describe, expect, it } from "vitest";

import {
  EMPTY_QUEUE,
  addOp,
  classifySyncError,
  hasPendingFor,
  parseQueueState,
  pendingWorkoutDeletes,
  retryDelayMs,
  splitOnFailure,
  type QueueState,
  type WriteOpBody,
} from "./write-queue";
import { E, W, ops } from "./write-queue.fixtures";

function build(bodies: WriteOpBody[], inFlightSeq: number | null = null): QueueState {
  return bodies.reduce((s, b) => addOp(s, b, { userId: "u1", now: 1000, inFlightSeq }), EMPTY_QUEUE);
}

describe("addOp", () => {
  it("numbers ops in order, and never reuses a number", () => {
    const s = build([ops.workout(), ops.exercise(), ops.setDelete("gone")]);
    expect(s.ops.map((o) => o.seq)).toEqual([1, 2, 3]);
    expect(s.nextSeq).toBe(4);
    // A delete that swallows an unsent insert still spends a number.
    const after = addOp(s, ops.discard(), { userId: "u1", now: 1000, inFlightSeq: null });
    expect(after.ops).toEqual([]);
    expect(after.nextSeq).toBe(5);
  });

  it("merges two updates of the same set, the later value winning per field", () => {
    const s = build([
      ops.setUpdate("s1", { weight_value: 1, weight_unit: "kg" }),
      ops.setUpdate("s1", { weight_value: 10, weight_unit: "kg" }),
      ops.setUpdate("s1", { reps: 5 }),
      ops.setUpdate("s1", { weight_value: 100, weight_unit: "kg" }),
    ]);
    expect(s.ops).toHaveLength(1);
    expect(s.ops[0]).toMatchObject({ kind: "update", id: "s1", patch: { weight_value: 100, weight_unit: "kg", reps: 5 } });
  });

  it("keeps updates of different sets apart", () => {
    const s = build([ops.setUpdate("s1", { reps: 5 }), ops.setUpdate("s2", { reps: 6 })]);
    expect(s.ops).toHaveLength(2);
  });

  it("folds an update into its row's insert while the insert is unsent", () => {
    const s = build([ops.sets(["s1", "s2"]), ops.setUpdate("s2", { reps: 8, completed: true })]);
    expect(s.ops).toHaveLength(1);
    const insert = s.ops[0];
    expect(insert.kind === "insert" && insert.rows[1].values).toMatchObject({ id: "s2", reps: 8, completed: true });
    expect(insert.kind === "insert" && insert.rows[0].values).toMatchObject({ reps: null, completed: false });
  });

  it("never changes the op being sent", () => {
    // The insert is seq 1 and in flight: the server may already have it.
    const s = build([ops.sets(["s1"]), ops.setUpdate("s1", { reps: 8 })], 1);
    expect(s.ops).toHaveLength(2);
    const t = build([ops.setUpdate("s1", { reps: 1 }), ops.setUpdate("s1", { reps: 2 })], 1);
    expect(t.ops.map((o) => o.kind === "update" && o.patch)).toEqual([{ reps: 1 }, { reps: 2 }]);
  });

  it("drops an unsent insert and its updates when the row is deleted, sending nothing", () => {
    const s = build([
      ops.exercise(),
      ops.sets(["s1", "s2"]),
      ops.setUpdate("s2", { reps: 8 }),
      ops.setUpdate("s1", { reps: 5 }),
      ops.setDelete("s2"),
    ]);
    expect(s.ops).toHaveLength(2);
    const sets = s.ops[1];
    expect(sets.kind === "insert" && sets.rows.map((r) => r.id)).toEqual(["s1"]);
    expect(sets.kind === "insert" && sets.rows[0].values.reps).toBe(5);
  });

  it("keeps a delete and a restore of the same set, in that order", () => {
    // s1 is already on the server.
    const restore: WriteOpBody = {
      kind: "insert",
      table: "sets",
      rows: [{ id: "s1", parents: [W, E], values: { id: "s1", workout_exercise_id: E, reps: 5 } }],
    };
    const s = build([ops.setDelete("s1"), restore]);
    expect(s.ops.map((o) => o.kind)).toEqual(["delete", "insert"]);
  });

  it("delete, restore, delete of a server set leaves one delete", () => {
    const restore: WriteOpBody = {
      kind: "insert",
      table: "sets",
      rows: [{ id: "s1", parents: [W, E], values: { id: "s1", workout_exercise_id: E } }],
    };
    const s = build([ops.setDelete("s1"), restore, ops.setUpdate("s1", { reps: 3 }), ops.setDelete("s1")]);
    expect(s.ops.map((o) => `${o.kind}:${o.kind === "insert" ? o.rows[0].id : o.id}`)).toEqual(["delete:s1"]);
  });

  it("discarding a workout whose insert is unsent drops every op for it", () => {
    const s = build([
      ops.workout(),
      ops.exercise(),
      ops.sets(["s1", "s2"]),
      ops.setUpdate("s1", { completed: true }),
      ops.finish(),
      ops.discard(),
    ]);
    expect(s.ops).toEqual([]);
  });

  it("leaves other workouts' ops alone on a discard", () => {
    const s = build([ops.workout("w2"), ops.workout(), ops.exercise(), ops.discard()]);
    expect(s.ops.map((o) => o.kind === "insert" && o.rows[0].id)).toEqual(["w2"]);
  });

  it("removing a saved routine keeps queued workouts started from it", () => {
    // A workout names its routine in template_id, a value rather than a
    // parent, so the routine's delete must not take the workout with it.
    const started: WriteOpBody = {
      kind: "insert",
      table: "workouts",
      rows: [{ id: W, parents: [], values: { id: W, user_id: "u1", template_id: "t1" } }],
    };
    const s = build([started, ops.exercise(), ops.removeTemplate("t1"), ops.removeTemplate("t2")]);
    expect(s.ops.map((o) => `${o.kind} ${o.table}`)).toEqual([
      "insert workouts",
      "insert workout_exercises",
      "delete templates",
      "delete templates",
    ]);
    expect(hasPendingFor(s.ops, "t1")).toBe(true);
  });

  it("discarding a workout on the server keeps one delete and drops its queued children", () => {
    const s = build([ops.exercise(), ops.sets(["s1"]), ops.setUpdate("s0", { reps: 1 }), ops.discard()]);
    expect(s.ops).toHaveLength(1);
    expect(s.ops[0]).toMatchObject({ kind: "delete", table: "workouts", id: W });
  });

  it("removing an exercise on the server drops its sets' queued writes only", () => {
    const removeE: WriteOpBody = { kind: "delete", table: "workout_exercises", id: E, parents: [W] };
    const s = build([
      ops.setUpdate("s1", { reps: 1 }),
      ops.setUpdate("t1", { reps: 1 }, "we2"),
      ops.sets(["s9"]),
      removeE,
    ]);
    expect(s.ops.map((o) => (o.kind === "insert" ? "insert" : `${o.kind}:${o.id}`))).toEqual([
      "update:t1",
      "delete:we1",
    ]);
  });

  it("merges reorders position by position: the last order wins", () => {
    const pos = (id: string, position: number): WriteOpBody => ({
      kind: "update",
      table: "workout_exercises",
      id,
      parents: [W],
      patch: { position },
    });
    const s = build([pos("a", 1), pos("b", 0), pos("a", 0), pos("b", 1)]);
    expect(s.ops.map((o) => o.kind === "update" && [o.id, o.patch.position])).toEqual([
      ["a", 0],
      ["b", 1],
    ]);
  });

  it("keeps a set edit made after Finish, after the finish", () => {
    const s = build([ops.finish(), ops.setUpdate("s1", { reps: 9 })]);
    expect(s.ops.map((o) => o.table)).toEqual(["workouts", "sets"]);
  });

  it("keeps note edits made after Finish after the finish, merged into one op", () => {
    // Typed during the workout, then twice on the summary, all offline.
    const s = build([ops.workout(), ops.notes("during"), ops.finish(), ops.notes("a"), ops.notes("ab")]);
    expect(s.ops.map((o) => [o.kind, o.kind === "update" ? o.patch : null])).toEqual([
      ["insert", null],
      ["update", { finished_at: "2026-09-29T18:00:00.000Z" }],
      ["update", { notes: "ab" }],
    ]);
    // The note typed before Finish rode into the unsent insert.
    expect(s.ops[0].kind === "insert" && s.ops[0].rows[0].values.notes).toBe("during");
    // The finish carries only finished_at, so it cannot write a note at all.
    expect(s.ops[1].kind === "update" && s.ops[1].onlyIfNull).toBe("finished_at");
  });

  it("never merges a finish into another update", () => {
    const rename: WriteOpBody = { kind: "update", table: "workouts", id: W, parents: [], patch: { name: "Legs" } };
    const s = build([rename, ops.finish(), ops.finish()]);
    expect(s.ops).toHaveLength(3);
  });

  it("carries meta through a merge", () => {
    const replace = (exerciseId: string): WriteOpBody => ({
      kind: "update",
      table: "workout_exercises",
      id: E,
      parents: [W],
      patch: { exercise_id: exerciseId },
      meta: { exercises: { id: exerciseId } },
    });
    const s = build([replace("x2"), replace("x3")]);
    expect(s.ops[0]).toMatchObject({ patch: { exercise_id: "x3" }, meta: { exercises: { id: "x3" } } });
  });
});

describe("hasPendingFor", () => {
  it("finds a workout through any row under it", () => {
    const s = build([ops.setUpdate("s1", { reps: 1 })]);
    expect(hasPendingFor(s.ops, W)).toBe(true);
    expect(hasPendingFor(s.ops, "w2")).toBe(false);
  });
});

describe("pendingWorkoutDeletes", () => {
  it("lists workouts whose delete is queued, and nothing else", () => {
    const s = build([ops.setUpdate("s1", { reps: 1 }), ops.discard("w2"), ops.setDelete("s9")]);
    expect(pendingWorkoutDeletes(s.ops)).toEqual(["w2"]);
  });

  it("leaves out a workout whose delete swallowed its unsent insert", () => {
    const s = build([ops.workout(), ops.discard()]);
    expect(pendingWorkoutDeletes(s.ops)).toEqual([]);
  });

  it("is empty for an empty queue", () => {
    expect(pendingWorkoutDeletes([])).toEqual([]);
  });
});

describe("classifySyncError", () => {
  it.each([
    [{ status: 0, code: "" }, "network"],
    [{ status: 0, code: "NO_SESSION" }, "auth"],
    [{ status: 401, code: "" }, "auth"],
    [{ status: 401, code: "PGRST301" }, "auth"],
    [{ status: 401, code: "PGRST303" }, "auth"],
    [{ status: 503, code: "PGRST001" }, "server"],
    [{ status: 500, code: "40001" }, "server"],
    [{ status: 500, code: "57014" }, "server"],
    [{ status: 503, code: "53300" }, "server"],
    [{ status: 408, code: "" }, "server"],
    [{ status: 429, code: "" }, "server"],
    [{ status: 502, code: "" }, "server"],
    [{ status: 409, code: "23503" }, "permanent"],
    [{ status: 409, code: "23505" }, "permanent"],
    [{ status: 400, code: "23514" }, "permanent"],
    [{ status: 403, code: "42501" }, "permanent"],
    [{ status: 400, code: "22P02" }, "permanent"],
    [{ status: 404, code: "PGRST205" }, "permanent"],
  ] as const)("%o is %s", (error, kind) => {
    expect(classifySyncError({ ...error, message: "" })).toBe(kind);
  });
});

describe("retryDelayMs", () => {
  it("doubles from 2 s and stops at 30 s", () => {
    expect([1, 2, 3, 4, 5, 6, 20].map(retryDelayMs)).toEqual([2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });
});

describe("splitOnFailure", () => {
  it("takes the workout's exercises and their sets with a failed workout insert", () => {
    const s = build([ops.workout(), ops.exercise(), ops.sets(["s1"]), ops.setUpdate("s1", { reps: 1 }), ops.workout("w2")]);
    // Fold means the update is inside the sets insert; add one it cannot fold into.
    const withUpdate = addOp(s, ops.setUpdate("s1", { reps: 2 }), { userId: "u1", now: 0, inFlightSeq: 3 });
    const { keep, dropped } = splitOnFailure(withUpdate.ops, withUpdate.ops[0]);
    expect(keep.map((o) => o.kind === "insert" && o.rows[0].id)).toEqual(["w2"]);
    expect(dropped).toHaveLength(4);
  });

  it("splits a many-row insert, keeping the rows that do not depend on the failure", () => {
    const e2: WriteOpBody = {
      kind: "insert",
      table: "workout_exercises",
      rows: [{ id: "we2", parents: [W], values: {} }],
    };
    const mixed: WriteOpBody = {
      kind: "insert",
      table: "sets",
      rows: [
        { id: "s1", parents: [W, E], values: {} },
        { id: "t1", parents: [W, "we2"], values: {} },
      ],
    };
    const s = build([e2, ops.exercise(), mixed]);
    const { keep, dropped } = splitOnFailure(s.ops.slice(1), s.ops[0]);
    expect(keep.map((o) => o.kind === "insert" && o.rows.map((r) => r.id))).toEqual([["we1"], ["s1"]]);
    expect(dropped.map((o) => o.kind === "insert" && o.rows.map((r) => r.id))).toEqual([["we2"], ["t1"]]);
  });

  it("fails an update alone", () => {
    const s = build([ops.setUpdate("s1", { reps: -1 }), ops.setUpdate("s2", { reps: 1 })]);
    const { keep, dropped } = splitOnFailure(s.ops, s.ops[0]);
    expect(keep).toHaveLength(1);
    expect(dropped).toHaveLength(1);
  });
});

describe("parseQueueState", () => {
  it("reads a missing queue as empty", () => {
    expect(parseQueueState(null)).toEqual(EMPTY_QUEUE);
  });

  it("round-trips a queue", () => {
    const s = build([ops.workout(), ops.setUpdate("s1", { reps: 1 })]);
    expect(parseQueueState(JSON.stringify(s))).toEqual(s);
  });

  it.each(["{", "null", "[]", '{"nextSeq":1}', '{"nextSeq":1,"ops":[{"seq":1}]}'])("rejects %s", (raw) => {
    expect(parseQueueState(raw)).toBeNull();
  });
});
