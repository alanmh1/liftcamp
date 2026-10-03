// Streak medals: the ladder of week-streak lengths that earn a medal, the
// line each one swaps in for the week's hit line, the earn events a
// history of weeks produces, and the cabinet Profile draws. Pure, no
// React, no Supabase.
//
// A medal is earned in the week a streak reaches a rung, the current week
// included once it is hit. Medals are re-earnable: a streak that breaks at
// 6 and rebuilds earns the 2 and 4 again, each in its own week. The app
// stores every earn event in user_medals (insert only), so a later change
// of target, which rewrites the computed history, never takes one away.

import { proseNumber } from "./copy-numbers";
import { walkStreak, weekResults, type WeekResult } from "./streak-walk";
import { WORKOUT_EMOJI } from "./workout-subtitle";

/** The fixed rungs. After the last, a rung every 52 weeks: 156, 208 and on. */
export const MEDAL_LADDER = [2, 4, 8, 12, 26, 52, 78, 104] as const;

const YEAR_WEEKS = 52;
const LAST_FIXED = MEDAL_LADDER[MEDAL_LADDER.length - 1];

/** A streak of `weeks` earns a medal. */
export function isMedalRung(weeks: number): boolean {
  if (!Number.isInteger(weeks)) return false;
  if ((MEDAL_LADDER as readonly number[]).includes(weeks)) return true;
  return weeks > LAST_FIXED && weeks % YEAR_WEEKS === 0;
}

/** The first rung above a streak of `weeks`. */
export function nextMedalRung(weeks: number): number {
  const fixed = MEDAL_LADDER.find((r) => r > weeks);
  if (fixed != null) return fixed;
  return (Math.floor(weeks / YEAR_WEEKS) + 1) * YEAR_WEEKS;
}

/** Every rung up to and including `max`, in order. */
export function medalRungsThrough(max: number): number[] {
  const out: number[] = [];
  for (let r = nextMedalRung(0); r <= max; r = nextMedalRung(r)) out.push(r);
  return out;
}

/** One of the app's workout emoji (WORKOUT_EMOJI); streak copy uses no others. */
export type WorkoutEmoji = (typeof WORKOUT_EMOJI)[number];

/**
 * `text` with its emoji behind a no-break space, so a wrap never leaves
 * the emoji alone on a line. The emoji's type keeps it to WORKOUT_EMOJI.
 */
export function withEmoji(text: string, emoji: WorkoutEmoji): string {
  return `${text}\u00A0${emoji}`;
}

/**
 * The fixed rungs' lines, in place of the week's hit or over line on the
 * week card and the streak share card. Worded so no line starts with a
 * number written in digits.
 */
const LINES: Record<(typeof MEDAL_LADDER)[number], string> = {
  2: withEmoji("Two weeks in a row. You've started a streak.", "🔥"),
  4: withEmoji("Four weeks straight. You've earned a rest week.", "⚡️"),
  8: withEmoji("Eight weeks running. You've made this a habit.", "🚀"),
  12: withEmoji("That's 12 weeks straight. Three months of you showing up.", "👏"),
  26: withEmoji("That's 26 weeks in a row. Half a year of you putting in the work.", "🦾"),
  52: withEmoji("That's 52 weeks. You showed up for a full year.", "🎯"),
  78: withEmoji("That's 78 weeks in a row. You've kept it going for a year and a half.", "😤"),
  104: withEmoji("That's 104 weeks. You've shown up for two full years.", "🙌"),
};

/** The medal line for a streak of `weeks`, or null when it is not a rung. */
export function medalLine(weeks: number): string | null {
  if (!isMedalRung(weeks)) return null;
  if (weeks <= LAST_FIXED) return LINES[weeks as (typeof MEDAL_LADDER)[number]];
  const years = proseNumber(weeks / YEAR_WEEKS);
  return withEmoji(`That's ${weeks} weeks. You've shown up for ${years} full years.`, "🙌");
}

/** One medal earned: the rung, the week it was earned in, and the day that week was hit. */
export type MedalEarn = {
  weeks: number;
  /** Monday of the week the streak reached the rung, YYYY-MM-DD. */
  weekStart: string;
  /** The day that week reached the target, YYYY-MM-DD. */
  earnedOn: string;
};

/**
 * Every medal earned across `results` (oldest first, the current week
 * last, as weekResults gives them), oldest first. The same walk as the
 * week streak, so rest weeks carry a streak toward its next rung and a
 * reset starts the ladder over.
 */
export function medalEarnEvents(results: readonly WeekResult[]): MedalEarn[] {
  const walk = walkStreak(results);
  const out: MedalEarn[] = [];
  results.forEach((week, i) => {
    if (week.hit && week.hitOn && isMedalRung(walk[i].streak)) {
      out.push({ weeks: walk[i].streak, weekStart: week.weekStart, earnedOn: week.hitOn });
    }
  });
  return out;
}

/** medalEarnEvents straight from finished workout dates and today's target. */
export function medalEarnsFromDates(dates: readonly string[], target: number, today: Date = new Date()): MedalEarn[] {
  if (!(target > 0)) return [];
  return medalEarnEvents(weekResults(dates, target, today));
}

/** One medal's identity, the table's unique key less the user. */
export function medalKey(m: { weeks: number; weekStart: string }): string {
  return `${m.weeks}|${m.weekStart}`;
}

/** One rung in the cabinet. */
export type CabinetRung = {
  weeks: number;
  /** Times earned. 0 is locked. */
  count: number;
  /** The first time, YYYY-MM-DD. Null when locked. */
  firstEarnedOn: string | null;
};

export type MedalCabinet = {
  /** Every rung from 2 up to past the next one, earned or not, in order. At least through 104. */
  rungs: CabinetRung[];
  /** The earned rungs, in order. */
  earned: CabinetRung[];
  /** The lowest rung never earned above the current streak, and the weeks it still needs. */
  next: { weeks: number; toGo: number };
};

/**
 * The cabinet from every earn on record (the stored rows and the computed
 * events together; the same medal twice counts once, at its earlier day)
 * and the current streak.
 */
export function medalCabinet(records: readonly MedalEarn[], currentStreak: number): MedalCabinet {
  const first = new Map<string, MedalEarn>();
  for (const r of records) {
    if (!isMedalRung(r.weeks)) continue;
    const key = medalKey(r);
    const seen = first.get(key);
    if (!seen || r.earnedOn < seen.earnedOn) first.set(key, r);
  }

  const byRung = new Map<number, { count: number; firstEarnedOn: string }>();
  for (const r of first.values()) {
    const at = byRung.get(r.weeks);
    if (!at) byRung.set(r.weeks, { count: 1, firstEarnedOn: r.earnedOn });
    else {
      at.count += 1;
      if (r.earnedOn < at.firstEarnedOn) at.firstEarnedOn = r.earnedOn;
    }
  }

  const streak = Math.max(0, Math.floor(currentStreak));
  let next = nextMedalRung(streak);
  while (byRung.has(next)) next = nextMedalRung(next);

  const top = Math.max(LAST_FIXED, next, ...byRung.keys());
  const rungs = medalRungsThrough(top).map((weeks) => {
    const at = byRung.get(weeks);
    return { weeks, count: at?.count ?? 0, firstEarnedOn: at?.firstEarnedOn ?? null };
  });
  return { rungs, earned: rungs.filter((r) => r.count > 0), next: { weeks: next, toGo: next - streak } };
}
