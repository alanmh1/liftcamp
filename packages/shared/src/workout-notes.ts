// A workout's note (`workouts.notes`): "slept badly, felt strong". Written
// from the workout screen and the summary, read on the History detail.

import type { WriteOp } from "./write-queue";

/**
 * The longest note, in characters. The longest the PWA saw was 108; 500 is
 * a paragraph, room for sleep, energy and an ache, and still short enough
 * to sit under a workout. The server enforces it too
 * (docs/workout-notes.sql, `workouts_notes_length_check`).
 */
export const WORKOUT_NOTES_MAX = 500;

/** How many characters in the box before the counter shows. */
export const WORKOUT_NOTES_COUNTER_AT = 400;

/**
 * What the note box's text is saved as: trimmed, null when that leaves
 * nothing, and never over the cap. The box keeps what was typed.
 */
export function notesToSave(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const chars = Array.from(trimmed);
  return chars.length > WORKOUT_NOTES_MAX ? chars.slice(0, WORKOUT_NOTES_MAX).join("").trimEnd() : trimmed;
}

/**
 * The note last queued for `workoutId` and not yet sent, or undefined when
 * the queue has none. Null is a queued clear. For reads that do not go
 * through applyPendingOps: the History detail and the summary drawn from
 * the phone.
 */
export function pendingWorkoutNotes(ops: readonly WriteOp[], workoutId: string): string | null | undefined {
  let notes: string | null | undefined;
  for (const op of ops) {
    if (op.table !== "workouts") continue;
    if (op.kind === "insert") {
      const row = op.rows.find((r) => r.id === workoutId);
      if (row && "notes" in row.values) notes = (row.values.notes as string | null) ?? null;
    } else if (op.kind === "update" && op.id === workoutId && "notes" in op.patch) {
      notes = (op.patch.notes as string | null) ?? null;
    }
  }
  return notes;
}
