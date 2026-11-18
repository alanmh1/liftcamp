import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  APP_STORAGE_PREFIX,
  FIRST_NUDGE_DAYS,
  firstNudgeContent,
  localDateKey,
  nudgeTime,
  planPlannedNudges,
  streakNudgeAt,
  streakNudgeContent,
  type NudgeContent,
  type TrainingTime,
  type WeekCardState,
} from '@liftcamp/shared';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Reminder notifications, built like the rest alert (lib/rest-alert.ts).
 * Two kinds, told apart by `data.kind`:
 *
 * - `first`: two nudges toward the first workout, `nudge-first-1` at 9:00
 *   two days after onboarding and `nudge-first-2` at 9:00 six days after.
 *   Cancelled by the first finish (data/workouts.ts finishWorkout).
 * - `streak`: one per week, `nudge-streak-<weekStart>`, on the morning the
 *   streak goes on the line. Home replaces it every time it works out the
 *   week card's state, and it goes once the week is hit.
 * - `planned`: for someone with a training schedule
 *   (docs/onboarding-fork-spec.md), `nudge-planned-<YYYY-MM-DD>` at the
 *   start of their window on each training day in the next seven, and
 *   `nudge-pause` on day 8. Rescheduled from every Home load that reaches
 *   the server and from Settings, so a week without opening the app ends
 *   them with the pause notice. With a schedule they replace the
 *   first-workout nudges, and a planned reminder on the streak nudge's day
 *   carries the streak copy in its place.
 *
 * Sign-out, account deletion and Start fresh cancel them all.
 *
 * Every function swallows its own errors and calls run one at a time, in
 * the order they were made, so a cancel never lands before the schedule
 * it follows. Nothing is scheduled without permission; the permission
 * itself is asked by ensureRestAlertPermission, from the end of onboarding
 * or the workout screen.
 *
 * iOS only, like the rest alert: Android has no notification channel.
 */

const PREFIX = 'nudge-';
const FIRST_PREFIX = `${PREFIX}first-`;
const STREAK_PREFIX = `${PREFIX}streak-`;
const PLANNED_PREFIX = `${PREFIX}planned-`;
const PAUSE_ID = `${PREFIX}pause`;

/** Written when someone picks Not now on onboarding's reminders sheet. */
export const NUDGES_DECLINED_KEY = `${APP_STORAGE_PREFIX}nudges:declined`;

/**
 * Set once the first-workout nudges have been scheduled for a user, so the
 * launch check does not schedule them again after they have fired. Gone
 * with a reinstall, which schedules them afresh.
 */
function firstScheduledKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}nudges:first:${userId}`;
}

let chain: Promise<void> = Promise.resolve();

function serial(fn: () => Promise<void>): Promise<void> {
  const next = chain.then(fn).catch(() => {});
  chain = next;
  return next;
}

async function cancelWhere(match: (id: string) => boolean): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => match(n.identifier))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

async function schedule(
  identifier: string,
  kind: 'first' | 'streak' | 'planned' | 'pause',
  content: NudgeContent,
  date: Date,
): Promise<void> {
  if (date.getTime() <= Date.now()) return;
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: content.title,
      body: content.body,
      sound: 'default',
      // Never time sensitive; that is the rest alert's.
      interruptionLevel: 'active',
      data: { kind },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
}

/** first-1 and first-2, counted from `from`, and the mark that they were scheduled. */
async function scheduleFirstPair(userId: string, dayName: string | null, from: Date): Promise<void> {
  await Promise.all(
    FIRST_NUDGE_DAYS.map((days, i) => {
      const which = (i + 1) as 1 | 2;
      return schedule(`${FIRST_PREFIX}${which}`, 'first', firstNudgeContent(which, dayName), nudgeTime(from, days));
    }),
  );
  await AsyncStorage.setItem(firstScheduledKey(userId), new Date().toISOString());
}

/**
 * Replaces the first-workout nudges with two counted from `from` (now by
 * default). `dayName` is the Next up routine day, or null for none.
 */
export function scheduleFirstNudges({
  userId,
  dayName,
  hasSchedule = false,
  from = new Date(),
}: {
  userId: string;
  dayName: string | null;
  /** Training days are set: the planned reminders stand in for these. */
  hasSchedule?: boolean;
  from?: Date;
}): Promise<void> {
  if (Platform.OS !== 'ios' || hasSchedule) return Promise.resolve();
  return serial(async () => {
    await cancelWhere((id) => id.startsWith(FIRST_PREFIX));
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return;
    await scheduleFirstPair(userId, dayName, from);
  });
}

/**
 * At launch, from Home's first load that reached the server: schedules the
 * first-workout nudges for someone with permission, no finished workout
 * and none pending, who has never had them scheduled on this install.
 * Covers existing users who allowed notifications for rest alerts, and a
 * reinstall.
 */
export function ensureFirstNudges({
  userId,
  finishedCount,
  dayName,
  hasSchedule = false,
}: {
  userId: string;
  finishedCount: number;
  dayName: string | null;
  /** Training days are set: the planned reminders stand in for these. */
  hasSchedule?: boolean;
}): Promise<void> {
  if (Platform.OS !== 'ios' || finishedCount !== 0 || hasSchedule) return Promise.resolve();
  return serial(async () => {
    const [{ granted }, scheduled, done] = await Promise.all([
      Notifications.getPermissionsAsync(),
      Notifications.getAllScheduledNotificationsAsync(),
      AsyncStorage.getItem(firstScheduledKey(userId)),
    ]);
    if (!granted || done != null || scheduled.some((n) => n.identifier.startsWith(FIRST_PREFIX))) return;
    await scheduleFirstPair(userId, dayName, new Date());
  });
}

/** The first finish: neither first-workout nudge is needed any more. */
export function cancelFirstNudges(): Promise<void> {
  if (Platform.OS !== 'ios') return Promise.resolve();
  return serial(() => cancelWhere((id) => id.startsWith(FIRST_PREFIX)));
}

/**
 * Replaces the pending streak nudge with this week's, or with none: no
 * streak, nothing left to do, the week hit, or its moment gone (see
 * streakNudgeAt). At most one is ever pending.
 */
export function scheduleStreakNudge(state: WeekCardState): Promise<void> {
  if (Platform.OS !== 'ios') return Promise.resolve();
  return serial(async () => {
    lastStreak = state;
    // With a schedule, the planned reminders decide whether the streak
    // nudge is needed (a planned reminder on its day takes its copy).
    if (lastPlan) {
      await replan(lastPlan);
      return;
    }
    await placeStreakNudge(state, false);
  });
}

/** The streak nudge for `state`, or none when `taken` by a planned reminder. */
async function placeStreakNudge(state: WeekCardState | null, taken: boolean): Promise<void> {
  await cancelWhere((id) => id.startsWith(STREAK_PREFIX));
  if (!state || taken) return;
  const at = streakAt(state);
  if (!at) return;
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;
  await schedule(`${STREAK_PREFIX}${state.weekStart}`, 'streak', streakNudgeContent(state), at);
}

function streakAt(state: WeekCardState): Date | null {
  const hit = state.phase === 'hit' || state.phase === 'over';
  return hit ? null : streakNudgeAt(state);
}

// ---------------------------------------------------------------------------
// Planned-day reminders
// ---------------------------------------------------------------------------

type PlanInput = {
  userId: string;
  days: number[] | null;
  time: TrainingTime | null;
  dayName: string | null;
  finishedCount: number;
  trainedToday: boolean;
};

/**
 * The last inputs, in memory: Settings reschedules with Home's day name and
 * counts, and a new streak state reschedules the planned reminders it may
 * share a day with. Null until Home has scheduled once this launch.
 */
let lastPlan: PlanInput | null = null;
let lastStreak: WeekCardState | null = null;

async function replan(input: PlanInput): Promise<void> {
  const days = input.days ?? [];
  const planned = days.length > 0 && input.time != null;
  // A schedule replaces the first-workout nudges. "Not sure yet" (no days)
  // keeps them.
  await cancelWhere(
    (id) => id.startsWith(PLANNED_PREFIX) || id === PAUSE_ID || (planned && id.startsWith(FIRST_PREFIX)),
  );
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted || !planned) {
    // No schedule: the streak nudge is its own again.
    await placeStreakNudge(lastStreak, false);
    return;
  }
  const at = lastStreak ? streakAt(lastStreak) : null;
  const { nudges, streakTaken } = planPlannedNudges({
    days,
    time: input.time!,
    now: new Date(),
    trainedToday: input.trainedToday,
    dayName: input.dayName,
    finishedCount: input.finishedCount,
    streak: at && lastStreak ? { at, content: streakNudgeContent(lastStreak) } : null,
  });
  await Promise.all(
    nudges.map((n) =>
      n.kind === 'pause'
        ? schedule(PAUSE_ID, 'pause', n.content, n.at)
        : schedule(`${PLANNED_PREFIX}${n.key}`, 'planned', n.content, n.at),
    ),
  );
  await placeStreakNudge(lastStreak, streakTaken);
}

/**
 * Replaces every pending planned reminder and the pause notice with those
 * for the next seven days from now (see planPlannedNudges in shared), and
 * cancels the first-workout nudges, which a schedule replaces. Nothing
 * without permission, and nothing for no days. From Home's first load
 * that reaches the server.
 *
 * TODO(android-notifications): schedule here too once that branch gives
 * Android a notification channel.
 */
export function schedulePlannedNudges(input: PlanInput): Promise<void> {
  if (Platform.OS !== 'ios') return Promise.resolve();
  return serial(async () => {
    const days = input.days ?? [];
    // Someone who never answered keeps the first-workout nudges; only a
    // schedule, or one cleared in Settings, is remembered here.
    lastPlan = input.days == null ? null : { ...input, days };
    if (input.days == null) {
      await cancelWhere((id) => id.startsWith(PLANNED_PREFIX) || id === PAUSE_ID);
      return;
    }
    await replan({ ...input, days });
  });
}

/**
 * Settings changed the schedule: the same as Home's call, with Home's last
 * day name and counts. Before Home has scheduled this launch, a neutral
 * day name and count stand in until its next load.
 */
export function reschedulePlannedNudges({
  userId,
  days,
  time,
}: {
  userId: string;
  days: number[];
  time: TrainingTime | null;
}): Promise<void> {
  const prev = lastPlan?.userId === userId ? lastPlan : null;
  return schedulePlannedNudges({
    userId,
    days,
    time,
    dayName: prev?.dayName ?? null,
    finishedCount: prev?.finishedCount ?? 1,
    trainedToday: prev?.trainedToday ?? false,
  });
}

/** A finished workout: today's planned reminder has done its job. */
export function cancelPlannedToday(): Promise<void> {
  if (Platform.OS !== 'ios') return Promise.resolve();
  if (lastPlan) lastPlan = { ...lastPlan, trainedToday: true };
  const id = `${PLANNED_PREFIX}${localDateKey(new Date())}`;
  return serial(() => cancelWhere((n) => n === id));
}

/** Every nudge, pending or delivered. For sign-out, account deletion and Start fresh. */
export function cancelAllNudges(): Promise<void> {
  lastPlan = null;
  lastStreak = null;
  return serial(async () => {
    const [scheduled, delivered] = await Promise.all([
      Notifications.getAllScheduledNotificationsAsync(),
      Notifications.getPresentedNotificationsAsync(),
    ]);
    await Promise.all([
      ...scheduled
        .filter((n) => n.identifier.startsWith(PREFIX))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
      ...delivered
        .filter((n) => n.request.identifier.startsWith(PREFIX))
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    ]);
  });
}
