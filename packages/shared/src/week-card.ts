// The Workouts this week card: which phase the week is in, the week streak,
// and the line of encouragement under the count. Pure, no React, no
// Supabase. The spec is docs/week-card-spec.md.
//
// A week runs Monday to Sunday, local time. A week is hit when its distinct
// training days reach the weekly target: days, not workout rows, the same
// as the day dots and the Profile chart. Everything is computed on read
// from finished workout dates and today's target, so changing the target
// rewrites history (a known limit, fixed later by snapshotting weeks).

import { isoFromLocalDate, localDateFromIso } from "./birthday";
import { proseNumber } from "./copy-numbers";
import { mondayOf } from "./weeks";

/** How far back the streak looks. A longer run shows as 52. */
export const STREAK_WINDOW_WEEKS = 52;

/** Hit weeks in a row that swap the week's hit line for a milestone line. */
export const STREAK_MILESTONES = [2, 4, 8, 12, 26, 52] as const;

/** Hit weeks in a row that bank a rest week. */
const WEEKS_TO_BANK_REST = 4;

export type WeekPhase =
  | "first" // never finished a workout
  | "zero-early" // 0 done, Monday to Wednesday
  | "zero-late" // 0 done, Thursday to Sunday
  | "going" // 1+ done, 2+ remaining
  | "one-left" // 1+ done, exactly 1 remaining
  | "hit" // done === target
  | "over"; // done > target

export type StreakResult = {
  /** Consecutive hit weeks ending now, the current week included once hit. 0 to 52. */
  current: number;
  /** Longest run in the window, for Profile. */
  longest: number;
  /** A rest week is banked and unspent. */
  restBanked: boolean;
  /** Last week was a miss covered by a rest week. */
  restUsedLastWeek: boolean;
  /** The streak lost when last week was missed with no rest week. 0 when nothing was lost. */
  resetLastWeekFrom: number;
};

export type WeekCardState = {
  done: number;
  target: number;
  /** max(0, target - done). */
  remaining: number;
  /**
   * Days still open for training this week: today through Sunday, less
   * today when it already has a workout (distinct days, so a second one
   * today cannot count). 0 to 7.
   */
  daysLeft: number;
  /** Today already has a finished workout. */
  trainedToday: boolean;
  phase: WeekPhase;
  /** Every day left must be a training day to hit the target, and a streak is on the line. */
  atRisk: boolean;
  streak: StreakResult;
  /** This week's Monday, YYYY-MM-DD. */
  weekStart: string;
};

const NO_STREAK: StreakResult = {
  current: 0,
  longest: 0,
  restBanked: false,
  restUsedLastWeek: false,
  resetLastWeekFrom: 0,
};

/** Monday to Sunday of the week holding `today`, as YYYY-MM-DD. */
function weekDays(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return isoFromLocalDate(d);
  });
}

/**
 * Distinct training days per week for the `weeks` weeks ending with the
 * one holding `today`, oldest first. Dates outside the window, including
 * any after this Sunday, are ignored.
 */
function daysPerWeek(dates: readonly string[], weeks: number, today: Date): number[] {
  const current = mondayOf(today);
  const index = new Map<string, number>();
  for (let i = 0; i < weeks; i += 1) {
    const d = new Date(current);
    d.setDate(current.getDate() - 7 * (weeks - 1 - i));
    index.set(isoFromLocalDate(d), i);
  }
  const days = Array.from({ length: weeks }, () => new Set<string>());
  for (const date of dates) {
    const local = localDateFromIso(date);
    if (!local) continue;
    const i = index.get(isoFromLocalDate(mondayOf(local)));
    if (i != null) days[i].add(date);
  }
  return days.map((d) => d.size);
}

/**
 * The week streak over the last 52 weeks.
 *
 * Walking completed weeks oldest first: a hit adds one, and every fourth
 * hit in a row since the last bank banks a rest week, at most one at a
 * time. A miss with a rest week banked spends it and the streak survives;
 * a miss without one resets it. The current week joins the streak once it
 * is hit and never breaks it while in progress, and never spends a rest
 * week.
 */
