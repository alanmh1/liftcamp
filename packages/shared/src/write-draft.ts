// Holds a workout's writes while it is being edited, so Save can queue them
// all at once and Cancel can drop them without the server ever seeing one.
//
// Pure and in memory. The mobile write queue owns when a draft is open and
// what happens to its bodies on Save.

import type { WriteOpBody } from "./write-queue";

/** Whether a body writes, changes or removes the workout, or a row under it. */
function touchesWorkout(body: WriteOpBody, workoutId: string): boolean {
  if (body.kind === "insert") {
    return body.rows.some((r) => r.id === workoutId || r.parents.includes(workoutId));
  }
  return body.id === workoutId || body.parents.includes(workoutId);
}

export class DraftBuffer {
  private kept: WriteOpBody[] = [];

  /**
   * Keeps `body` when it touches `workoutId` (its id, or the workout in its
   * `parents`, or in any insert row's `parents`) and returns true. Anything
   * else is not kept and returns false.
   */
  capture(body: WriteOpBody, workoutId: string): boolean {
    if (!touchesWorkout(body, workoutId)) return false;
    this.kept.push(body);
    return true;
  }

  /** The kept bodies, in the order they arrived. */
  bodies(): WriteOpBody[] {
    return this.kept.slice();
  }

  clear(): void {
    this.kept = [];
  }

  get size(): number {
    return this.kept.length;
  }
}
