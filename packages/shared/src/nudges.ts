// The reminder notifications (apps/mobile/src/lib/nudges.ts schedules them):
// when each fires and what it says. Pure, no Expo. The spec is
// docs/first-workout-spec.md, Nudges.

import { proseNumber } from "./copy-numbers";
import { streakRiskAsk, type WeekCardState } from "./week-card";

/** The local hour every nudge fires at. */
export const NUDGE_HOUR = 9;

/** Days after onboarding that first-1 and first-2 fire. */
export const FIRST_NUDGE_DAYS = [2, 6] as const;

export type NudgeContent = { title: string; body: string };

/** 9:00 local, `days` days after `from`'s calendar day. */
export function nudgeTime(from: Date, days: number): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + days, NUDGE_HOUR, 0, 0, 0);
}

/**
 * The two first-workout nudges' copy. With the Next up day's name it names
 * it; without one, both ask for any workout.
 */
export function firstNudgeContent(which: 1 | 2, dayName: string | null): NudgeContent {
  const name = dayName?.trim() || null;
  if (which === 1) {
    return {
      title: "Your first workout is waiting",
      body: name
        ? `${name} is ready when you are. Tick a set when you've done it.`
        : "Start a workout and tick a set when you've done it.",
    };
  }
  return {
    title: "Still here when you're ready",
    body: name
      ? `One short session is all it takes to start. ${name} is set up.`
      : "Start a workout and tick a set when you've done it.",
  };
}

type StreakInput = Pick<WeekCardState, "remaining" | "daysLeft" | "streak" | "weekStart">;

/**
 * When the streak nudge fires, or null for none. Only with a streak and
 * days still to do. It fires at 9:00 on the first day on which every
 * remaining day has to be a training day (Monday plus 7 - remaining), or
 * today when that is already past. Null when that moment has gone, or
 * when the week is already out of reach (more remaining than days left).
 */
export function streakNudgeAt(state: StreakInput, now: Date = new Date()): Date | null {
  if (state.streak.current <= 0 || state.remaining <= 0) return null;
  if (state.remaining > state.daysLeft) return null;
  const [y, m, d] = state.weekStart.split("-").map(Number);
  const fire = new Date(y, m - 1, d + 7 - state.remaining, NUDGE_HOUR, 0, 0, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), NUDGE_HOUR, 0, 0, 0);
  const at = fire.getTime() < today.getTime() ? today : fire;
  return at.getTime() > now.getTime() ? at : null;
}

/**
 * The streak nudge's copy: the card's at-risk headline and its ask, as
 * they read on the morning it fires (a nudge that fires never has today
 * trained yet; see streakNudgeAt).
 */
export function streakNudgeContent(state: Pick<WeekCardState, "remaining" | "streak">): NudgeContent {
  const n = state.streak.current;
  return {
    title: n > 1 ? `Your ${proseNumber(n)}-week streak is on the line` : "Your streak is on the line",
    body: streakRiskAsk({ remaining: state.remaining, trainedToday: false }),
  };
}
