import { describe, expect, it } from "vitest";

import { DraftBuffer } from "./write-draft";
import type { WriteOpBody } from "./write-queue";

const W = "w1";

const update: WriteOpBody = {
  kind: "update",
  table: "sets",
  id: "s1",
  parents: [W, "we1"],
  patch: { reps: 8 },
};

const insert: WriteOpBody = {
  kind: "insert",
  table: "sets",
  rows: [{ id: "s2", parents: [W, "we1"], values: { reps: 5 } }],
};

const remove: WriteOpBody = { kind: "delete", table: "sets", id: "s3", parents: [W, "we1"] };

describe("DraftBuffer", () => {
  it("keeps an update, insert and delete for the workout, in order", () => {
    const draft = new DraftBuffer();
    expect(draft.capture(update, W)).toBe(true);
    expect(draft.capture(insert, W)).toBe(true);
    expect(draft.capture(remove, W)).toBe(true);
    expect(draft.bodies()).toEqual([update, insert, remove]);
    expect(draft.size).toBe(3);
  });

  it("keeps a write to the workout row itself", () => {
    const draft = new DraftBuffer();
    const notes: WriteOpBody = { kind: "update", table: "workouts", id: W, parents: [], patch: { notes: "x" } };
    expect(draft.capture(notes, W)).toBe(true);
    expect(draft.bodies()).toEqual([notes]);
  });

  it("passes a body for another workout through without keeping it", () => {
    const draft = new DraftBuffer();
    const other: WriteOpBody = { kind: "update", table: "sets", id: "s9", parents: ["w2", "we9"], patch: { reps: 1 } };
    const otherInsert: WriteOpBody = {
      kind: "insert",
      table: "workout_exercises",
      rows: [{ id: "we9", parents: ["w2"], values: {} }],
    };
    expect(draft.capture(other, W)).toBe(false);
    expect(draft.capture(otherInsert, W)).toBe(false);
    expect(draft.size).toBe(0);
    expect(draft.bodies()).toEqual([]);
  });

  it("clear empties it", () => {
    const draft = new DraftBuffer();
    draft.capture(update, W);
    draft.capture(insert, W);
    draft.clear();
    expect(draft.size).toBe(0);
    expect(draft.bodies()).toEqual([]);
  });

  it("hands back a copy, so a caller cannot change what is kept", () => {
    const draft = new DraftBuffer();
    draft.capture(update, W);
    draft.bodies().push(remove);
    expect(draft.size).toBe(1);
  });
});
