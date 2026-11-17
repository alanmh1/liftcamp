// The routine builder (docs/routine-builder-spec.md) and the Workout tab's
// rotation list. Pure, no React, no Supabase.

import type { RoutineEntry } from "./routine-changes";

/** The Sets stepper's range and the value a new exercise starts at. */
export const BUILDER_SETS_MIN = 1;
export const BUILDER_SETS_MAX = 10;
export const BUILDER_SETS_DEFAULT = 3;

/** One exercise card in the builder: the stepper's value and the Reps field as typed. */
export type BuilderEntry = { exerciseId: string; sets: number; reps: string };

/** A new card's targets: 3 sets, Reps empty. */
export function newBuilderEntry(exerciseId: string): BuilderEntry {
  return { exerciseId, sets: BUILDER_SETS_DEFAULT, reps: "" };
}

/** The stepper after a tap of − (-1) or + (+1), held to 1 to 10. */
export function stepSets(sets: number, delta: number): number {
  return Math.min(BUILDER_SETS_MAX, Math.max(BUILDER_SETS_MIN, Math.round(sets) + delta));
}

/**
 * The cards of a saved routine, in position order, for Edit routine. A
 * row with no set target (or one out of range) starts at the default, so
 * the stepper always shows a number; Reps shows the target as stored.
 */
export function builderEntriesFrom(
  rows: { exercise_id: string; position: number; target_sets?: number | null; target_reps?: string | null }[],
): BuilderEntry[] {
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      exerciseId: r.exercise_id,
      sets:
        r.target_sets != null && r.target_sets >= BUILDER_SETS_MIN
          ? Math.min(BUILDER_SETS_MAX, Math.round(r.target_sets))
          : BUILDER_SETS_DEFAULT,
      reps: r.target_reps ?? "",
    }));
}

/** The rows to write: Reps trimmed, blank stored as null. */
export function routineEntriesFrom(entries: BuilderEntry[]): RoutineEntry[] {
  return entries.map((e) => {
    const reps = e.reps.trim();
    return { exerciseId: e.exerciseId, targetSets: e.sets, targetReps: reps === "" ? null : reps };
  });
}

/** Save is on once the name is not blank and there is at least one exercise. */
export function canSaveRoutine(name: string, entries: readonly unknown[]): boolean {
  return name.trim() !== "" && entries.length > 0;
}

/** Whether two routines hold the same exercises, in the same order, with the same targets as written. */
export function sameRoutineEntries(a: BuilderEntry[], b: BuilderEntry[]): boolean {
  const ra = routineEntriesFrom(a);
  const rb = routineEntriesFrom(b);
  return (
    ra.length === rb.length &&
    ra.every(
      (e, i) =>
        e.exerciseId === rb[i].exerciseId && e.targetSets === rb[i].targetSets && e.targetReps === rb[i].targetReps,
    )
  );
}

/**
 * Whether Cancel should ask first. A new routine counts as changed once
 * anything is typed or added; an edit, once the name (trimmed) or the
 * exercises differ from what was opened.
 */
export function builderChanged(
  initial: { name: string; entries: BuilderEntry[] },
  current: { name: string; entries: BuilderEntry[] },
): boolean {
  return initial.name.trim() !== current.name.trim() || !sameRoutineEntries(initial.entries, current.entries);
}

/** Save routine's same-name rule: trimmed, any case. */
export function isTakenRoutineName(name: string, names: readonly string[]): boolean {
  const n = name.trim().toLowerCase();
  return n !== "" && names.some((t) => t.trim().toLowerCase() === n);
}

/**
 * The rotation as it reads under Up next: the routines after the Up next
 * one, in rotation order, wrapping around, without Up next itself. With
 * no Up next (or one not in the rotation), the rotation as it is.
 */
export function rotationAfter<T extends { id: string }>(rotation: T[], upNextId: string | null | undefined): T[] {
  const at = upNextId ? rotation.findIndex((t) => t.id === upNextId) : -1;
  if (at < 0) return rotation;
  return [...rotation.slice(at + 1), ...rotation.slice(0, at)];
}

/** How many rotation rows show before Show all. */
export const ROTATION_PREVIEW = 3;

export type RotationList<T> = {
  /** Rotation rows shown, numbered from 1. */
  rotation: T[];
  /** Out-of-rotation rows shown, under "Not in rotation". Empty while collapsed. */
  others: T[];
  /** Every routine the list holds expanded: the Show all count. */
  total: number;
  /** Whether the Show all / Show less row is drawn. */
  toggle: boolean;
};

/**
 * Your rotation, collapsed or expanded. Collapsed: the first three after
 * Up next. Expanded: all of them, then every routine out of the rotation.
 * The toggle shows whenever expanding would add a row. Nothing to show at
 * all (no rows, no toggle) means the section hides.
 */
export function rotationList<T>(after: T[], others: T[], expanded: boolean): RotationList<T> {
  const total = after.length + others.length;
  const toggle = total > Math.min(after.length, ROTATION_PREVIEW);
  if (expanded && toggle) return { rotation: after, others, total, toggle };
  return { rotation: after.slice(0, ROTATION_PREVIEW), others: [], total, toggle };
}
