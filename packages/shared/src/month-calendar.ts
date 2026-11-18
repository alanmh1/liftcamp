// The month calendar on Profile, with its GOAL column. Pure, no React, no
// Supabase.
//
// Weeks run Monday to Sunday, as on the week card. Dates are finished
// workout dates as YYYY-MM-DD, the list getStreakWorkoutDates reads for
// Home's week card and streak: one entry per workout, so a day with two
// workouts appears twice. A day is filled when it has at least one; the
// month's count is of workouts, not days, so it matches the rows History
// lists under that month.

import { isoFromLocalDate, localDateFromIso } from "./birthday";
import { proseCount } from "./copy-numbers";
import { mondayOf } from "./weeks";

/** "2026-09" from "2026-09-14". */
export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7);
}

/** The month `n` months after `key` (before, when negative). */
export function addMonths(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  return isoFromLocalDate(new Date(y, m - 1 + n, 1)).slice(0, 7);
}

/**
 * The month as weeks of seven, Monday first. Each cell is the day's
 * YYYY-MM-DD, or null where the week runs into the month before or after.
 * Four to six weeks, as the month needs.
 */
export function monthGrid(key: string): (string | null)[][] {
  const [y, m] = key.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  // Monday is 0 through Sunday 6.
  const lead = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(isoFromLocalDate(new Date(y, m - 1, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Workouts per day. Duplicates in `dates` are separate workouts. */
export function workoutsByDay(dates: readonly string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const d of dates) out.set(d, (out.get(d) ?? 0) + 1);
  return out;
}

/** Workouts dated in the month `key`. */
export function workoutsInMonth(byDay: ReadonlyMap<string, number>, key: string): number {
  let n = 0;
  for (const [day, count] of byDay) if (monthKeyOf(day) === key) n += count;
  return n;
}

/**
 * The months the calendar can show: from the month of the first workout
 * to this month, never a future one. With no workouts, only this month. A
 * workout dated after this month (a device clock ahead) does not extend
 * the range.
 */
export function calendarRange(dates: readonly string[], today: Date = new Date()): { first: string; last: string } {
  const last = isoFromLocalDate(today).slice(0, 7);
  let first = last;
  for (const d of dates) {
    const key = monthKeyOf(d);
    if (key < first) first = key;
  }
  return { first, last };
}

/** "September 2026", the calendar's title. */
export function calendarTitle(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * The line under the grid: "12 workouts in September", "Three workouts in
 * September", "One workout in September", "No workouts in August". The
 * title above carries the year.
 */
export function monthCountLine(count: number, key: string): string {
  const [y, m] = key.split("-").map(Number);
  const month = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long" });
  const lead = count === 0 ? "No workouts" : proseCount(count, "workout");
  return `${lead.charAt(0).toUpperCase()}${lead.slice(1)} in ${month}`;
}

/**
 * One row's GOAL cell: a check when the week reached the target, the
 * days so far against it otherwise, nothing for a week wholly ahead.
 */
export type GoalCell = { kind: "hit" } | { kind: "short"; days: number; target: number } | { kind: "future" };

/**
 * The GOAL column beside each week of `grid` (monthGrid). Counted as the
 * week card counts: the row's whole Monday to Sunday week, distinct
 * training days, hit at the target. So a week that runs into the next
 * month counts its days there too, and shows the same in both months.
 */
export function goalColumn(
  grid: readonly (readonly (string | null)[])[],
  dates: readonly string[],
  target: number,
  today: Date = new Date(),
): GoalCell[] {
  const thisMonday = isoFromLocalDate(mondayOf(today));
  const days = new Set(dates);
  return grid.map((row) => {
    const any = row.find((d): d is string => d != null);
    const local = any ? localDateFromIso(any) : null;
    if (!local) return { kind: "future" };
    const monday = mondayOf(local);
    if (isoFromLocalDate(monday) > thisMonday) return { kind: "future" };
    let n = 0;
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      if (days.has(isoFromLocalDate(d))) n += 1;
    }
    return target > 0 && n >= target ? { kind: "hit" } : { kind: "short", days: n, target };
  });
}

/**
 * The line under the calendar with the GOAL column: "Three workouts in
 * November · 2 weeks at your goal", "1 week".
 */
export function monthGoalLine(count: number, key: string, cells: readonly GoalCell[]): string {
  const k = cells.filter((c) => c.kind === "hit").length;
  return `${monthCountLine(count, key)} · ${k} ${k === 1 ? "week" : "weeks"} at your goal`;
}
