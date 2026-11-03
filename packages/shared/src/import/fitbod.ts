import { parseCsv } from "./csv";

/**
 * Fitbod's CSV export. Header, exactly:
 *
 *   Date,Exercise,Reps,Weight(kg),Duration(s),Distance(m),Incline,Resistance,isWarmup,Note,multiplier
 *
 * Checked against a real three-year export (2 Nov 2026). `Date` is a UTC
 * time shared by every row of one session. Numbers may carry a leading
 * space. `Weight(kg)` is kg, per dumbbell for dumbbell work, and lb-entered
 * values carry long decimals, so it is rounded to 2 places. `multiplier`
 * (Fitbod's volume factor) and `Resistance` are ignored.
 */
export const FITBOD_HEADER = [
  "Date",
  "Exercise",
  "Reps",
  "Weight(kg)",
  "Duration(s)",
  "Distance(m)",
  "Incline",
  "Resistance",
  "isWarmup",
  "Note",
  "multiplier",
] as const;

export type FitbodRow = {
  /** ISO 8601 UTC, from `Date`. The session key. */
  startedAt: string;
  exercise: string;
  reps: number;
  weightKg: number;
  durationS: number;
  distanceM: number;
  incline: number;
  warmup: boolean;
  /** Null when the cell is empty. */
  note: string | null;
};

export type FitbodParse = { ok: true; rows: FitbodRow[] } | { ok: false; reason: "header" | "empty" };

const COL = {
  date: 0,
  exercise: 1,
  reps: 2,
  weight: 3,
  duration: 4,
  distance: 5,
  incline: 6,
  warmup: 8,
  note: 9,
} as const;

/** `2026-10-30 18:04:12 +0000` to `2026-10-30T18:04:12.000Z`. Null if it is not that shape. */
export function fitbodDateToIso(raw: string): string | null {
  const m = raw.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})\s*([+-])(\d{2}):?(\d{2})$/);
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}${m[3]}${m[4]}:${m[5]}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function num(raw: string | undefined): number {
  const t = (raw ?? "").trim();
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Parses a Fitbod export. Refused with `header` when the first row is not
 * Fitbod's header, `empty` when no row parses. A row with no exercise name
 * or an unreadable date is left out. Zeros stay zeros here; the plan
 * decides what a zero means.
 */
export function parseFitbod(text: string): FitbodParse {
  const table = parseCsv(text);
  if (table.length === 0) return { ok: false, reason: "empty" };

  const header = table[0].map((h) => h.trim());
  const headerOk =
    header.length === FITBOD_HEADER.length && FITBOD_HEADER.every((name, i) => header[i] === name);
  if (!headerOk) return { ok: false, reason: "header" };

  const rows: FitbodRow[] = [];
  for (const cells of table.slice(1)) {
    const startedAt = fitbodDateToIso(cells[COL.date] ?? "");
    const exercise = (cells[COL.exercise] ?? "").trim();
    if (!startedAt || !exercise) continue;
    const note = (cells[COL.note] ?? "").trim();
    rows.push({
      startedAt,
      exercise,
      reps: Math.round(num(cells[COL.reps])),
      weightKg: round2(num(cells[COL.weight])),
      durationS: Math.round(num(cells[COL.duration])),
      distanceM: round2(num(cells[COL.distance])),
      incline: num(cells[COL.incline]),
      warmup: (cells[COL.warmup] ?? "").trim().toLowerCase() === "true",
      note: note === "" ? null : note,
    });
  }

  return rows.length === 0 ? { ok: false, reason: "empty" } : { ok: true, rows };
}
