import { describe, expect, it } from "vitest";

import { WORKOUT_NOTES_MAX, notesToSave, pendingWorkoutNotes } from "./workout-notes";
import type { WriteOp } from "./write-queue";

const base = { userId: "u1", enqueuedAt: 0, attempts: 0 };

function update(seq: number, id: string, patch: Record<string, unknown>, onlyIfNull?: string): WriteOp {
  return { ...base, seq, kind: "update", table: "workouts", id, parents: [], patch, ...(onlyIfNull ? { onlyIfNull } : {}) };
}

describe("notesToSave", () => {
  it("trims", () => {
    expect(notesToSave("  slept badly \n")).toBe("slept badly");
  });

  it("saves an empty or blank box as null", () => {
    expect(notesToSave("")).toBeNull();
    expect(notesToSave(" \n\t ")).toBeNull();
  });

  it("keeps line breaks inside the note", () => {
    expect(notesToSave("left knee\nfelt fine")).toBe("left knee\nfelt fine");
  });

  it("cuts at the cap in characters, not UTF-16 units", () => {
    const long = "💪".repeat(WORKOUT_NOTES_MAX + 10);
    const saved = notesToSave(long)!;
    expect(Array.from(saved)).toHaveLength(WORKOUT_NOTES_MAX);
  });

  it("leaves a note at the cap alone", () => {
    const exact = "a".repeat(WORKOUT_NOTES_MAX);
    expect(notesToSave(exact)).toBe(exact);
  });
});

describe("pendingWorkoutNotes", () => {
  it("is undefined with nothing queued for the workout", () => {
    expect(pendingWorkoutNotes([], "w1")).toBeUndefined();
    expect(pendingWorkoutNotes([update(1, "w2", { notes: "other" })], "w1")).toBeUndefined();
  });

  it("ignores workout updates that do not touch the note", () => {
    expect(pendingWorkoutNotes([update(1, "w1", { finished_at: "2026-10-10T10:00:00Z" }, "finished_at")], "w1")).toBeUndefined();
  });

  it("takes the last queued note", () => {
    const ops = [update(1, "w1", { notes: "first" }), update(2, "w1", { notes: "second" })];
    expect(pendingWorkoutNotes(ops, "w1")).toBe("second");
  });

  it("reports a queued clear as null", () => {
    const ops = [update(1, "w1", { notes: "first" }), update(2, "w1", { notes: null })];
    expect(pendingWorkoutNotes(ops, "w1")).toBeNull();
  });

  it("reads a note merged into the workout's unsent insert", () => {
    const insert: WriteOp = {
      ...base,
      seq: 1,
      kind: "insert",
      table: "workouts",
      rows: [{ id: "w1", parents: [], values: { id: "w1", notes: "from the insert" } }],
    };
    expect(pendingWorkoutNotes([insert], "w1")).toBe("from the insert");
  });

  it("ignores an insert with no note column", () => {
    const insert: WriteOp = {
      ...base,
      seq: 1,
      kind: "insert",
      table: "workouts",
      rows: [{ id: "w1", parents: [], values: { id: "w1" } }],
    };
    expect(pendingWorkoutNotes([insert], "w1")).toBeUndefined();
  });
});
