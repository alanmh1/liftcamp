import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  barWeightForUnitChange,
  APP_STORAGE_PREFIX,
  applyPendingOps,
  asWeightUnit,
  cardioSeconds,
  countedTotals,
  convertWeight,
  accountEmails,
  hasPendingFor,
  isRelayUsername,
  isValidUsername,
  routineProgram,
  isEquipmentAccess,
  isStaleUntouched,
  isTrainingLevel,
  matchPrograms,
  OPEN_WORKOUT_MS,
  roundForDisplay,
  toUserUnit,
  workingSetCount,
  type EquipmentAccess,
  type LocalHomeState,
  type OnboardingCheck,
  type ProgramGroup,
  type ProgramMatch,
  type RoutineEntry,
  type RoutineExercise,
  type TemplateRow,
  type TrainingLevel,
  type WeightUnit,
  type WriteOp,
  replaceUsernameOnLink,
  repeatStart,
  usernameCandidates,
  type RepeatSource,
  groupByRoutine,
  parseUpNextSkips,
  upNextSkipKey,
  type UpNextSkips,
} from '@liftcamp/shared';
import type { User } from '@supabase/supabase-js';
import { getRandomBytes, randomUUID } from 'expo-crypto';

import { listDeviceWorkouts, openDeviceWorkouts } from '@/data/device-workout';
import { invalidateScanCache } from '@/data/scan-cache';
import { deletedWorkoutIds, enqueueWrite, idList, pendingWrites } from '@/data/write-queue';
import {
  EXERCISE_FIELDS,
  START_EXERCISE_FIELDS,
  getBodyweight,
  startWorkout,
  type ActiveWorkout,
  type ExerciseInfo,
  type SetTarget,
  type StartExercise,
} from '@/data/workouts';
import { networkFailedSince, networkOffline } from '@/lib/network';
import { supabase } from '../../lib/supabase';

/**
 * Reads and writes for the Home tab and first launch. Same rules as
 * workouts.ts: screens never import `supabase`, every insert carries a client
 * UUID, and every insert is idempotent on it.
 */

export const DEFAULT_WEEKLY_TARGET = 3;
export const WEEKLY_TARGET_OPTIONS = [2, 3, 4, 5] as const;


// ---------------------------------------------------------------------------
// Dates. Weeks start on Monday, matching the web StreakCard.
// ---------------------------------------------------------------------------

/** Local calendar date as YYYY-MM-DD, the shape `workouts.workout_date` uses. */
export function localDateIso(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function startOfWeek(d = new Date()): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const dow = (out.getDay() + 6) % 7; // Monday = 0
  out.setDate(out.getDate() - dow);
  return out;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function getWeeklyTarget(userId: string): Promise<number> {
  const { data } = await supabase
    .from('user_profiles')
    .select('weekly_target')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.weekly_target ?? DEFAULT_WEEKLY_TARGET;
}

/** Upsert, because an anonymous user may not have a profile row yet. */
export async function setWeeklyTarget(userId: string, target: number): Promise<void> {
  await supabase
    .from('user_profiles')
    .upsert({ user_id: userId, weekly_target: target }, { onConflict: 'user_id' });
}

/**
 * The stored unit, `lb` or `kg`. The column is free text with a CHECK, so
 * the caller maps it to a display label rather than trusting the string.
 * Null when the user has no profile row yet, which every anonymous user
 * starts without. Undefined when the read failed.
 */
export async function getWeightUnit(userId: string): Promise<string | null | undefined> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('weight_unit')
    .eq('user_id', userId)
    .maybeSingle();
  // Undefined for a failed read, so the caller keeps what it already has.
  if (error) return undefined;
  return data?.weight_unit ?? null;
}

// ---------------------------------------------------------------------------
// Body and units (Settings)
// ---------------------------------------------------------------------------

/** Stored values. Null means the question was never answered. */
export const SEXES = ['male', 'female', 'other'] as const;
export type Sex = (typeof SEXES)[number];

export const SEX_LABELS: Record<Sex, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
};

function isSex(v: unknown): v is Sex {
  return typeof v === 'string' && (SEXES as readonly string[]).includes(v);
}

/** Bodyweight limits, per unit. The same range expressed in each. */
export const BODYWEIGHT_RANGE: Record<WeightUnit, { min: number; max: number }> = {
  lb: { min: 30, max: 700 },
  kg: { min: 14, max: 320 },
};

export type BodyProfile = {
  sex: Sex | null;
  /** YYYY-MM-DD, as Postgres returns a `date`. */
  birthday: string | null;
  /** In `weightUnit`. */
  bodyweight: number | null;
  weightUnit: WeightUnit;
};

/** Everything the strength level needs, in one select. */
export async function getBodyProfile(userId: string): Promise<BodyProfile> {
  const { data } = await supabase
    .from('user_profiles')
    .select('sex, birthday, bodyweight, weight_unit')
    .eq('user_id', userId)
    .maybeSingle();
  return {
    sex: isSex(data?.sex) ? data.sex : null,
    birthday: data?.birthday ?? null,
    bodyweight: data?.bodyweight ?? null,
    weightUnit: asWeightUnit(data?.weight_unit),
  };
}

/** Upserts, like the other profile writes: an anonymous user may have no row yet. */
export async function setSex(userId: string, sex: Sex): Promise<void> {
  await supabase.from('user_profiles').upsert({ user_id: userId, sex }, { onConflict: 'user_id' });
}

/** `isoDate` is YYYY-MM-DD, or null to clear it. */
export async function setBirthday(userId: string, isoDate: string | null): Promise<void> {
  await supabase
    .from('user_profiles')
    .upsert({ user_id: userId, birthday: isoDate }, { onConflict: 'user_id' });
}

/** In the profile's current unit. Null clears it. */
export async function setBodyweight(userId: string, value: number | null): Promise<void> {
  await supabase
    .from('user_profiles')
    .upsert({ user_id: userId, bodyweight: value }, { onConflict: 'user_id' });
  // Bodyweight scores bodyweight exercises, so PRs and volume change.
  invalidateScanCache();
}

/**
 * Switches the profile's unit. Bodyweight lives in the profile's unit, so it
 * is converted in the same statement, rounded to 0.1. So does the Pro bar
 * weight, which moves to its counterpart chip (45 lb is 20 kg), while the
 * plates go back to the new unit's defaults (`barWeightForUnitChange`).
 * Logged sets are never touched: each carries the unit it was typed in and
 * converts on read.
 *
 * `bodyweight` is the current value in the old unit, as the caller holds it.
 * Returns the stored bodyweight in the new unit, or false when the write
 * failed and nothing changed.
 */
