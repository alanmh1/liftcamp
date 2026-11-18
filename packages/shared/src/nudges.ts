// The reminder notifications (apps/mobile/src/lib/nudges.ts schedules them):
// when each fires and what it says. Pure, no Expo. The spec is
// docs/first-workout-spec.md, Nudges.

import { proseNumber } from "./copy-numbers";
import { isoWeekday, TRAINING_WINDOW_START, type TrainingTime } from "./training-schedule";
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

// ---------------------------------------------------------------------------
// Planned-day reminders (docs/onboarding-fork-spec.md, Reminders on planned
// days). One on each training day in the next seven calendar days, at the
// start of the user's window, and one pause notice on day 8. Rescheduled
// from every app open, so they stop about a week after the last one.
// ---------------------------------------------------------------------------

/** "YYYY-MM-DD" in local time: the date part of `nudge-planned-<date>`. */
export function localDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** `offset` calendar days after `from`'s day, at the window's start. */
function windowOn(from: Date, offset: number, time: TrainingTime): Date {
  const { hour, minute } = TRAINING_WINDOW_START[time];
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset, hour, minute, 0, 0);
}

export type PlannedNudge = {
  /** The date part of the identifier. */
  key: string;
  at: Date;
  kind: "planned" | "pause";
  content: NudgeContent;
};

/** A planned reminder's copy. Before the first finish it asks for the first workout. */
export function plannedNudgeContent(dayName: string | null, finishedCount: number): NudgeContent {
  const name = dayName?.trim() || null;
  if (finishedCount <= 0) {
    return {
      title: "Your first workout is today",
      body: name ? `${name} is ready. Tap to open it.` : "Start a workout and tick a set when you've done it.",
    };
  }
  return name
    ? { title: `${name} is up next`, body: "It's one of your training days. Tap to start." }
    : { title: "It's a training day", body: "Tap to start a workout." };
}

export const PAUSE_NUDGE_CONTENT: NudgeContent = {
  title: "We'll pause your reminders",
  body: "Your plan is saved. Open LiftCamp whenever you're ready to pick it back up.",
};

/**
 * Every planned reminder and the pause notice to schedule from `now`.
 *
 * One on each of `days` (ISO weekdays) in the seven calendar days from
 * today, at the window's start. Today only while that start is still ahead
 * and nothing was trained today. Then one pause notice on day 8 at the same
 * time. Nothing at all for no days.
 *
 * `streak` is the streak nudge this week would send (streakNudgeAt and its
 * copy). When a planned reminder falls on its day, that reminder carries
 * the streak copy and `streakTaken` says the streak nudge is not needed.
 */
export function planPlannedNudges({
  days,
  time,
  now,
  trainedToday,
  dayName,
  finishedCount,
  streak = null,
}: {
  days: readonly number[] | null;
  time: TrainingTime;
  now: Date;
  trainedToday: boolean;
  dayName: string | null;
  finishedCount: number;
  streak?: { at: Date; content: NudgeContent } | null;
}): { nudges: PlannedNudge[]; streakTaken: boolean } {
  if (!days || days.length === 0) return { nudges: [], streakTaken: false };
  const streakKey = streak ? localDateKey(streak.at) : null;
  const plain = plannedNudgeContent(dayName, finishedCount);
  const nudges: PlannedNudge[] = [];
  let streakTaken = false;
  for (let offset = 0; offset < 7; offset++) {
    const at = windowOn(now, offset, time);
    if (!days.includes(isoWeekday(at))) continue;
    if (offset === 0 && (trainedToday || at.getTime() <= now.getTime())) continue;
    const key = localDateKey(at);
    const takesStreak = key === streakKey;
    if (takesStreak) streakTaken = true;
    nudges.push({ key, at, kind: "planned", content: takesStreak ? streak!.content : plain });
  }
  const pause = windowOn(now, 7, time);
  nudges.push({ key: localDateKey(pause), at: pause, kind: "pause", content: PAUSE_NUDGE_CONTENT });
  return { nudges, streakTaken };
}

/** The first planned reminder from `now`, for plan view's check row. Null with no days. */
export function firstPlannedReminder(
  days: readonly number[] | null,
  time: TrainingTime,
  now: Date = new Date(),
): Date | null {
  const { nudges } = planPlannedNudges({ days, time, now, trainedToday: false, dayName: null, finishedCount: 0 });
  return nudges.find((n) => n.kind === "planned")?.at ?? null;
}
