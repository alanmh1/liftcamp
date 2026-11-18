// The training schedule: the days a week someone usually trains and the
// time of day, from onboarding's "When do you usually train?" page and
// Settings › Training. Stored as `user_profiles.training_days` (ISO weekday
// numbers, 1 = Monday ... 7 = Sunday, sorted) and `training_time`. The
// spec is docs/onboarding-fork-spec.md. Pure, no Expo.

import { proseNumber } from "./copy-numbers";

/** `user_profiles.training_time`, the column's CHECK. */
export const TRAINING_TIMES = ["morning", "midday", "evening"] as const;
export type TrainingTime = (typeof TRAINING_TIMES)[number];

/** The time onboarding preselects. */
export const DEFAULT_TRAINING_TIME: TrainingTime = "evening";

export function isTrainingTime(v: string | null | undefined): v is TrainingTime {
  return (TRAINING_TIMES as readonly string[]).includes(v ?? "");
}

export const TRAINING_TIME_LABELS: Record<TrainingTime, string> = {
  morning: "Morning",
  midday: "Midday",
  evening: "Evening",
};

/** The line under each time segment in onboarding. */
export const TRAINING_TIME_HINTS: Record<TrainingTime, string> = {
  morning: "before 11",
  midday: "11 to 3",
  evening: "after 3",
};

/** When a planned-day reminder fires, local time, for each window. */
export const TRAINING_WINDOW_START: Record<TrainingTime, { hour: number; minute: number }> = {
  morning: { hour: 7, minute: 30 },
  midday: { hour: 11, minute: 30 },
  evening: { hour: 17, minute: 0 },
};

/** ISO weekdays, Monday first, the order the day toggles are drawn in. */
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** The toggles' letters, M T W T F S S. */
export const WEEKDAY_LETTERS: Record<number, string> = { 1: "M", 2: "T", 3: "W", 4: "T", 5: "F", 6: "S", 7: "S" };

export const WEEKDAY_SHORT: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

export const WEEKDAY_LONG: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

/** The weekly targets Home's week card offers (data/home WEEKLY_TARGET_OPTIONS). */
const TARGET_MIN = 2;
const TARGET_MAX = 5;

/** A date's ISO weekday, 1 = Monday ... 7 = Sunday, in local time. */
export function isoWeekday(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1;
}

/**
 * The column's value as the app uses it: whole numbers 1 to 7, no repeats,
 * sorted. Null stays null (never answered); anything else that is not a
 * list reads as null too.
 */
export function normalizeTrainingDays(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const days = new Set<number>();
  for (const v of raw) {
    const n = typeof v === "string" ? Number(v) : v;
    if (typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 7) days.add(n);
  }
  return [...days].sort((a, b) => a - b);
}

/** Adds or removes one day, keeping the list sorted. */
export function toggleTrainingDay(days: readonly number[], day: number): number[] {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b);
}

/** "Mon, Wed, Fri"; null for no days. */
export function scheduleSummary(days: readonly number[] | null | undefined): string | null {
  const list = normalizeTrainingDays(days ?? null);
  if (!list || list.length === 0) return null;
  return list.map((d) => WEEKDAY_SHORT[d]).join(", ");
}

/**
 * The weekly target a schedule saves: the number of days, inside the
 * targets the week card offers (one day saves 2, six or seven save 5).
 */
export function weeklyTargetForDays(n: number): number {
  return Math.min(TARGET_MAX, Math.max(TARGET_MIN, Math.round(n)));
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Three days a week", "One day a week"; the prompt to pick with none. */
export function daysPerWeekLine(n: number): string {
  if (n <= 0) return "Pick the days you usually train";
  return `${cap(proseNumber(n))} ${n === 1 ? "day" : "days"} a week`;
}

/**
 * The schedule page's primary button: "Remind me Mon, Wed, Fri" for up to
 * three days, "Remind me four days a week" for more, "Continue" for none.
 */
export function remindButtonLabel(days: readonly number[]): string {
  if (days.length === 0) return "Continue";
  if (days.length <= 3) return `Remind me ${scheduleSummary(days)}`;
  return `Remind me ${proseNumber(days.length)} days a week`;
}

/**
 * Plan view's check row for the first reminder: "Reminder Wednesday
 * evening", "Reminder Wednesday at midday", or "Reminder this evening" when
 * it is today.
 */
export function reminderLine(at: Date, time: TrainingTime, now: Date = new Date()): string {
  const today =
    at.getFullYear() === now.getFullYear() && at.getMonth() === now.getMonth() && at.getDate() === now.getDate();
  if (today) return time === "midday" ? "Reminder today at midday" : `Reminder this ${time}`;
  const day = WEEKDAY_LONG[isoWeekday(at)];
  return time === "midday" ? `Reminder ${day} at midday` : `Reminder ${day} ${time}`;
}