export async function setWeightUnit(
  userId: string,
  unit: WeightUnit,
  bodyweight: number | null,
): Promise<{ bodyweight: number | null } | false> {
  const from: WeightUnit = unit === 'kg' ? 'lb' : 'kg';
  const next = bodyweight == null ? null : roundForDisplay(convertWeight(bodyweight, from, unit), unit);
  const { data: plates } = await supabase.from('user_profiles').select('bar_weight').eq('user_id', userId).maybeSingle();
  const { error } = await supabase
    .from('user_profiles')
    .upsert(
      {
        user_id: userId,
        weight_unit: unit,
        ...(next != null ? { bodyweight: next } : {}),
        bar_weight: barWeightForUnitChange(plates?.bar_weight ?? null, from, unit),
        plate_inventory: null,
      },
      { onConflict: 'user_id' },
    );
  if (error) return false;
  // The stored bodyweight was just converted, so the cached one is wrong.
  invalidateScanCache();
  return { bodyweight: next };
}

// ---------------------------------------------------------------------------
// Username
// ---------------------------------------------------------------------------

export async function getUsername(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('username')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.username ?? null;
}

/** Postgres unique violation, here always the case-insensitive username index. */
const UNIQUE_VIOLATION = '23505';

/** What the username rules need from the session's user. */
export type UsernameUser = Pick<User, 'id' | 'email' | 'identities' | 'is_anonymous' | 'user_metadata'>;

/**
 * Writes the first of `candidates` that is not taken. `onlyIf` is the
 * username the row must still have (null for none), so a name another
 * screen wrote meanwhile is never overwritten. Returns the name the row
 * ends up with, or null when the write failed.
 */
async function claimUsername(userId: string, candidates: string[], onlyIf: string | null): Promise<string | null> {
  for (const candidate of candidates) {
    // No row yet, or a row with no name: an upsert. A row with a name: an
    // update guarded on that name.
    const { data, error } =
      onlyIf == null
        ? await supabase
            .from('user_profiles')
            .upsert({ user_id: userId, username: candidate }, { onConflict: 'user_id' })
            .select('username')
        : await supabase
            .from('user_profiles')
            .update({ username: candidate })
            .eq('user_id', userId)
            .eq('username', onlyIf)
            .select('username');
    if (!error) {
      // The guarded update matched nothing: the name changed under us.
      const saved = data?.[0]?.username ?? (await getUsername(userId));
      if (saved) void keepUsername(userId, saved);
      return saved;
    }
    if (error.code !== UNIQUE_VIOLATION) return null;
  }
  return null;
}

/**
 * The account's username, minting one if it has none. There is no single
 * place that creates `user_profiles` rows (onboarding, Profile and the web
 * all upsert), so the screens that print a username call this instead of
 * every writer setting one; sign-in calls it too (`settleUsername`).
 *
 * A new name comes from the account's Google or Apple name, with a number
 * when that is taken, else `lifter` plus 5 digits (`usernameCandidates` in
 * shared). Never from an email, and never from an Apple relay address.
 * Existing names are kept. A taken name is found by trying it rather than
 * checking first, since a check races another client.
 */
export async function ensureUsername(user: UsernameUser): Promise<string | null> {
  const existing = await getUsername(user.id);
  if (existing) {
    void keepUsername(user.id, existing);
    return existing;
  }
  return claimUsername(user.id, candidatesFor(user), null);
}

function candidatesFor(user: UsernameUser): string[] {
  return usernameCandidates({
    meta: user.user_metadata,
    emails: accountEmails(user),
    isAnonymous: !!user.is_anonymous,
  });
}

/**
 * After a Google or Apple sign-in, once the name is saved to the account:
 * mints the username from it if there is none. A guest who just linked
 * also has their generated `lifter` name replaced, since they now have a
 * name; a name the guest picked stays. Never throws.
 */
export async function settleUsername({ linked }: { linked: boolean }): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user || user.is_anonymous) return;
    const existing = await getUsername(user.id);
    if (!existing) {
      await claimUsername(user.id, candidatesFor(user), null);
      return;
    }
    if (!linked || !replaceUsernameOnLink(existing)) return;
    // Only names from the account's name: a lifter name for a lifter name
    // is no change.
    const named = candidatesFor(user).filter((n) => !replaceUsernameOnLink(n));
    if (named.length > 0) await claimUsername(user.id, named, existing);
  } catch {
    // The screens mint one on their own if this did not.
  }
}

/**
 * The last username this phone saw for the account, for the summary shown
 * with no signal. Written whenever the server answers with one.
 */
function usernameKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}username:${userId}`;
}

async function keepUsername(userId: string, username: string): Promise<void> {
  try {
    await AsyncStorage.setItem(usernameKey(userId), username);
  } catch {
    // Only the offline summary reads it.
  }
}

export async function cachedUsername(userId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(usernameKey(userId));
  } catch {
    return null;
  }
}

export type SetUsernameResult = { ok: true } | { ok: false; reason: 'taken' | 'invalid' | 'relay' | 'failed' };

/**
 * The editor's save. The shape is checked here too, so the constraint is
 * never the first to see a bad value, and so is the relay rule: `emails`
 * is every email on the account (`accountEmails`).
 */
export async function setUsername(userId: string, username: string, emails: string[]): Promise<SetUsernameResult> {
  if (!isValidUsername(username)) return { ok: false, reason: 'invalid' };
  if (isRelayUsername(username, emails)) return { ok: false, reason: 'relay' };
  const { error } = await supabase
    .from('user_profiles')
    .upsert({ user_id: userId, username }, { onConflict: 'user_id' });
  if (!error) {
    void keepUsername(userId, username);
    return { ok: true };
  }
  return { ok: false, reason: error.code === UNIQUE_VIOLATION ? 'taken' : 'failed' };
}

/**
 * The two onboarding answers that pick programs. Both null for every user
 * who onboarded before they were asked, and for anyone who skipped the page.
 */
export type TrainingPrefs = { level: TrainingLevel | null; equipment: EquipmentAccess | null };

function prefsFrom(row: { training_level?: string | null; equipment_access?: string | null } | null): TrainingPrefs {
  return {
    level: isTrainingLevel(row?.training_level) ? row.training_level : null,
    equipment: isEquipmentAccess(row?.equipment_access) ? row.equipment_access : null,
  };
}

/**
 * The onboarding check's read: the account's training level, or an error.
 * Separate from `getTrainingPrefs` because that one maps a failed request
 * to "no answer", which here would read as "never onboarded" and send an
 * onboarded user offline back through the flow.
 */
export async function checkOnboarding(userId: string): Promise<OnboardingCheck> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('training_level')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return { status: 'error' };
    return { status: 'ok', level: prefsFrom(data).level };
  } catch {
    return { status: 'error' };
  }
}

export async function getTrainingPrefs(userId: string): Promise<TrainingPrefs> {
  const { data } = await supabase
    .from('user_profiles')
    .select('training_level, equipment_access')
    .eq('user_id', userId)
    .maybeSingle();
  return prefsFrom(data);
}

/**
 * Everything Home reads from `user_profiles`, in one select: the weekly
 * target, the program prefs, and what the setup checklist needs. Home used
 * to read the first two separately.
 */
export type HomeProfile = {
  weeklyTarget: number;
  prefs: TrainingPrefs;
  sex: Sex | null;
  /** YYYY-MM-DD. */
  birthday: string | null;
  bodyweight: number | null;
  invitedFriendAt: string | null;
  setupHiddenAt: string | null;
};

export async function getHomeProfile(userId: string): Promise<HomeProfile> {
  const { data } = await supabase
    .from('user_profiles')
    .select('weekly_target, training_level, equipment_access, sex, birthday, bodyweight, invited_friend_at, setup_hidden_at')
    .eq('user_id', userId)
    .maybeSingle();
  return {
    weeklyTarget: data?.weekly_target ?? DEFAULT_WEEKLY_TARGET,
    prefs: prefsFrom(data),
    sex: isSex(data?.sex) ? data.sex : null,
    birthday: data?.birthday ?? null,
    bodyweight: data?.bodyweight ?? null,
    invitedFriendAt: data?.invited_friend_at ?? null,
    setupHiddenAt: data?.setup_hidden_at ?? null,
  };
}

/** The share sheet reported a share. Upserts: a guest may have no row yet. */
export async function markInvited(userId: string): Promise<void> {
  await supabase
    .from('user_profiles')
    .upsert({ user_id: userId, invited_friend_at: new Date().toISOString() }, { onConflict: 'user_id' });
}

/** Hides the setup checklist for good. */
export async function hideSetup(userId: string): Promise<void> {
  await supabase
    .from('user_profiles')
    .upsert({ user_id: userId, setup_hidden_at: new Date().toISOString() }, { onConflict: 'user_id' });
}

export async function setTrainingPrefs(userId: string, prefs: Partial<TrainingPrefs>): Promise<void> {
  await supabase.from('user_profiles').upsert(
    {
      user_id: userId,
      ...(prefs.level !== undefined ? { training_level: prefs.level } : {}),
      ...(prefs.equipment !== undefined ? { equipment_access: prefs.equipment } : {}),
    },
    { onConflict: 'user_id' },
  );
}

// ---------------------------------------------------------------------------
// Week strip
// ---------------------------------------------------------------------------

export function endOfWeek(d = new Date()): Date {
  const out = startOfWeek(d);
  out.setDate(out.getDate() + 6);
  return out;
}

/** Rows per page of the streak read; PostgREST answers at most 1000 per request. */
const STREAK_PAGE = 1000;

/**
 * Every finished workout date up to the end of this week, newest first
 * (so a page that fails loses the oldest), bounded at the end like
 * getWeekWorkoutDates. Home derives this week's
 * count, the streak and the medals from this one read, and Profile the
 * streak and the medal cabinet. The whole history, so a streak past a year
 * keeps counting toward the 78 and 104 week medals. Raw; weekCardState
 * dedupes. A date list stays small (a year at five a week is 260 rows), and
 * it reads in pages so a longer one is not cut off at 1000.
 */
export async function getStreakWorkoutDates(userId: string): Promise<string[]> {
  const out: string[] = [];
  const deleted = await deletedWorkoutIds(userId);
  for (let from = 0; ; from += STREAK_PAGE) {
    let q = supabase
      .from('workouts')
      .select('workout_date')
      .eq('user_id', userId)
      .not('finished_at', 'is', null)
      .lte('workout_date', localDateIso(endOfWeek()));
    if (deleted.length > 0) q = q.not('id', 'in', idList(deleted));
    const { data, error } = await q
      .order('workout_date', { ascending: false })
      .order('id')
      .range(from, from + STREAK_PAGE - 1);
    if (error || !data) break;
    out.push(...data.map((r) => r.workout_date as string));
    if (data.length < STREAK_PAGE) break;
  }
  return out;
}

/**
 * The distinct days this week, Monday to Sunday, with at least one finished
 * workout, as YYYY-MM-DD.
 *
 * Distinct matters: two finished workouts on Tuesday are one training day, and
 * the strip's "N of target" counts days. The query is bounded on both ends so
 * a workout dated into next week (a backdate typo, or a device clock ahead)
 * does not count against this one.
 */
export async function getWeekWorkoutDates(userId: string): Promise<string[]> {
  const deleted = await deletedWorkoutIds(userId);
  let q = supabase
    .from('workouts')
    .select('workout_date')
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .gte('workout_date', localDateIso(startOfWeek()))
    .lte('workout_date', localDateIso(endOfWeek()));
  if (deleted.length > 0) q = q.not('id', 'in', idList(deleted));
  const { data } = await q;
  return [...new Set((data ?? []).map((r) => r.workout_date as string))];
}

// ---------------------------------------------------------------------------
// Workouts on Home
// ---------------------------------------------------------------------------

export type InProgressWorkout = {
  id: string;
  name: string | null;
  createdAt: string;
  exerciseCount: number;
};

/** An unfinished workout started in the last 24 hours, or null. */
export async function getInProgressWorkout(userId: string): Promise<InProgressWorkout | null> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('workouts')
    .select('id, name, created_at, workout_exercises(id)')
    .eq('user_id', userId)
    .is('finished_at', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  // Finished or discarded on this phone, and not synced yet: not in progress.
  const local = applyPendingOps(data.id, { id: data.id, finished_at: null }, await pendingWrites(userId));
  if (!local || local.finished_at != null) return null;
  return {
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
    exerciseCount: (data.workout_exercises ?? []).length,
  };
}

/**
 * The newest workout in progress that this phone has a copy of: started in
 * the last 24 hours, not finished, and with no finish or discard waiting in
 * the queue. Device storage only, so it answers at once and with no
 * signal. Copies in either unit count, since changing units does not end a
 * workout. The header's Resume, and the check before any new start.
 */
export async function getDeviceOpenWorkout(userId: string): Promise<{ id: string; createdAt: string } | null> {
  const [ops, kg, lb] = await Promise.all([
    pendingWrites(userId),
    listDeviceWorkouts(userId, 'kg'),
    listDeviceWorkouts(userId, 'lb'),
  ]);
  const open = openDeviceWorkouts([...kg, ...lb], ops)[0];
  return open ? { id: open.id, createdAt: open.createdAt } : null;
}

/**
 * Unfinished workouts older than the Resume window with no set ticked and
 * nothing typed (isStaleUntouched in shared): opened to read, never used.
 * The start gate discards them without asking. A workout the phone has a
 * copy of is judged by the copy, which holds edits still queued; one with
 * queued writes and no copy is left alone. The server is asked for at most
 * 20, oldest first, and not at all while the last request got no response
 * (networkOffline): the phone's copies answer alone then.
 */
export async function getStaleUntouchedWorkouts(userId: string): Promise<string[]> {
  const since = new Date(Date.now() - OPEN_WORKOUT_MS).toISOString();
  const [ops, kg, lb, server] = await Promise.all([
    pendingWrites(userId),
    listDeviceWorkouts(userId, 'kg'),
    listDeviceWorkouts(userId, 'lb'),
    networkOffline()
      ? []
      : supabase
          .from('workouts')
          .select(
            'id, created_at, workout_exercises(sets(completed, weight_value, reps, duration_seconds, distance_meters, incline_percent))',
          )
          .eq('user_id', userId)
          .is('finished_at', null)
          .lt('created_at', since)
          .order('created_at', { ascending: true })
          .limit(20)
          .then(({ data }) => data ?? [], () => []),
  ]);
  const ended = new Set<string>();
  for (const op of ops) {
    if (op.table !== 'workouts') continue;
    if (op.kind === 'delete') ended.add(op.id);
    if (op.kind === 'update' && typeof op.patch.finished_at === 'string') ended.add(op.id);
  }
  const copies = new Map([...kg, ...lb].map((c) => [c.workout.id, c.workout]));
  const stale = new Set<string>();
  for (const w of copies.values()) {
    if (ended.has(w.id)) continue;
    const sets = w.exercises.flatMap((we) => we.sets);
    if (isStaleUntouched({ createdAt: w.createdAt, finishedAt: w.finishedAt, sets })) stale.add(w.id);
  }
  for (const row of server) {
    if (ended.has(row.id) || copies.has(row.id) || hasPendingFor(ops, row.id)) continue;
    const sets = (row.workout_exercises ?? []).flatMap((we) => we.sets ?? []);
    if (isStaleUntouched({ createdAt: row.created_at, sets })) stale.add(row.id);
  }
  return [...stale];
}

/** Finished workouts on the server, less any whose delete is still queued on the phone. */
export async function getFinishedWorkoutCount(userId: string): Promise<number> {
  const deleted = await deletedWorkoutIds(userId);
  let q = supabase
    .from('workouts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('finished_at', 'is', null);
  if (deleted.length > 0) q = q.not('id', 'in', idList(deleted));
  const { count } = await q;
  return count ?? 0;
}

export type LastWorkout = {
  id: string;
  name: string | null;
  workoutDate: string;
  createdAt: string;
  finishedAt: string;
  exerciseCount: number;
  /** In the user's unit, via setVolume so unilateral doubling is honoured. */
  volume: number;
  /**
   * Completed cardio time in seconds, shown where volume goes when there is
   * no volume. Missing on a Home cache written before it existed.
   */
  cardioSeconds?: number;
  /** The exercises in position order with their set counts, for Repeat. */
  exercises: RepeatExercise[];
  /** The routine day it was done from, for Repeat. Missing on a Home cache written before it existed. */
  templateId?: string | null;
};

export async function getLastWorkout(userId: string, unit: WeightUnit): Promise<LastWorkout | null> {
  const deleted = await deletedWorkoutIds(userId);
  let q = supabase
    .from('workouts')
    .select(
      `id, name, workout_date, created_at, finished_at, template_id,
       workout_exercises(exercise_id, position,
         exercises(${START_EXERCISE_FIELDS}),
         sets(weight, weight_value, weight_unit, reps, duration_seconds, completed, set_type))`,
    )
    .eq('user_id', userId)
    .not('finished_at', 'is', null);
  if (deleted.length > 0) q = q.not('id', 'in', idList(deleted));
  const { data } = await q.order('finished_at', { ascending: false }).limit(1).maybeSingle();
  if (!data || !data.finished_at) return null;

  const bodyweight = await getBodyweight(userId);
  const wes = (data.workout_exercises ?? []) as unknown as {
    exercise_id: string;
    position: number;
    exercises: ExerciseInfo | null;
    sets:
      | {
          weight: string | null;
          weight_value: number | null;
          weight_unit: string;
          reps: number | null;
          duration_seconds: number | null;
          completed: boolean;
          set_type: string | null;
        }[]
      | null;
  }[];

  const { volume } = countedTotals(
    wes.map((we) => ({ exercise: we.exercises, sets: (we.sets ?? []).map((s) => toUserUnit(s, unit)) })),
    bodyweight,
  );

  const ordered = [...wes].sort((a, b) => a.position - b.position);
  return {
    id: data.id,
    name: data.name,
    workoutDate: data.workout_date,
    createdAt: data.created_at,
    finishedAt: data.finished_at,
    exerciseCount: wes.length,
    volume,
    cardioSeconds: cardioSeconds(wes.map((we) => ({ exercise: we.exercises, sets: we.sets }))),
    exercises: ordered
      .filter((we) => we.exercises != null)
      .map((we) => ({ exercise: we.exercises!, setCount: workingSetCount(we.sets) })),
    templateId: data.template_id,
  };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export type HomeTemplate = TemplateRow & {
  /** The date (YYYY-MM-DD, local) of the most recent finished workout started from this template, or null. */
  lastDone: string | null;
  /**
   * When that workout finished, ISO. Orders two days done on the same date
   * for Next up. Missing on a Home cache written before it existed.
   */
  lastDoneAt?: string | null;
};

// The joined exercise columns and created_at feed the routine card art:
// which illustration a routine gets depends on its exercises' equipment
// and muscles, and on the order the templates were created. The embed
// follows template_exercises_exercise_id_fkey, applied 16 Sep 2026. The
// rest of each exercise's fields ride along so a start needs no read.
const TEMPLATE_FIELDS =
  `id, name, is_system, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, level, days_per_week, equipment, created_at, template_exercises(exercise_id, position, target_sets, target_reps, exercises(${START_EXERCISE_FIELDS}))`;

/** Surfaces a read error in development; production keeps its empty result. */
function warnRead(where: string, error: { message: string; code?: string } | null) {
  if (error && __DEV__) console.warn(`[home] ${where}: ${error.code ?? ''} ${error.message}`);
}

/**
 * The last saved routines read for each user, so the routine detail a row
 * opens draws at once. Only ever a read the server answered.
 */
const userTemplatesLoaded = new Map<string, HomeTemplate[]>();

/** A saved day from the last read, or undefined. */
export function peekUserTemplate(userId: string, templateId: string): HomeTemplate | undefined {
  return userTemplatesLoaded.get(userId)?.find((t) => t.id === templateId);
}

export async function getUserTemplates(userId: string): Promise<HomeTemplate[]> {
  const rows = await readUserTemplates(userId);
  if (rows) userTemplatesLoaded.set(userId, rows);
  return rows ?? [];
}

/** Null when the templates read failed. */
async function readUserTemplates(userId: string): Promise<HomeTemplate[] | null> {
  const [{ data, error }, removed] = await Promise.all([
    supabase
      .from('templates')
      .select(TEMPLATE_FIELDS)
      .eq('user_id', userId)
      .eq('is_system', false)
      .order('created_at', { ascending: false }),
    pendingTemplateRemovals(userId),
  ]);
  warnRead('user templates', error);
  if (error) return null;
  // A routine removed on the phone stays gone while its delete waits in
  // the queue, so nothing can start it again.
  const rows = ((data ?? []) as unknown as TemplateRow[]).filter((r) => !removed.has(r.id));
  if (rows.length === 0) return [];

  // "Last done" keys on workouts.template_id, set when a workout is seeded
  // from a routine. Uses the (user_id, template_id) index. A renamed routine
  // or a workout renamed after the fact no longer breaks the match.
  const { data: recent } = await supabase
    .from('workouts')
    .select('template_id, workout_date, finished_at')
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .in('template_id', rows.map((r) => r.id))
    .order('finished_at', { ascending: false })
    .limit(200);
  const lastByTemplate = new Map<string, { date: string; at: string }>();
  for (const w of recent ?? []) {
    if (w.template_id && w.finished_at && !lastByTemplate.has(w.template_id)) {
      lastByTemplate.set(w.template_id, { date: w.workout_date, at: w.finished_at });
    }
  }
  return rows.map((r) => {
    const last = lastByTemplate.get(r.id);
    return { ...r, lastDone: last?.date ?? null, lastDoneAt: last?.at ?? null };
  });
}

/**
 * Your routines, grouped for Home. Copies saved by "Use routine" carry
 * `program`, and every variation of one routine gathers under a heading
 * with that name. An older copy saved one day at a time has no program
 * but a "Program · Day" name, and joins its routine by that
 * (routineProgram). Anything else (a routine built by hand) is a group of
 * one with no heading. Groups keep the newest-first
 * order of the list; variations within a group sort by training order
 * (`position`, copied from the system template), the same order the
 * routine detail shows.
 */
export type UserRoutineGroup = {
  key: string;
  program: string | null;
  level: string | null;
  templates: HomeTemplate[];
};

export function groupUserTemplates(mine: HomeTemplate[]): UserRoutineGroup[] {
  return groupByRoutine(mine).map((g) => ({
    ...g,
    // The first day read, whatever its place in training order.
    level: g.program ? (mine.find((t) => routineProgram(t) === g.program)?.level ?? null) : null,
  }));
}

/** Every system routine, all 17 programs. Filtering is the caller's. */
/**
 * The system routines, cached for the session: they only change with a
 * release, never while the app runs. Home and the routines list share one
 * request. A failed read is not kept, so the next call tries again.
 */
let systemTemplates: Promise<TemplateRow[] | null> | null = null;
/** The same rows once they have landed, for a screen's first render. */
let systemTemplatesLoaded: TemplateRow[] | undefined;

/** The cached system routines if a read has already landed, else undefined. */
export function peekSystemTemplates(): TemplateRow[] | undefined {
  return systemTemplatesLoaded;
}

export function getSystemTemplates(): Promise<TemplateRow[]> {
  if (!systemTemplates) {
    const pending = fetchSystemTemplates();
    systemTemplates = pending;
    pending.then(
      (rows) => {
        if (rows === null && systemTemplates === pending) systemTemplates = null;
        if (rows !== null) systemTemplatesLoaded = rows;
      },
      () => {
        if (systemTemplates === pending) systemTemplates = null;
      },
    );
  }
  return systemTemplates.then((rows) => rows ?? []);
}

/** Null on a failed read, so the cache knows not to keep it. */
async function fetchSystemTemplates(): Promise<TemplateRow[] | null> {
  const { data, error } = await supabase
    .from('templates')
    .select(TEMPLATE_FIELDS)
    .eq('is_system', true)
    .order('program_order', { ascending: true })
    .order('position', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });
  warnRead('system templates', error);
  if (error) return null;
  return (data ?? []) as unknown as TemplateRow[];
}

/**
 * The starter programs a user should see, from the system rows and their
 * answers. With a level, the matcher decides and `hide_from_onboarding` is
 * ignored. With no level (every user from before the question existed, and
 * anyone who skipped it) the list is the beginner programs not flagged off
 * onboarding: beginner is what the app assumes about a lifter who has not
 * said otherwise. It is still `matched: false`, so the screen shows a count
 * rather than claiming an answer the user did not give.
 */
export function starterPrograms(rows: TemplateRow[], prefs: TrainingPrefs): ProgramMatch & { matched: boolean } {
  if (!prefs.level) {
    const visible = rows.filter((t) => !t.hide_from_onboarding);
    return { ...matchPrograms(visible, 'beginner', prefs.equipment), matched: false };
  }
  return { ...matchPrograms(rows, prefs.level, prefs.equipment), matched: true };
}

/** Every program not flagged off onboarding, no level or equipment filter. See all. */
export function allPrograms(rows: TemplateRow[]): ProgramMatch & { matched: boolean } {
  return { ...matchPrograms(rows.filter((t) => !t.hide_from_onboarding), null, null), matched: false };
}

export async function exercisesByIds(ids: string[]): Promise<Map<string, ExerciseInfo>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from('exercises').select(EXERCISE_FIELDS).in('id', ids);
  return new Map(((data ?? []) as ExerciseInfo[]).map((e) => [e.id, e]));
}

/**
 * The exercises a start needs, from what the caller already has: the
 * routine's or the workout's joined exercise rows. Any row the join did
 * not carry (a template read without it) is read by id, which needs
 * signal. Ids the catalog no longer has are dropped, keeping plan order.
 */
async function startExercises(
  plan: { exerciseId: string; exercise?: ExerciseInfo | null; target?: SetTarget | null; setCount?: number | null }[],
): Promise<StartExercise[]> {
  const missing = plan.filter((p) => !p.exercise?.name).map((p) => p.exerciseId);
  const byId = missing.length > 0 ? await exercisesByIds(missing) : new Map<string, ExerciseInfo>();
  const out: StartExercise[] = [];
  for (const p of plan) {
    const exercise = p.exercise?.name ? p.exercise : byId.get(p.exerciseId);
    if (exercise) out.push({ exercise, target: p.target ?? null, setCount: p.setCount ?? null });
  }
  return out;
}

/** Starts from a routine: rows per target_sets, and the workout records which routine. */
export async function startFromTemplate(
  userId: string,
  template: TemplateRow,
  unit: WeightUnit,
): Promise<string | null> {
  const ordered = [...template.template_exercises].sort((a, b) => a.position - b.position);
  const exercises = await startExercises(
    ordered.map((te) => ({
      exerciseId: te.exercise_id,
      // TEMPLATE_FIELDS joins START_EXERCISE_FIELDS.
      exercise: te.exercises as ExerciseInfo | null | undefined,
      target: { sets: te.target_sets ?? null, reps: te.target_reps ?? null },
    })),
  );
  return startWorkout(userId, unit, { name: template.name, templateId: template.id, exercises });
}

/** An exercise to repeat, with how many sets it had. */
export type RepeatExercise = { exercise: ExerciseInfo; setCount: number };

/**
 * A new workout with the same exercises in the same order, and as many
 * sets of each, done as the same routine day (see `repeatStart`). Home's
 * Last workout card and the history detail both pass what they have.
 */
export async function repeatWorkout(
  userId: string,
  source: RepeatSource & { exercises: RepeatExercise[] },
  unit: WeightUnit,
): Promise<string | null> {
  const [exercises, removed] = await Promise.all([
    startExercises(
      source.exercises.map((e) => ({ exerciseId: e.exercise.id, exercise: e.exercise, setCount: e.setCount })),
    ),
    pendingTemplateRemovals(userId),
  ]);
  const { name, templateId } = repeatStart(source, removed);
  return startWorkout(userId, unit, { name, templateId, exercises });
}

/** A routine to write as the user's own: its days' exercises in order, with their targets. */
export type NewRoutine = {
  name: string;
  /** The program heading Home groups it under. Null for a standalone routine. */
  program: string | null;
  /** Ride along with `program` on a copy of a starter routine. */
  programSlug?: string | null;
  level?: string | null;
  position?: number | null;
  exercises: { exerciseId: string; targetSets: number | null; targetReps: string | null }[];
};

export type SaveRoutineResult =
  | { ok: true; id: string }
  /** `offline`: a request got no response at all. `failed`: the server said no. */
  | { ok: false; reason: 'offline' | 'failed' };

/**
 * Writes a routine as the user's own: the `templates` row, then its
 * `template_exercises`. Online only, straight to the server, not through
 * the write queue.
 *
 * No empty routines: when the exercises do not save, the `templates` row
 * is deleted again and the save reports failure. (With the signal gone
 * between the two writes the delete fails too; that row then shows on
 * Home as a routine with no exercises, the one case this cannot cover.)
 */
export async function insertRoutine(userId: string, routine: NewRoutine): Promise<SaveRoutineResult> {
  const startedAt = Date.now();
  const failed = (): SaveRoutineResult => ({ ok: false, reason: networkFailedSince(startedAt) ? 'offline' : 'failed' });
  const id = randomUUID();
  const { error } = await supabase.from('templates').upsert(
    {
      id,
      user_id: userId,
      name: routine.name,
      is_system: false,
      program: routine.program,
      program_slug: routine.programSlug ?? null,
      level: routine.level ?? null,
      position: routine.position ?? null,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) return failed();
  if (routine.exercises.length > 0) {
    const { error: exError } = await supabase.from('template_exercises').upsert(
      routine.exercises.map((e, i) => ({
        id: randomUUID(),
        template_id: id,
        exercise_id: e.exerciseId,
        user_id: userId,
        position: i,
        target_sets: e.targetSets,
        target_reps: e.targetReps,
      })),
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (exError) {
      warnRead('routine exercises insert', exError);
      // template_exercises cascade on template_id, so this clears any
      // that did land.
      await supabase.from('templates').delete().eq('id', id);
      return failed();
    }
  }
  return { ok: true, id };
}

/**
 * Save a starter routine as one of the user's own. Returns the new id, or
 * null when it did not save (and left nothing behind).
 *
 * `keepProgram` carries program, program_slug and level onto the copy, so
 * Home can group the variations of a routine under its name. Off, the copy
 * is a standalone routine, which is what an older copy or a hand-built one
 * is.
 */
export async function saveTemplateCopy(
  userId: string,
  template: TemplateRow,
  keepProgram = false,
): Promise<string | null> {
  const ordered = [...template.template_exercises].sort((a, b) => a.position - b.position);
  const result = await insertRoutine(userId, {
    name: template.name,
    program: keepProgram ? (template.program ?? null) : null,
    programSlug: keepProgram ? (template.program_slug ?? null) : null,
    level: keepProgram ? (template.level ?? null) : null,
    position: keepProgram ? (template.position ?? null) : null,
    // The targets come too, so a workout started from the copy shows them
    // on its cards the way one started from the original does.
    exercises: ordered.map((te) => ({
      exerciseId: te.exercise_id,
      targetSets: te.target_sets ?? null,
      targetReps: te.target_reps ?? null,
    })),
  });
  return result.ok ? result.id : null;
}

/**
 * Save routine, from a finished workout: what was completed, through
 * routineFromWorkout in shared, as a standalone routine. The caller hides
 * the button when that leaves nothing to save.
 *
 * The source workout is then credited to the new routine, so it reads as
 * done and Next up moves past it: `template_id` is set when the workout
 * has none (one started from another routine keeps that credit), and a
 * blank name takes the routine's. Online only, like the save. A failed
 * stamp leaves the routine saved and still reports ok.
 */
export async function saveWorkoutAsRoutine(
  userId: string,
  name: string,
  exercises: RoutineExercise[],
  sourceWorkoutId: string,
): Promise<SaveRoutineResult> {
  const routineName = name.trim();
  const result = await insertRoutine(userId, { name: routineName, program: null, exercises });
  if (!result.ok) return result;

  const { data: source, error } = await supabase
    .from('workouts')
    .select('name, template_id')
    .eq('id', sourceWorkoutId)
    .eq('user_id', userId)
    .maybeSingle();
  warnRead('save routine source workout', error);
  if (!source || source.template_id) return result;

  // `.is('template_id', null)` so a link written in between is never
  // overwritten.
  const { error: stampError } = await supabase
    .from('workouts')
    .update({ template_id: result.id, ...(source.name?.trim() ? {} : { name: routineName }) })
    .eq('id', sourceWorkoutId)
    .eq('user_id', userId)
    .is('template_id', null);
  warnRead('save routine stamp', stampError);
  return result;
}

/** The names of the user's saved routines, for Save routine's same-name hint. Empty on a failed read. */
export async function getUserRoutineNames(userId: string): Promise<string[]> {
  const [{ data, error }, removed] = await Promise.all([
    supabase.from('templates').select('id, name').eq('user_id', userId).eq('is_system', false),
    pendingTemplateRemovals(userId),
  ]);
  warnRead('routine names', error);
  return (data ?? []).filter((t) => !removed.has(t.id)).map((t) => t.name);
}

/** A saved routine Update routine may write to: the user's own, with its exercises in order. */
export type UpdatableRoutine = { id: string; name: string; exercises: RoutineEntry[] };

/**
 * The routine a finished workout was started from, when Update routine may
 * write to it: the user's own (not a system routine), still there, and not
 * removed on the phone. Null otherwise, and on a failed read.
 *
 * `latestWorkoutId`, from History: also null unless that workout is the
 * routine's most recent finished one on the server, so an older workout
 * never overwrites a newer change.
 */
export async function getUpdatableRoutine(
  userId: string,
  templateId: string,
  latestWorkoutId?: string,
): Promise<UpdatableRoutine | null> {
  const [{ data, error }, removed, latest] = await Promise.all([
    supabase
      .from('templates')
      .select('id, name, template_exercises(exercise_id, position, target_sets, target_reps)')
      .eq('id', templateId)
      .eq('user_id', userId)
      .eq('is_system', false)
      .maybeSingle(),
    pendingTemplateRemovals(userId),
    latestWorkoutId
      ? supabase
          .from('workouts')
          .select('id')
          .eq('user_id', userId)
          .eq('template_id', templateId)
          .not('finished_at', 'is', null)
          .order('finished_at', { ascending: false })
          .limit(1)
      : null,
  ]);
  warnRead('updatable routine', error);
  if (error || !data || removed.has(data.id)) return null;
  if (latest) {
    warnRead('routine latest workout', latest.error);
    if (latest.error || latest.data?.[0]?.id !== latestWorkoutId) return null;
  }
  const exercises = [...(data.template_exercises ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((te) => ({ exerciseId: te.exercise_id, targetSets: te.target_sets, targetReps: te.target_reps }));
  return { id: data.id, name: data.name, exercises };
}

/**
 * Update routine: replaces a saved routine's exercises with `exercises`
 * (routineChanges in shared), in that order. Online only, straight to the
 * server, like insertRoutine, with the same failure reasons.
 *
 * The new `template_exercises` rows go in first, then the old ones are
 * deleted by id, so a failed insert leaves the routine as it was and never
 * empty. A failed delete takes the new rows out again and reports failure.
 * Only for the user's own routine; a system routine or someone else's
 * reports failed and writes nothing.
 *
 * The workout's `template_id` is untouched, so its credit to the routine
 * and the routine's "Done X days ago" stay where they were.
 */
export async function updateRoutineExercises(
  userId: string,
  templateId: string,
  exercises: RoutineEntry[],
): Promise<SaveRoutineResult> {
  const startedAt = Date.now();
  const failed = (): SaveRoutineResult => ({ ok: false, reason: networkFailedSince(startedAt) ? 'offline' : 'failed' });
  if (exercises.length === 0) return { ok: false, reason: 'failed' };

  const { data: owned, error: ownedError } = await supabase
    .from('templates')
    .select('id, template_exercises(id)')
    .eq('id', templateId)
    .eq('user_id', userId)
    .eq('is_system', false)
    .maybeSingle();
  warnRead('update routine owner', ownedError);
  if (ownedError) return failed();
  if (!owned) return { ok: false, reason: 'failed' };
  const oldIds = (owned.template_exercises ?? []).map((te) => te.id);

  const rows = exercises.map((e, i) => ({
    id: randomUUID(),
    template_id: templateId,
    exercise_id: e.exerciseId,
    user_id: userId,
    position: i,
    target_sets: e.targetSets,
    target_reps: e.targetReps,
  }));
  const { error: insertError } = await supabase
    .from('template_exercises')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  if (insertError) {
    warnRead('update routine insert', insertError);
    return failed();
  }

  if (oldIds.length > 0) {
    // RLS skips a row it hides without an error, so the count is checked too.
    const { data: deleted, error: deleteError } = await supabase
      .from('template_exercises')
      .delete()
      .in('id', oldIds)
      .select('id');
    if (deleteError || (deleted?.length ?? 0) < oldIds.length) {
      warnRead('update routine delete', deleteError);
      const newIds = rows.map((r) => r.id);
      await supabase.from('template_exercises').delete().in('id', newIds);
      return failed();
    }
  }
  // The routine detail draws from the last read; the next one has the new exercises.
  userTemplatesLoaded.delete(userId);
  return { ok: true, id: templateId };
}

/**
 * "Use routine": every variation of a routine saved as the user's own, in
 * program order, so Home lists them together with their own Start buttons.
 * Sequential, so the created_at order Home sorts by matches the variations.
 */
export async function saveProgramCopy(userId: string, group: ProgramGroup): Promise<boolean> {
  let ok = true;
  for (const t of group.templates) {
    if (!(await saveTemplateCopy(userId, t, true))) ok = false;
  }
  return ok;
}

export async function renameTemplate(templateId: string, name: string): Promise<void> {
  await supabase.from('templates').update({ name: name.trim() }).eq('id', templateId);
}

/** `templates` ids with a delete waiting in the queue: saved routines removed on the phone. */
function templateRemovals(ops: readonly WriteOp[]): string[] {
  const ids: string[] = [];
  for (const op of ops) if (op.kind === 'delete' && op.table === 'templates') ids.push(op.id);
  return ids;
}

async function pendingTemplateRemovals(userId: string): Promise<Set<string>> {
  return new Set(templateRemovals(await pendingWrites(userId)));
}

/**
 * Removes a saved routine: a delete of each of its days (the user's own
 * `templates` rows) through the write queue, so it works offline. Their
 * template_exercises cascade on the server. Workouts done from it stay:
 * `workouts.template_id` is ON DELETE SET NULL, and sets, PRs and the
 * streak hang off the workouts. False when the phone could not save the
 * deletes.
 */
export async function removeRoutine(userId: string, templateIds: string[]): Promise<boolean> {
  for (const id of templateIds) {
    const saved = await enqueueWrite(userId, { kind: 'delete', table: 'templates', id, parents: [] });
    if (!saved) return false;
  }
  return true;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  // template_exercises cascade on template_id.
  await supabase.from('templates').delete().eq('id', templateId);
}

export const SHARE_ORIGIN = 'https://liftcamp.app';

/** Same 14-character base-36 token the web mints, so /r/:token resolves it. */
function newShareToken(): string {
  return Array.from(getRandomBytes(9), (b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 14);
}

/**
 * The unlisted link for a routine, minting a token the first time. Sharing is
 * opt-in per routine: without a token the row stays private.
 */
export async function ensureShareLink(templateId: string): Promise<string | null> {
  const { data: existing, error } = await supabase
    .from('templates')
    .select('share_token')
    .eq('id', templateId)
    .maybeSingle();
  if (error) return null;
  if (existing?.share_token) return `${SHARE_ORIGIN}/r/${existing.share_token}`;

  const token = newShareToken();
  const { error: upErr } = await supabase
    .from('templates')
    .update({ share_token: token, shared_at: new Date().toISOString() })
    .eq('id', templateId);
  if (upErr) return null;
  return `${SHARE_ORIGIN}/r/${token}`;
}

// The Resume card's swipe-to-discard and the workout screen's Cancel share one
// delete path, which lives with the other workout writes.
export { discardWorkout } from '@/data/workouts';

// ---------------------------------------------------------------------------
// What the phone knows that the server may not yet
// ---------------------------------------------------------------------------

/**
 * Home as last read in full, per user, so Home draws at once on launch and
 * has something to show with no signal. Written only after a load in which
 * no request went unanswered (see networkFailedSince), so an offline load
 * never replaces it with empty defaults. The unit is kept with it because
 * the last workout's volume is in that unit.
 */
function homeCacheKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}home:${userId}`;
}

