// The week streak's walk, shared by the week card (weekStreak, streakShare)
// and the medals (medalEarnEvents), so all three count a streak the same
// way. Pure, no React, no Supabase. The rules are in docs/week-card-spec.md.
//
// A week runs Monday to Sunday, local time, and is hit when its distinct
// training days reach the weekly target. Walking oldest first: a hit adds
// one, and every fourth hit in a row since the last bank banks a rest week,
// at most one at a time. A miss with a rest week banked spends it and the
// streak survives; a miss without one resets it. The current week joins
// once it is hit, never breaks the streak while in progress, and never
// spends a rest week.

import { isoFromLocalDate, localDateFromIso } from "./birthday";
import { mondayOf } from "./weeks";

/**
 * The most weeks of history a walk reads, ten years back from this week.
 * Only a guard against a date typo decades back; no real history is that
 * long.
 */
export const MAX_HISTORY_WEEKS = 520;

/** Hit weeks in a row that bank a rest week. */
export const WEEKS_TO_BANK_REST = 4;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** One calendar week of training, as the streak sees it. */
export type WeekResult = {
  /** Monday, YYYY-MM-DD. */
  weekStart: string;
  /** Distinct training days. */
  days: number;
  /** Days reached the target. Never with a target of 0 or less. */
  hit: boolean;
  /** The day the week was hit: its target-th distinct training day. Null when not hit. */
  hitOn: string | null;
};

/**
 * Every week from the one holding the earliest date through the one
 * holding `today`, oldest first, the current week last. With no dates it is
 * the current week alone. Dates after this Sunday, and weeks more than
 * MAX_HISTORY_WEEKS back, are ignored. `dates` are finished workout dates,
 * YYYY-MM-DD, any order, duplicates fine.
 */
export function weekResults(dates: readonly string[], target: number, today: Date = new Date()): WeekResult[] {
  const current = mondayOf(today);
  const currentIso = isoFromLocalDate(current);

  // Distinct days per week, keyed by Monday.
  const byWeek = new Map<string, Set<string>>();
  let earliest = current;
  for (const date of dates) {
    const local = localDateFromIso(date);
    if (!local) continue;
    const monday = mondayOf(local);
    const key = isoFromLocalDate(monday);
    if (key > currentIso) continue;
    if (monday < earliest) earliest = monday;
    let days = byWeek.get(key);
    if (!days) byWeek.set(key, (days = new Set()));
    days.add(date);
  }

  // Rounded, so a daylight saving hour in between does not lose a week.
  const span = Math.min(Math.round((current.getTime() - earliest.getTime()) / WEEK_MS) + 1, MAX_HISTORY_WEEKS);
  const out: WeekResult[] = [];
  for (let i = span - 1; i >= 0; i -= 1) {
    const monday = new Date(current);
    monday.setDate(current.getDate() - 7 * i);
    const weekStart = isoFromLocalDate(monday);
    const days = [...(byWeek.get(weekStart) ?? [])].sort();
    const hit = target > 0 && days.length >= target;
    out.push({ weekStart, days: days.length, hit, hitOn: hit ? days[target - 1] : null });
  }
  return out;
}

/** The streak after one week of the walk. */
export type WalkWeek = {
  /** Consecutive hit weeks after this week. */
  streak: number;
  /** A miss the banked rest week covered. */
  rest: boolean;
  /** A miss with no rest week banked: the streak was reset, from `lost`. */
  reset: boolean;
  /** The streak a reset lost. 0 when this week reset nothing. */
  lost: number;
  /** A rest week is banked after this week. */
  banked: boolean;
};

/**
 * Walks `results` oldest first and gives the streak after each week, one
 * entry per week. The last entry is the current week: it adds one once
 * hit, and otherwise changes nothing.
 */
export function walkStreak(results: readonly WeekResult[]): WalkWeek[] {
  let streak = 0;
  let banked = false;
  let sinceBank = 0;
  const last = results.length - 1;
  return results.map((week, i) => {
    let rest = false;
    let reset = false;
    let lost = 0;
    if (week.hit) {
      streak += 1;
      sinceBank += 1;
      if (!banked && sinceBank === WEEKS_TO_BANK_REST) {
        banked = true;
        sinceBank = 0;
      }
    } else if (i === last) {
      // The current week, still open.
    } else if (banked) {
      banked = false;
      sinceBank = 0;
      rest = true;
    } else {
      reset = true;
      lost = streak;
      streak = 0;
      sinceBank = 0;
    }
    return { streak, rest, reset, lost, banked };
  });
}
