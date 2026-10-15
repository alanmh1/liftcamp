import { describe, expect, it } from "vitest";

import {
  WORKOUT_NOTES_MAX,
  hasPendingFinish,
  lastRoutineNote,
  notesToSave,
  pendingWorkoutNotes,
  type RoutineNoteCandidate,
} from "./workout-notes";
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

describe("hasPendingFinish", () => {
  it("is true while the workout's finish is queued", () => {
    expect(hasPendingFinish([update(1, "w1", { finished_at: "2026-10-10T10:00:00Z" }, "finished_at")], "w1")).toBe(true);
  });

  it("is false once only a later note edit is left", () => {
    expect(hasPendingFinish([update(2, "w1", { notes: "felt strong" })], "w1")).toBe(false);
  });

  it("ignores another workout's finish", () => {
    expect(hasPendingFinish([update(1, "w2", { finished_at: "2026-10-10T10:00:00Z" }, "finished_at")], "w1")).toBe(false);
  });

  it("is false with an empty queue", () => {
    expect(hasPendingFinish([], "w1")).toBe(false);
  });
});

describe("lastRoutineNote", () => {
  const c = (workoutId: string, finishedAt: string | null, notes: string | null, templateId: string | null = "t1"): RoutineNoteCandidate => ({
    workoutId,
    templateId,
    finishedAt,
    notes,
  });

  it("takes the most recent finished workout of the day with a note", () => {
    const got = lastRoutineNote(
      [c("a", "2026-10-01T10:00:00Z", "older"), c("b", "2026-10-08T10:00:00Z", "newer")],
      "t1",
      "now",
    );
    expect(got).toBe("newer");
  });

  it("skips the workout in progress, unfinished workouts, other days and blank notes", () => {
    const got = lastRoutineNote(
      [
        c("a", "2026-10-01T10:00:00Z", "the one"),
        c("now", "2026-10-10T10:00:00Z", "this workout"),
        c("open", null, "not finished"),
        c("other", "2026-10-09T10:00:00Z", "another day", "t2"),
        c("blank", "2026-10-09T11:00:00Z", "   "),
      ],
      "t1",
      "now",
    );
    expect(got).toBe("the one");
  });

  it("is null when nothing qualifies", () => {
    expect(lastRoutineNote([c("a", "2026-10-01T10:00:00Z", null)], "t1", "now")).toBeNull();
    expect(lastRoutineNote([], "t1", "now")).toBeNull();
  });

  it("lets a later candidate for the same workout replace the server's", () => {
    // The server has the old text; the phone has an edit not yet sent.
    const got = lastRoutineNote(
      [c("a", "2026-10-08T10:00:00Z", "server text"), c("a", "2026-10-08T10:00:00Z", "edited offline")],
      "t1",
      "now",
    );
    expect(got).toBe("edited offline");
  });

  it("falls back to an older note when the phone cleared the newest", () => {
    const got = lastRoutineNote(
      [
        c("a", "2026-10-01T10:00:00Z", "older"),
        c("b", "2026-10-08T10:00:00Z", "newer"),
        c("b", "2026-10-08T10:00:00Z", null),
      ],
      "t1",
      "now",
    );
    expect(got).toBe("older");
  });

  it("trims what it returns", () => {
    expect(lastRoutineNote([c("a", "2026-10-01T10:00:00Z", "  left knee  ")], "t1", "now")).toBe("left knee");
  });
});
