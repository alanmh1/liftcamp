import type { WeightUnit } from "./units";

/**
 * Cardio: exercises logged as time and distance instead of weight and
 * reps. `exercises.set_type` is 'cardio' for the 14 of them and null for
 * every strength exercise. A cardio set keeps its time in
 * `sets.duration_seconds` and its distance in `sets.distance_meters`;
 * `weight_value` and `reps` stay null.
 *
 * Cardio adds no volume, sets no PR, and has no estimated max, strength
 * level or progression. `effectiveLoad`, `setVolume` and `loadRuleFor`
 * check `isCardio`, so every caller of those leaves it out.
 */

export const CARDIO_SET_TYPE = "cardio";

export function isCardio(exercise: { set_type?: string | null } | null | undefined): boolean {
  return exercise?.set_type === CARDIO_SET_TYPE;
}

// ---------------------------------------------------------------------------
// Time: typed like a timer
// ---------------------------------------------------------------------------

/**
 * The most digits the time box takes: 999:99, which is past 16 hours.
 * Keystrokes beyond it are dropped.
 */
export const TIMER_MAX_DIGITS = 5;

/**
 * The digits a time box holds, from whatever its text now reads. Digits
 * fill from the right like a kitchen timer, so the text is read for its
 * digits alone: "25:00" with a 1 typed after it is "25001", and with its
 * last character deleted is "250". Leading zeros go, so the box empties
 * once every digit is deleted. Past TIMER_MAX_DIGITS the keystroke is
 * dropped.
 */
export function timerDigits(text: string): string {
  const digits = text.replace(/[^0-9]/g, "").replace(/^0+/, "");
  return digits.length > TIMER_MAX_DIGITS ? digits.slice(0, TIMER_MAX_DIGITS) : digits;
}

/**
 * Timer digits as the focused box shows them: the last two are seconds,
 * the rest minutes, at least two of each. "2500" is "25:00", "7500" is
 * "75:00" (minutes go past 59 while typing), "5" is "00:05". Empty for no
 * digits, so the box shows its placeholder.
 */
export function formatTimerDigits(digits: string): string {
  if (digits === "") return "";
  const padded = digits.padStart(4, "0");
  return `${padded.slice(0, -2)}:${padded.slice(-2)}`;
}

/**
 * The seconds timer digits stand for: minutes times 60 plus seconds.
 * "2500" is 1500, "7500" is 4500, and "99" is 99 (it prints as 01:39 once
 * the box loses focus). Null for no digits.
 */
export function timerSeconds(digits: string): number | null {
  if (digits === "") return null;
  const padded = digits.padStart(3, "0");
  const minutes = Number(padded.slice(0, -2));
  const seconds = Number(padded.slice(-2));
  const total = minutes * 60 + seconds;
  return total > 0 ? total : null;
}

/** Seconds as timer digits, for a box taking focus over a saved time: 1500 is "2500". */
export function secondsToTimerDigits(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return "";
  const s = Math.round(seconds);
  return timerDigits(`${Math.floor(s / 60)}${String(s % 60).padStart(2, "0")}`);
}

/**
 * A time as mm:ss ("25:00", "05:30"), or h:mm:ss at 60 minutes and over
 * ("1:15:00"). Empty for no time.
 */