export function weekStreak(dates: readonly string[], target: number, today: Date = new Date()): StreakResult {
  if (!(target > 0)) return { ...NO_STREAK };
  const perWeek = daysPerWeek(dates, STREAK_WINDOW_WEEKS, today);
  const last = perWeek.length - 1;

  let streak = 0;
  let banked = false;
  let sinceBank = 0;
  let longest = 0;
  let restUsedLastWeek = false;
  let resetLastWeekFrom = 0;

  const hit = () => {
    streak += 1;
    sinceBank += 1;
    if (!banked && sinceBank === WEEKS_TO_BANK_REST) {
      banked = true;
      sinceBank = 0;
    }
    longest = Math.max(longest, streak);
  };

  for (let i = 0; i < last; i += 1) {
    const lastWeek = i === last - 1;
    if (perWeek[i] >= target) {
      hit();
    } else if (banked) {
      banked = false;
      sinceBank = 0;
      if (lastWeek) restUsedLastWeek = true;
    } else {
      if (lastWeek) resetLastWeekFrom = streak;
      streak = 0;
      sinceBank = 0;
    }
  }
  if (perWeek[last] >= target) hit();

  return {
    current: Math.min(streak, STREAK_WINDOW_WEEKS),
    longest: Math.min(longest, STREAK_WINDOW_WEEKS),
    restBanked: banked,
    restUsedLastWeek,
    resetLastWeekFrom,
  };
}

/** The card's numbers and phase for today. `dates` are finished workout dates, any order, duplicates fine. */
export function weekCardState(input: {
  dates: readonly string[];
  target: number;
  /** Lifetime finished workouts, for the first-workout phase. */
  finishedCount: number;
  today?: Date;
}): WeekCardState {
  const today = input.today ?? new Date();
  const { target } = input;
  const monday = mondayOf(today);
  const week = new Set(weekDays(monday));
  const thisWeek = new Set(input.dates.filter((d) => week.has(d)));
  const done = thisWeek.size;
  const remaining = Math.max(0, target - done);
  // Monday is 0 through Sunday 6.
  const weekday = (today.getDay() + 6) % 7;
  const trainedToday = thisWeek.has(isoFromLocalDate(today));
  const daysLeft = 7 - weekday - (trainedToday ? 1 : 0);

  let phase: WeekPhase;
  if (input.finishedCount === 0) phase = "first";
  else if (done > target) phase = "over";
  else if (done === target) phase = "hit";
  else if (done === 0) phase = weekday <= 2 ? "zero-early" : "zero-late";
  else if (remaining === 1) phase = "one-left";
  else phase = "going";

  const streak = weekStreak(input.dates, target, today);
  return {
    done,
    target,
    remaining,
    daysLeft,
    trainedToday,
    phase,
    atRisk: streak.current > 0 && remaining > 0 && remaining === daysLeft,
    streak,
    weekStart: isoFromLocalDate(monday),
  };
}

/** "Three", for a number that starts a sentence. */
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type Line = {
  text: (s: WeekCardState) => string;
  /** Only on these weekdays, Monday 0 to Sunday 6. */
  when?: readonly number[];
};

const FRIDAY_TO_SUNDAY = [4, 5, 6] as const;

/** The phase pools. Numbers in prose go through proseNumber; no colons, no em dashes. */
export const WEEK_CARD_POOLS: Record<WeekPhase, readonly Line[]> = {
  first: [
    { text: () => "Start with one. The rest gets easier." },
    { text: () => "Your first workout is waiting." },
    { text: () => "One session and you're on the board." },
  ],
  "zero-early": [
    { text: () => "Fresh week. Get the first one in." },
    { text: () => "One workout today gets the week moving." },
    { text: () => "The first one is the hardest to start." },
  ],
  "zero-late": [
    { text: () => "Still time this week. One session counts." },
    { text: () => "A short workout beats a skipped one." },
    { text: () => "Get one in before Sunday." },
  ],
  going: [
    { text: (s) => `Nice start. ${cap(proseNumber(s.remaining))} to go.` },
    { text: (s) => `${cap(proseNumber(s.done))} down. Keep it rolling.` },
    { text: (s) => `Good. ${cap(proseNumber(s.remaining))} more and it's yours.` },
  ],
  "one-left": [
    { text: () => "One more and the week is yours." },
    { text: () => "So close. One to go." },
    { text: () => "Finish it off. One more." },
  ],
  hit: [
    { text: () => "Week complete. Nice one." },
    { text: () => "Boo-yah. Target hit." },
    { text: (s) => `${cap(proseNumber(s.target))} for ${proseNumber(s.target)}. Beautiful.` },
    { text: () => "Target hit. In the books." },
    { text: () => "That's a full week. Take a bow." },
    { text: () => "Nailed it. Week done." },
    { text: () => "Every workout, done. Enjoy the weekend.", when: FRIDAY_TO_SUNDAY },
  ],
  over: [
    { text: (s) => `${cap(proseNumber(s.done))} this week. Extra credit.` },
    { text: () => "Past the target. Nobody's stopping you." },
    { text: (s) => `Another one! That's ${proseNumber(s.done)}.` },
    { text: (s) => `Target was ${proseNumber(s.target)}. You did ${proseNumber(s.done)}.` },
    { text: () => "Bonus session. Showing off a little." },
    { text: (s) => `${cap(proseNumber(s.done))} and counting. Keep it coming.` },
    { text: () => "Above and beyond this week." },
  ],
};