export async function readHomeCache<T>(userId: string, unit: WeightUnit): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(homeCacheKey(userId));
    if (!raw) return null;
    const cached = JSON.parse(raw) as { unit: WeightUnit; data: T };
    return cached.unit === unit ? cached.data : null;
  } catch {
    return null;
  }
}

/**
 * The same cache held in memory, so Home's first frame can draw from it
 * with no await. UnitProvider primes it at launch, before it reports the
 * unit ready, and every save keeps it current.
 */
const homeCacheMemory = new Map<string, unknown>();

function memoryKey(userId: string, unit: WeightUnit): string {
  return `${userId}|${unit}`;
}

export async function primeHomeCache(userId: string, unit: WeightUnit): Promise<void> {
  const [data] = await Promise.all([readHomeCache<unknown>(userId, unit), readUpNextSkips(userId)]);
  if (data) homeCacheMemory.set(memoryKey(userId, unit), data);
}

export function peekHomeCache<T>(userId: string, unit: WeightUnit): T | undefined {
  return homeCacheMemory.get(memoryKey(userId, unit)) as T | undefined;
}

/**
 * The Skips on Home's Next up card (`upNextDay`), on this phone only. Held
 * in memory beside the cache, so the first frame offers the right day.
 */
const upNextSkipsMemory = new Map<string, UpNextSkips>();

