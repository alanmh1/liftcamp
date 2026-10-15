// Op builders shared by the write queue tests.

import type { WriteOpBody } from "./write-queue";

export const W = "w1";
export const E = "we1";

export const ops = {
  workout: (id = W): WriteOpBody => ({
    kind: "insert",
    table: "workouts",
    rows: [{ id, parents: [], values: { id, user_id: "u1", name: null } }],
  }),
  exercise: (id = E, workoutId = W): WriteOpBody => ({
    kind: "insert",
    table: "workout_exercises",
    rows: [{ id, parents: [workoutId], values: { id, workout_id: workoutId, exercise_id: "x1", position: 0 } }],
  }),
  sets: (ids: string[], weId = E, workoutId = W): WriteOpBody => ({
    kind: "insert",
    table: "sets",
    rows: ids.map((id, i) => ({
      id,
      parents: [workoutId, weId],
      values: { id, workout_exercise_id: weId, position: i, reps: null, completed: false },
    })),
  }),
  setUpdate: (id: string, patch: Record<string, unknown>, weId = E, workoutId = W): WriteOpBody => ({
    kind: "update",
    table: "sets",
    id,
    parents: [workoutId, weId],
    patch,
  }),
  setDelete: (id: string, weId = E, workoutId = W): WriteOpBody => ({
    kind: "delete",
    table: "sets",
    id,
    parents: [workoutId, weId],
  }),
  finish: (workoutId = W): WriteOpBody => ({
    kind: "update",
    table: "workouts",
    id: workoutId,
    parents: [],
    patch: { finished_at: "2026-09-29T18:00:00.000Z" },
    onlyIfNull: "finished_at",
  }),
  /** setWorkoutNotes in the app: the note as saved, or null for a cleared box. */
  notes: (notes: string | null, workoutId = W): WriteOpBody => ({
    kind: "update",
    table: "workouts",
    id: workoutId,
    parents: [],
    patch: { notes },
  }),
  discard: (workoutId = W): WriteOpBody => ({ kind: "delete", table: "workouts", id: workoutId, parents: [] }),
  removeTemplate: (templateId: string): WriteOpBody => ({ kind: "delete", table: "templates", id: templateId, parents: [] }),
};