/**
 * The week's line once the streak reaches a milestone, in place of the hit
 * or over line. Worded so no line starts with a number written in digits.
 */
export const MILESTONE_LINES: Record<(typeof STREAK_MILESTONES)[number], string> = {
  2: "Two weeks in a row. That's a streak.",
  4: "Four weeks straight. You've earned a rest week.",
  8: "Eight weeks running. This is a habit now.",
  12: "That's 12 weeks straight. Three months of showing up.",
  26: "That's 26 weeks in a row. Half a year strong.",
  52: "That's 52 weeks. A full year of showing up.",
};

/** The week's index since the epoch, stable Monday to Sunday and one more each week. */
export function weekIndex(weekStart: string): number {
  return Math.floor(Date.parse(`${weekStart}T00:00:00`) / 604800000);
}

/**
 * The line under the count. First match wins:
 *   1. the reset line, once per week, when last week broke the streak and
 *      nothing is done yet (the caller stores `weekStart` after showing it);
 *   2. the rest-week line, when last week spent the rest week and nothing
 *      is done yet;
 *   3. the at-risk line;
 *   4. the milestone line, when the week is hit and the streak is on a milestone;
 *   5. the phase pool, picked by week so it holds all week and moves on
 *      the next. A line allowed only on some days gives way, on the
 *      others, to the line half the pool away, never a neighbor week's.
 */
export function weekCardLine(
  state: WeekCardState,
  seen: { resetShownFor: string | null },
  today: Date = new Date(),
): string {
  const { streak } = state;
  if (streak.resetLastWeekFrom > 0 && state.done === 0 && seen.resetShownFor !== state.weekStart) {
    return "Streak reset. New one starts now.";
  }
  if (streak.restUsedLastWeek && state.done === 0) return "Rest week used. Streak safe.";
  if (state.atRisk) {
    const whose =
      streak.current === 1 ? "Your streak" : `Your ${proseNumber(streak.current)}-week streak`;
    const ask =
      state.remaining === 1
        ? state.trainedToday
          ? "One more tomorrow."
          : "One more today."
        : `${cap(proseNumber(state.remaining))} more by Sunday.`;
    return `${whose} is on the line. ${ask}`;
  }
  if (
    (state.phase === "hit" || state.phase === "over") &&
    (STREAK_MILESTONES as readonly number[]).includes(streak.current)
  ) {
    return MILESTONE_LINES[streak.current as (typeof STREAK_MILESTONES)[number]];
  }
  const pool = WEEK_CARD_POOLS[state.phase];
  const weekday = (today.getDay() + 6) % 7;
  const start = ((weekIndex(state.weekStart) % pool.length) + pool.length) % pool.length;
  for (const off of fallbackOffsets(pool.length)) {
    const line = pool[(start + off) % pool.length];
    if (!line.when || line.when.includes(weekday)) return line.text(state);
  }
  return pool[start].text(state);
}

/**
 * Where to look when the week's own line is not allowed today: half the
 * pool away first, then outward. One step would land on the next week's
 * own line, and the week after would repeat it.
 */
function fallbackOffsets(n: number): number[] {
  const half = Math.floor(n / 2);
  const out = [0];
  for (let d = 0; out.length < n; d += 1) {
    for (const off of [half + d, half - d]) {
      const o = ((off % n) + n) % n;
      if (!out.includes(o)) out.push(o);
    }
  }
  return out;
}