export async function readUpNextSkips(userId: string): Promise<UpNextSkips> {
  let skips: UpNextSkips = {};
  try {
    skips = parseUpNextSkips(await AsyncStorage.getItem(upNextSkipKey(userId)));
  } catch {
    // Nothing skipped: Next up offers the day it would anyway.
  }
  upNextSkipsMemory.set(userId, skips);
  return skips;
}

export function peekUpNextSkips(userId: string): UpNextSkips {
  return upNextSkipsMemory.get(userId) ?? {};
}

export async function saveUpNextSkips(userId: string, skips: UpNextSkips): Promise<void> {
  upNextSkipsMemory.set(userId, skips);
  try {
    await AsyncStorage.setItem(upNextSkipKey(userId), JSON.stringify(skips));
  } catch {
    // The skip lasts until the app closes.
  }
}

export async function saveHomeCache<T>(userId: string, unit: WeightUnit, data: T): Promise<void> {
  homeCacheMemory.set(memoryKey(userId, unit), data);
  try {
    await AsyncStorage.setItem(homeCacheKey(userId), JSON.stringify({ unit, data }));
  } catch {
    // Home reads the server again next time.
  }
}

/** A workout the phone has finished, as the Last workout card shows it. */
function lastWorkoutFromCopy(w: ActiveWorkout, finishedAt: string): LastWorkout {
  const { volume } = countedTotals(w.exercises, w.bodyweight);
  return {
    id: w.id,
    name: w.name,
    workoutDate: localDateIso(new Date(w.createdAt)),
    createdAt: w.createdAt,
    finishedAt,
    exerciseCount: w.exercises.length,
    volume,
    cardioSeconds: cardioSeconds(w.exercises),
    exercises: w.exercises.map((we) => ({ exercise: we.exercise, setCount: workingSetCount(we.sets) })),
    templateId: w.templateId ?? null,
  };
}

