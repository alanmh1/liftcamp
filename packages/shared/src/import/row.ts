/**
 * One set row from any source's export, after its parser has read it.
 * `buildImportPlan` takes only this, so Fitbod, Strong and Hevy share one
 * plan. Numbers keep the file's zeros; the plan decides what a zero means.
 */
export type ImportRow = {
  /** Groups rows into one workout. */
  sessionKey: string;
  /** ISO. */
  startedAt: string;
  /** ISO, null when the file has no usable end or duration. */
  finishedAt: string | null;
  workoutName: string | null;
  workoutNote: string | null;
  exercise: string;
  warmup: boolean;
  /** Null when the cell is empty. */
  weight: number | null;
  /** Null for Strong's iOS file until the user answers, and for a Strong Android row with no unit. */
  unit: "kg" | "lb" | null;
  reps: number | null;
  durationS: number | null;
  distanceM: number | null;
  /**
   * Strong's iOS file gives distance with no unit. Its rows carry the
   * number read as km in `distanceM` and this flag; the plan converts it to
   * miles when the weight unit turns out to be lb (km with kg, miles with lb).
   */
  distanceUnknown?: boolean;
  /** Fitbod only. */
  incline: number | null;
  note: string | null;
};

/** What every parser returns. `unitKnown` is false only for Strong's iOS file. */
export type ImportParse<V extends string = string> =
  | { ok: true; rows: ImportRow[]; variant: V; unitKnown: boolean }
  | { ok: false; reason: "header" | "empty" };

/** Sessions longer than this are taken as junk in the file, and the plan estimates instead. */
export const IMPORT_MAX_SESSION_HOURS = 6;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** A trimmed cell as a number, null when empty or unreadable. */
export function numOrNull(raw: string | undefined): number | null {
  const t = (raw ?? "").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** A trimmed cell, null when empty. */
export function textOrNull(raw: string | undefined): string | null {
  const t = (raw ?? "").trim();
  return t === "" ? null : t;
}

/**
 * A local wall time (no offset) in the phone's time zone, as ISO. Built
 * with the Date constructor's parts, never `new Date(string)`. Null when
 * a part is out of range.
 */
export function localWallTimeToIso(y: number, mo: number, d: number, h: number, mi: number, s: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const date = new Date(y, mo - 1, d, h, mi, s);
  if (Number.isNaN(date.getTime()) || date.getDate() !== d) return null;
  return date.toISOString();
}

/** The start plus `seconds`, when that is a usable session length; else null. */
export function finishFromSeconds(startIso: string, seconds: number | null): string | null {
  if (seconds == null || !(seconds > 0) || seconds > IMPORT_MAX_SESSION_HOURS * 3600) return null;
  return new Date(new Date(startIso).getTime() + seconds * 1000).toISOString();
}

/** Lower-cased, trimmed header names to their column index, first one winning. */
export function headerIndex(header: readonly string[]): Map<string, number> {
  const out = new Map<string, number>();
  header.forEach((h, i) => {
    const key = h.trim().toLowerCase();
    if (!out.has(key)) out.set(key, i);
  });
  return out;
}
