// The Workouts this week card: which phase the week is in, the week streak,
// and the line of encouragement under the count. Pure, no React, no
// Supabase. The spec is docs/week-card-spec.md.
//
// A week runs Monday to Sunday, local time. A week is hit when its distinct
// training days reach the weekly target: days, not workout rows, the same
// as the day dots and the Profile chart. Everything is computed on read
// from finished workout dates and today's target, so changing the target
// rewrites history (a known limit, fixed later by snapshotting weeks).
//
// The streak reads the whole history it is given (streak-walk.ts), so a
// run past a year keeps counting, as the medal ladder needs (medals.ts).

import { isoFromLocalDate } from "./birthday";
import { proseNumber } from "./copy-numbers";
import { isMedalRung, medalLine, withEmoji } from "./medals";
import { walkStreak, weekResults } from "./streak-walk";
import { mondayOf } from "./weeks";

/** A year of weeks: past it, the share card keeps going with a crown. */
const YEAR_WEEKS = 52;

export type WeekPhase =
  | "first" // never finished a workout
  | "zero-early" // 0 done, Monday to Wednesday
  | "zero-late" // 0 done, Thursday to Sunday
  | "going" // 1+ done, 2+ remaining
  | "one-left" // 1+ done, exactly 1 remaining
  | "hit" // done === target
  | "over"; // done > target

export type StreakResult = {
  /** Consecutive hit weeks ending now, the current week included once hit. */
  current: number;
  /** Longest run in the history, for Profile. */
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
 * The week streak over the whole history in `dates`.
 *
 * Walking completed weeks oldest first: a hit adds one, and every fourth
 * hit in a row since the last bank banks a rest week, at most one at a
 * time. A miss with a rest week banked spends it and the streak survives;
 * a miss without one resets it. The current week joins the streak once it
 * is hit and never breaks it while in progress, and never spends a rest
 * week. The walk itself is walkStreak in streak-walk.ts.
 */
export function weekStreak(dates: readonly string[], target: number, today: Date = new Date()): StreakResult {
  if (!(target > 0)) return { ...NO_STREAK };
  const walk = walkStreak(weekResults(dates, target, today));
  const now = walk[walk.length - 1];
  const lastWeek = walk.length > 1 ? walk[walk.length - 2] : null;
  return {
    current: now.streak,
    longest: Math.max(0, ...walk.map((w) => w.streak)),
    restBanked: now.banked,
    restUsedLastWeek: lastWeek?.rest ?? false,
    resetLastWeekFrom: lastWeek?.lost ?? 0,
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
 * The medal this week earned: the streak, once the week is hit and the
 * streak sits on a rung of the medal ladder. Null otherwise. Since a hit
 * week adds one to the streak, a rung reached in a hit week is the week
 * that earned it.
 */
export function weekMedal(state: WeekCardState): number | null {
  const hit = state.phase === "hit" || state.phase === "over";
  return hit && isMedalRung(state.streak.current) ? state.streak.current : null;
}

/**
 * The streak share card's line: the medal line on a rung, and otherwise
 * "Keep it going", with 💪 up to a year (a one-week streak included) and
 * 🦾 past it.
 */
export function streakShareLine(weeks: number): string {
  return medalLine(weeks) ?? withEmoji("Keep it going", weeks > YEAR_WEEKS ? "🦾" : "💪");
}

/** Weeks the share card's strip shows at most. */
export const STRIP_WEEKS = 12;

/** One week of the share card's strip: distinct training days (1 to 7), or a rest week that kept the streak. */
export type StripWeek = { rest: false; days: number } | { rest: true };

export type StreakShare = {
  /** The streak, as the week card counts it. */
  weeks: number;
  /**
   * The streak's most recent weeks, up to STRIP_WEEKS, oldest first: the
   * calendar weeks from its start to now, rest weeks included. The current
   * week is in it once hit, as it is in the streak.
   */
  strip: StripWeek[];
  /** Distinct training days across the whole streak, rest weeks included. */
  workouts: number;
};

/**
 * What the streak share card draws, from the same dates, target and walk
 * as weekStreak. Null with no streak.
 */
export function streakShare(dates: readonly string[], target: number, today: Date = new Date()): StreakShare | null {
  if (!(target > 0)) return null;
  const results = weekResults(dates, target, today);
  const walk = walkStreak(results);
  const last = results.length - 1;
  const weeks = walk[last].streak;
  if (weeks < 1) return null;

  // The run starts after the last reset, and ends with this week once hit.
  let start = 0;
  for (let i = 0; i < last; i += 1) if (walk[i].reset) start = i + 1;
  const end = results[last].hit ? last : last - 1;

  const span: StripWeek[] = [];
  let workouts = 0;
  for (let i = start; i <= end; i += 1) {
    workouts += results[i].days;
    span.push(walk[i].rest ? { rest: true } : { rest: false, days: Math.min(results[i].days, 7) });
  }
  return { weeks, strip: span.slice(-STRIP_WEEKS), workouts };
}

/** The week's index since the epoch, stable Monday to Sunday and one more each week. */
export function weekIndex(weekStart: string): number {
  return Math.floor(Date.parse(`${weekStart}T00:00:00`) / 604800000);
}

/**
 * What an at-risk week asks for: "One more today.", "One more tomorrow."
 * once today is trained, or "Two more by Sunday.". The card's at-risk line
 * and the streak nudge both end with it.
 */
export function streakRiskAsk(state: Pick<WeekCardState, "remaining" | "trainedToday">): string {
  if (state.remaining === 1) return state.trainedToday ? "One more tomorrow." : "One more today.";
  return `${cap(proseNumber(state.remaining))} more by Sunday.`;
}

/**
 * The line under the count. First match wins:
 *   1. the reset line, once per week, when last week broke the streak and
 *      nothing is done yet (the caller stores `weekStart` after showing it);
 *   2. the rest-week line, when last week spent the rest week and nothing
 *      is done yet;
 *   3. the at-risk line;
 *   4. the medal line, when the week is hit and earned a medal (weekMedal);
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
    return `${whose} is on the line. ${streakRiskAsk(state)}`;
  }
  const medal = weekMedal(state);
  if (medal != null) return medalLine(medal)!;
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