/**
 * What Home lays over the server's answer (mergeHomePending in shared):
 * workouts finished or discarded here whose writes are still queued, the
 * newest workout in progress that has writes the server does not have yet,
 * and saved routines removed here whose deletes are still queued. Read
 * from the write queue and the phone's workout copies, with no request.
 */
export async function getLocalHomeState(
  userId: string,
  unit: WeightUnit,
): Promise<LocalHomeState<InProgressWorkout, LastWorkout>> {
  const [ops, copies] = await Promise.all([pendingWrites(userId), listDeviceWorkouts(userId, unit)]);

  const ended = new Set<string>();
  const finishing = new Map<string, string>();
  for (const op of ops) {
    if (op.table !== 'workouts') continue;
    if (op.kind === 'delete') ended.add(op.id);
    if (op.kind === 'update' && typeof op.patch.finished_at === 'string') {
      ended.add(op.id);
      finishing.set(op.id, op.patch.finished_at);
    }
  }

  // Copies of workouts the server has in full are the server's to show.
  const unsynced = copies.filter((c) => hasPendingFor(ops, c.workout.id));
  const finished = unsynced.filter((c) => finishing.has(c.workout.id));
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const open = unsynced.find(
    (c) => !c.workout.finishedAt && !ended.has(c.workout.id) && Date.parse(c.workout.createdAt) >= since,
  );

  return {
    endedIds: [...ended],
    finished: finished.map((c) => ({ id: c.workout.id, date: localDateIso(new Date(c.workout.createdAt)) })),
    unfinished: open
      ? {
          id: open.workout.id,
          name: open.workout.name,
          createdAt: open.workout.createdAt,
          exerciseCount: open.workout.exercises.length,
        }
      : null,
    lastFinished: finished[0] ? lastWorkoutFromCopy(finished[0].workout, finishing.get(finished[0].workout.id)!) : null,
    removedTemplateIds: templateRemovals(ops),
  };
}
