import { METERS_PER_KM, METERS_PER_MILE } from "../cardio";
import { parseCsv } from "./csv";
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
 * Hevy's CSV export. Comma, fields quoted:
 *
 *   title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe
 *
 * A lb user's file has `weight_lbs` and `distance_miles` instead, so the
 * header says the unit. Times are local wall time, `14 Oct 2025, 18:05` or
 * the older `Jun 8, 2025, 8:13 PM`. A workout is every row sharing
 * `start_time` and `title`. `superset_id` and `rpe` are ignored.
 */
export type HevyParse = ImportParse<"hevy">;

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function hour24(h: number, meridiem: string | undefined): number | null {
  if (!meridiem) return h;
  if (h < 1 || h > 12) return null;
  const pm = meridiem.toLowerCase() === "pm";
  return (h % 12) + (pm ? 12 : 0);
}

/** Either Hevy time format, as local wall time, to ISO. Null when it is neither. */
export function hevyDateToIso(raw: string): string | null {
  const t = raw.trim();
  // 14 Oct 2025, 18:05
  let m = t.match(/^(\d{1,2}) ([A-Za-z]{3,9})\.? (\d{4}),? (\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/);
  if (m) {
    const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
    const h = hour24(+m[4], m[7]);
    if (!month || h == null) return null;
    return localWallTimeToIso(+m[3], month, +m[1], h, +m[5], m[6] ? +m[6] : 0);
  }
  // Jun 8, 2025, 8:13 PM
  m = t.match(/^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4}),? (\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/);
  if (m) {
    const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
    const h = hour24(+m[4], m[7]);
    if (!month || h == null) return null;
    return localWallTimeToIso(+m[3], month, +m[2], h, +m[5], m[6] ? +m[6] : 0);
  }
  return null;
}

/**
 * Parses a Hevy export. Refused with `header` when the header lacks
 * `title`, `start_time` or `exercise_title`, `empty` when no row parses
 * (which includes a file whose times are in neither format).
 * `exercise_notes`, repeated on every row, goes on the exercise's first
 * set in each workout.
 */
export function parseHevy(text: string): HevyParse {
  const table = parseCsv(text);
  if (table.length === 0) return { ok: false, reason: "empty" };

  const col = headerIndex(table[0]);
  const title = col.get("title");
  const start = col.get("start_time");
  const exercise = col.get("exercise_title");
  if (title == null || start == null || exercise == null) return { ok: false, reason: "header" };

  const end = col.get("end_time");
  const description = col.get("description");
  const exerciseNotes = col.get("exercise_notes");
  const setType = col.get("set_type");
  const weightKg = col.get("weight_kg");
  const weightLbs = col.get("weight_lbs");
  const unit: "kg" | "lb" = weightKg == null && weightLbs != null ? "lb" : "kg";
  const weightCol = weightKg ?? weightLbs;
  const distanceKm = col.get("distance_km");
  const distanceMiles = col.get("distance_miles");
  const distanceCol = distanceKm ?? distanceMiles;
  const metersPer = distanceKm != null ? METERS_PER_KM : METERS_PER_MILE;
  const reps = col.get("reps");
  const duration = col.get("duration_seconds");

  const cell = (cells: string[], i: number | undefined) => (i == null ? undefined : cells[i]);

  const rows: ImportRow[] = [];
  const noted = new Set<string>();
  for (const cells of table.slice(1)) {
    const startRaw = (cell(cells, start) ?? "").trim();
    const startedAt = hevyDateToIso(startRaw);
    const exerciseName = (cell(cells, exercise) ?? "").trim();
    if (!startedAt || !exerciseName) continue;

    const workoutName = textOrNull(cell(cells, title));
    const sessionKey = `${startRaw}|${workoutName ?? ""}`;

    let finishedAt: string | null = null;
    const endIso = hevyDateToIso(cell(cells, end) ?? "");
    if (endIso) finishedAt = finishFromSeconds(startedAt, (Date.parse(endIso) - Date.parse(startedAt)) / 1000);

    const noteKey = `${sessionKey}\u0000${exerciseName}`;
    let note: string | null = null;
    if (!noted.has(noteKey)) {
      noted.add(noteKey);
      note = textOrNull(cell(cells, exerciseNotes));
    }

    const weight = numOrNull(cell(cells, weightCol));
    const distance = numOrNull(cell(cells, distanceCol));
    const repsN = numOrNull(cell(cells, reps));
    const durationN = numOrNull(cell(cells, duration));

    rows.push({
      sessionKey,
      startedAt,
      finishedAt,
      workoutName,
      workoutNote: textOrNull(cell(cells, description)),
      exercise: exerciseName,
      warmup: (cell(cells, setType) ?? "").trim().toLowerCase() === "warmup",
      weight: weight == null ? null : round2(weight),
      unit,
      reps: repsN == null ? null : Math.round(repsN),
      durationS: durationN == null ? null : Math.round(durationN),
      distanceM: distance == null ? null : round2(distance * metersPer),
      incline: null,
      note,
    });
  }

  if (rows.length === 0) return { ok: false, reason: "empty" };
  return { ok: true, rows, variant: "hevy", unitKnown: true };
}
