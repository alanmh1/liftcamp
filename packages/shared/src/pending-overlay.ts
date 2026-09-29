// Reads that see the queue: a workout as the server has it, with every write
// still waiting on the device applied on top, so a screen that reloads
// before the sync shows what the user did rather than what the server has.

import type { Row, WriteOp } from "./write-queue";

export type OverlaySet = Row & { id: string };
export type OverlayExercise = Row & { id: string; sets?: OverlaySet[] | null };
export type OverlayWorkout = Row & { id: string; workout_exercises?: OverlayExercise[] | null };

/**
 * The workout `workoutId` with `ops` applied in order. `server` is the row
 * as read, with its `workout_exercises` and their `sets` nested, or null
 * when the server has no such workout. Null when neither the server nor the
 * queue has it, or the queue deletes it.
 *
 * Rows the queue adds get their `meta` spread over their values, which is
 * how an exercise added offline arrives with its `exercises` join. Nothing
 * is sorted; the caller orders by position as it already does.
 */
export function applyPendingOps<W extends OverlayWorkout>(
  workoutId: string,
  server: W | null,
  ops: readonly WriteOp[],
): W | null {
  let workout: OverlayWorkout | null = server
    ? {
        ...server,
        workout_exercises: (server.workout_exercises ?? []).map((we) => ({ ...we, sets: [...(we.sets ?? [])] })),
      }
    : null;

  const exercises = () => (workout?.workout_exercises ?? []) as (OverlayExercise & { sets: OverlaySet[] })[];

  for (const op of ops) {
    if (op.kind === "insert") {
      for (const row of op.rows) {
        const values: Row & { id: string } = { ...row.values, ...row.meta, id: row.id };
        if (op.table === "workouts" && row.id === workoutId && !workout) {
          workout = { ...values, workout_exercises: [] } as OverlayWorkout;
        } else if (op.table === "workout_exercises" && workout && values.workout_id === workoutId) {
          if (!exercises().some((we) => we.id === row.id)) {
            workout.workout_exercises = [...exercises(), { ...values, sets: [] }];
          }
        } else if (op.table === "sets" && workout) {
          const we = exercises().find((x) => x.id === values.workout_exercise_id);
          if (we && !we.sets.some((s) => s.id === row.id)) we.sets.push(values);
        }
      }
      continue;
    }

    if (op.kind === "update") {
      const patch = { ...op.patch, ...op.meta };
      if (op.table === "workouts" && workout && op.id === workoutId) {
        if (!op.onlyIfNull || workout[op.onlyIfNull] == null) workout = { ...workout, ...patch };
      } else if (op.table === "workout_exercises" && workout) {
        workout.workout_exercises = exercises().map((we) => (we.id === op.id ? { ...we, ...patch } : we));
      } else if (op.table === "sets" && workout) {
        for (const we of exercises()) we.sets = we.sets.map((s) => (s.id === op.id ? { ...s, ...patch } : s));
      }
      continue;
    }

    if (op.table === "workouts" && op.id === workoutId) workout = null;
    else if (op.table === "workout_exercises" && workout) {
      workout.workout_exercises = exercises().filter((we) => we.id !== op.id);
    } else if (op.table === "sets" && workout) {
      for (const we of exercises()) we.sets = we.sets.filter((s) => s.id !== op.id);
    }
  }

  return workout as W | null;
}
