import { METERS_PER_KM, METERS_PER_MILE } from "../cardio";
import { detectDelimiter, parseCsv } from "./csv";
import {
  finishFromSeconds,
  headerIndex,
  localWallTimeToIso,
  numOrNull,
  round2,
  textOrNull,
  type ImportParse,
  type ImportRow,
} from "./row";

/**
 * Strong's CSV export, in three header variants (docs/import-strong-hevy-spec.md):
 *
 * - `ios` (older): comma, `Duration` as text, `Weight` and `Distance` with
 *   no unit anywhere in the file, so the review screen asks.
 * - `android`: semicolon, `Weight Unit` (`lbs`, `kgs`) and `Distance Unit`
 *   (`mi.`, `km`) per row, `Workout Duration` as text.
 * - `current`: semicolon, every field quoted, `Workout #`, `Duration (sec)`,
 *   `Weight (kg)` or `Weight (lbs)`, `Distance (meters)`.
 *
 * Columns are read by header name, trimmed and case-insensitive. `Date` is
 * local wall time. A workout is every row sharing `Date` and `Workout Name`.
 */
export type StrongVariant = "ios" | "android" | "current";

export type StrongParse = ImportParse<StrongVariant>;

/** `2025-03-04 18:30:12` as local wall time, to ISO. */
export function strongDateToIso(raw: string): string | null {
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return localWallTimeToIso(+m[1], +m[2], +m[3], +m[4], +m[5], m[6] ? +m[6] : 0);
}

/** `1h 5m`, `38min`, `55m`, `2h`, `45s` to seconds. Null when it is not that shape. */
export function strongDurationToSeconds(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  if (t === "") return null;
  const m = t.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m(?:in)?)?\s*(?:(\d+)\s*s(?:ec)?)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return (m[1] ? +m[1] * 3600 : 0) + (m[2] ? +m[2] * 60 : 0) + (m[3] ? +m[3] : 0);
}

function weightUnitOf(raw: string | undefined): "kg" | "lb" | null {
  const t = (raw ?? "").trim().toLowerCase();
  if (t === "kg" || t === "kgs") return "kg";
  if (t === "lb" || t === "lbs") return "lb";
  return null;
}

/** Meters per unit of an Android `Distance Unit`, null when it is empty or unknown. */
function metersPerDistanceUnit(raw: string | undefined): number | null {
  const t = (raw ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (t === "mi" || t === "mile" || t === "miles") return METERS_PER_MILE;
  if (t === "km") return METERS_PER_KM;
  if (t === "m") return 1;
  return null;
}

/**
 * Parses a Strong export. Refused with `header` when the header lacks any of
 * `Date`, `Exercise Name` and `Set Order`, `empty` when no set row parses.
 * Rows with `Set Order` `Rest Timer` or `Note` are not sets and are dropped;
 * `W` is a warm-up; `D`, `F` and numbers are working sets.
 */
export function parseStrong(text: string): StrongParse {
  const table = parseCsv(text, detectDelimiter(text));
  if (table.length === 0) return { ok: false, reason: "empty" };

  const col = headerIndex(table[0]);
  const date = col.get("date");
  const exercise = col.get("exercise name");
  const setOrder = col.get("set order");
  if (date == null || exercise == null || setOrder == null) return { ok: false, reason: "header" };

  const weightKg = col.get("weight (kg)");
  const weightLbs = col.get("weight (lbs)");
  const current = col.has("workout #") || col.has("duration (sec)") || weightKg != null || weightLbs != null;
  const variant: StrongVariant = current ? "current" : col.has("weight unit") ? "android" : "ios";

  const weightCol = weightKg ?? weightLbs ?? col.get("weight");
  const fileUnit: "kg" | "lb" | null = weightKg != null ? "kg" : weightLbs != null ? "lb" : null;
  const weightUnitCol = col.get("weight unit");
  const distanceMetersCol = col.get("distance (meters)");
  const distanceCol = distanceMetersCol ?? col.get("distance");
  const distanceUnitCol = col.get("distance unit");
  const durationSecCol = col.get("duration (sec)");
  const durationTextCol = col.get("duration") ?? col.get("workout duration");
  const name = col.get("workout name");
  const reps = col.get("reps");
  const seconds = col.get("seconds");
  const notes = col.get("notes");
  const workoutNotes = col.get("workout notes");

  const cell = (cells: string[], i: number | undefined) => (i == null ? undefined : cells[i]);

  const rows: ImportRow[] = [];
  for (const cells of table.slice(1)) {
    const order = (cell(cells, setOrder) ?? "").trim().toLowerCase();
    if (order === "rest timer" || order === "note") continue;
    const dateRaw = (cell(cells, date) ?? "").trim();
    const startedAt = strongDateToIso(dateRaw);
    const exerciseName = (cell(cells, exercise) ?? "").trim();
    if (!startedAt || !exerciseName) continue;

    const workoutName = textOrNull(cell(cells, name));

    const durationS =
      durationSecCol != null
        ? numOrNull(cell(cells, durationSecCol))
        : strongDurationToSeconds(cell(cells, durationTextCol) ?? "");

    const unit = variant === "android" ? weightUnitOf(cell(cells, weightUnitCol)) : fileUnit;

    const distance = numOrNull(cell(cells, distanceCol));
    let distanceM: number | null = null;
    let distanceUnknown = false;
    if (distance != null) {
      if (distanceMetersCol != null) {
        distanceM = round2(distance);
      } else {
        const perUnit = variant === "android" ? metersPerDistanceUnit(cell(cells, distanceUnitCol)) : null;
        if (perUnit != null) {
          distanceM = round2(distance * perUnit);
        } else {
          // No unit: km with kg, miles with lb, settled by the plan.
          distanceM = round2(distance * METERS_PER_KM);
          distanceUnknown = true;
        }
      }
    }

    const repsN = numOrNull(cell(cells, reps));
    const secondsN = numOrNull(cell(cells, seconds));
    const weight = numOrNull(cell(cells, weightCol));

    const row: ImportRow = {
      sessionKey: `${dateRaw}|${workoutName ?? ""}`,
      startedAt,
      finishedAt: finishFromSeconds(startedAt, durationS),
      workoutName,
      workoutNote: textOrNull(cell(cells, workoutNotes)),
      exercise: exerciseName,
      warmup: order === "w",
      weight: weight == null ? null : round2(weight),
      unit,
      reps: repsN == null ? null : Math.round(repsN),
      durationS: secondsN == null ? null : Math.round(secondsN),
      distanceM,
      incline: null,
      note: textOrNull(cell(cells, notes)),
    };
    if (distanceUnknown) row.distanceUnknown = true;
    rows.push(row);
  }

  if (rows.length === 0) return { ok: false, reason: "empty" };
  return { ok: true, rows, variant, unitKnown: variant !== "ios" };
}
