import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  APP_STORAGE_PREFIX,
  FIRST_NUDGE_DAYS,
  firstNudgeContent,
  nudgeTime,
  streakNudgeAt,
  streakNudgeContent,
  type NudgeContent,
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
  kind: 'first' | 'streak',
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
  from = new Date(),
}: {
  userId: string;
  dayName: string | null;
  from?: Date;
}): Promise<void> {
  if (Platform.OS !== 'ios') return Promise.resolve();
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
}: {
  userId: string;
  finishedCount: number;
  dayName: string | null;
}): Promise<void> {
  if (Platform.OS !== 'ios' || finishedCount !== 0) return Promise.resolve();
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
    await cancelWhere((id) => id.startsWith(STREAK_PREFIX));
    const hit = state.phase === 'hit' || state.phase === 'over';
    const at = hit ? null : streakNudgeAt(state);
    if (!at) return;
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return;
    await schedule(`${STREAK_PREFIX}${state.weekStart}`, 'streak', streakNudgeContent(state), at);
  });
}

/** Every nudge, pending or delivered. For sign-out, account deletion and Start fresh. */
export function cancelAllNudges(): Promise<void> {
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