export function formatCardioTime(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return "";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${String(m).padStart(2, "0")}:${ss}`;
}

// ---------------------------------------------------------------------------
// Distance: km or mi, stored in meters
// ---------------------------------------------------------------------------

export type DistanceUnit = "km" | "mi";

export const METERS_PER_KM = 1000;
/** Exact by definition of the international mile. */
export const METERS_PER_MILE = 1609.344;

/** The distance unit that goes with a weight unit: kg is km, lb is mi. */
export function distanceUnitFor(unit: WeightUnit): DistanceUnit {
  return unit === "kg" ? "km" : "mi";
}

function metersPer(unit: DistanceUnit): number {
  return unit === "km" ? METERS_PER_KM : METERS_PER_MILE;
}

/** Meters as a distance in the user's unit, unrounded. Null for no distance. */
export function metersToDistance(meters: number | null | undefined, unit: WeightUnit): number | null {
  if (meters == null) return null;
  return meters / metersPer(distanceUnitFor(unit));
}

/**
 * A typed distance in the user's unit as meters to store, to the
 * centimeter. 3.2 mi is 5149.9 m and prints back as 3.2. Null for no
 * distance.
 */
export function distanceToMeters(value: number | null | undefined, unit: WeightUnit): number | null {
  if (value == null) return null;
  return Math.round(value * metersPer(distanceUnitFor(unit)) * 100) / 100;
}

/**
 * A distance as its box and every label print it: the user's unit,
 * rounded to 0.01 with trailing zeros dropped. 5149.9 m in mi is "3.2".
 * Empty for no distance.
 */
export function tidyDistance(meters: number | null | undefined, unit: WeightUnit): string {
  const v = metersToDistance(meters, unit);
  if (v == null) return "";
  return String(Math.round(v * 100) / 100);
}

/** "3.2 km", "1.5 mi". Empty for no distance. */
export function formatDistance(meters: number | null | undefined, unit: WeightUnit): string {
  const v = tidyDistance(meters, unit);
  return v === "" ? "" : `${v} ${distanceUnitFor(unit)}`;
}

/**
 * A cardio set as one line: "25:00 · 3.2 km", or just the part that
 * exists. Null when it has neither. The Previous column, History, the
 * workout detail and the Live Activity all print a cardio set this way.
 */
export function formatCardioSet(
  set: { duration_seconds?: number | null; distance_meters?: number | null } | null | undefined,
  unit: WeightUnit,
): string | null {
  if (!set) return null;
  const parts = [formatCardioTime(set.duration_seconds), formatDistance(set.distance_meters, unit)].filter(
    (p) => p !== "",
  );
  return parts.length === 0 ? null : parts.join(" · ");
}

/**
 * The total time of the completed cardio sets, in seconds. The summary
 * and share card show it where volume would go when a workout has no
 * strength volume.
 */
export function cardioSeconds(
  exercises: readonly {
    exercise: { set_type?: string | null } | null;
    sets: readonly { completed: boolean; duration_seconds?: number | null }[] | null;
  }[],
): number {
  let total = 0;
  for (const we of exercises) {
    if (!isCardio(we.exercise)) continue;
    for (const s of we.sets ?? []) {
      if (s.completed && s.duration_seconds != null && s.duration_seconds > 0) total += s.duration_seconds;
    }
  }
  return total;
}

/**
 * The stat a finished workout shows for its work: its volume, as
 * "18,140 lbs", or, when it has no strength volume but has cardio, its
 * total cardio time under the label "Cardio". `unitLabel` is the unit as
 * the app prints it ("lbs", "kg"). The summary, the share card, History
 * and Home's last workout all show it.
 */
export function workStat(
  volume: number,
  cardioTotalSeconds: number | null | undefined,
  unitLabel: string,
): { label: string; value: string } {
  if (volume <= 0 && cardioTotalSeconds != null && cardioTotalSeconds > 0) {
    return { label: "Cardio", value: formatCardioTime(cardioTotalSeconds) };
  }
  return { label: "Volume", value: `${Math.round(volume).toLocaleString()} ${unitLabel}` };
}

// ---------------------------------------------------------------------------
// The exercise screen
// ---------------------------------------------------------------------------

type CardioSet = { duration_seconds?: number | null; distance_meters?: number | null };

/** One finished session's completed sets of a cardio exercise. */
export type CardioSession = { workoutId: string; workoutDate: string; sets: readonly CardioSet[] };

export type CardioRecord = { value: number; workoutId: string; workoutDate: string };

export type CardioRecords = {
  /** The longest single set, in seconds. */
  longestTime: CardioRecord | null;
  /** The longest single set, in meters. */
  longestDistance: CardioRecord | null;
};

/** A session's total time in seconds, for the exercise screen's chart. */
export function cardioSessionSeconds(sets: readonly CardioSet[]): number {
  return sets.reduce((sum, s) => sum + (s.duration_seconds != null && s.duration_seconds > 0 ? s.duration_seconds : 0), 0);
}

/**
 * The longest time and the longest distance in one set, across sessions,
 * each remembering the workout it came from. A tie goes to the earlier
 * session, the one that set the record first, as exerciseRecords does.
 */
export function cardioRecords(sessions: readonly CardioSession[]): CardioRecords {
  const byDate = [...sessions].sort((a, b) => a.workoutDate.localeCompare(b.workoutDate));
  const records: CardioRecords = { longestTime: null, longestDistance: null };
  for (const session of byDate) {
    const at = { workoutId: session.workoutId, workoutDate: session.workoutDate };
    for (const s of session.sets) {
      const t = s.duration_seconds;
      if (t != null && t > 0 && (!records.longestTime || t > records.longestTime.value)) {
        records.longestTime = { value: t, ...at };
      }
      const d = s.distance_meters;
      if (d != null && d > 0 && (!records.longestDistance || d > records.longestDistance.value)) {
        records.longestDistance = { value: d, ...at };
      }
    }
  }
  return records;
}
