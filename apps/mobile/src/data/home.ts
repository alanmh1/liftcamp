import {
  asWeightUnit,
  convertWeight,
  fallbackUsername,
  isValidUsername,
  setVolume,
  byVariationOrder,
  usernameFromEmail,
  isEquipmentAccess,
  isTrainingLevel,
  matchPrograms,
  roundForDisplay,
  toUserUnit,
  type EquipmentAccess,
  type OnboardingCheck,
  type ProgramGroup,
  type ProgramMatch,
  type TemplateRow,
  type TrainingLevel,
  type WeightUnit,
} from '@liftcamp/shared';
import { getRandomBytes, randomUUID } from 'expo-crypto';

import { invalidateScanCache } from '@/data/scan-cache';
import {
  createWorkout,
  EXERCISE_FIELDS,
  getBodyweight,
  seedExercise,
  type ExerciseInfo,
  type SetTarget,
} from '@/data/workouts';
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
 * starts without.
 */
export async function getWeightUnit(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('weight_unit')
    .eq('user_id', userId)
    .maybeSingle();
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
 * is converted in the same statement, rounded to 0.1. Logged sets are never
 * touched: each carries the unit it was typed in and converts on read.
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
  const { error } = await supabase
    .from('user_profiles')
    .upsert(
      { user_id: userId, weight_unit: unit, ...(next != null ? { bodyweight: next } : {}) },
      { onConflict: 'user_id' },
    );
  if (error) return false;
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

/**
 * The account's username, minting one if it has none. There is no single
 * place that creates `user_profiles` rows (onboarding, Profile and the web
 * all upsert), so the two screens that print a username call this instead
 * of every writer setting one.
 *
 * Same rules as the backfill in docs/username.sql: the email's local part,
 * lowercased, stripped and cut to 20, else `lifter` plus digits. A taken
 * name is found by trying it rather than checking first, since a check
 * races another client; the fallback gets fresh digits each time.
 */
export async function ensureUsername(userId: string, email: string | null | undefined): Promise<string | null> {
  const existing = await getUsername(userId);
  if (existing) return existing;

  const candidates = [usernameFromEmail(email), fallbackUsername(), fallbackUsername(), fallbackUsername()];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const { error } = await supabase
      .from('user_profiles')
      .upsert({ user_id: userId, username: candidate }, { onConflict: 'user_id' });
    if (!error) return candidate;
    if (error.code !== UNIQUE_VIOLATION) return null;
  }
  return null;
}

export type SetUsernameResult = { ok: true } | { ok: false; reason: 'taken' | 'invalid' | 'failed' };

/** The editor's save. The shape is checked here too, so the constraint is never the first to see a bad value. */
export async function setUsername(userId: string, username: string): Promise<SetUsernameResult> {
  if (!isValidUsername(username)) return { ok: false, reason: 'invalid' };
  const { error } = await supabase
    .from('user_profiles')
    .upsert({ user_id: userId, username }, { onConflict: 'user_id' });
  if (!error) return { ok: true };
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
  const { data } = await supabase
    .from('workouts')
    .select('workout_date')
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .gte('workout_date', localDateIso(startOfWeek()))
    .lte('workout_date', localDateIso(endOfWeek()));
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
  return {
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
    exerciseCount: (data.workout_exercises ?? []).length,
  };
}

export async function getFinishedWorkoutCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('workouts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('finished_at', 'is', null);
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
  /** Exercise ids in position order, for Repeat. */
  exerciseIds: string[];
};

export async function getLastWorkout(userId: string, unit: WeightUnit): Promise<LastWorkout | null> {
  const { data } = await supabase
    .from('workouts')
    .select(
      `id, name, workout_date, created_at, finished_at,
       workout_exercises(exercise_id, position,
         exercises(id, equipment, weight_type, is_unilateral),
         sets(weight, weight_value, weight_unit, reps, completed))`,
    )
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data || !data.finished_at) return null;

  const bodyweight = await getBodyweight(userId);
  const wes = (data.workout_exercises ?? []) as unknown as {
    exercise_id: string;
    position: number;
    exercises: {
      id: string;
      equipment: string | null;
      weight_type: string | null;
      is_unilateral: boolean | null;
    } | null;
    sets:
      | { weight: string | null; weight_value: number | null; weight_unit: string; reps: number | null; completed: boolean }[]
      | null;
  }[];

  let volume = 0;
  for (const we of wes) {
    for (const s of we.sets ?? []) {
      if (!s.completed) continue;
      volume += setVolume(toUserUnit(s, unit), we.exercises, bodyweight);
    }
  }

  const ordered = [...wes].sort((a, b) => a.position - b.position);
  return {
    id: data.id,
    name: data.name,
    workoutDate: data.workout_date,
    createdAt: data.created_at,
    finishedAt: data.finished_at,
    exerciseCount: wes.length,
    volume,
    exerciseIds: ordered.map((we) => we.exercise_id),
  };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export type HomeTemplate = TemplateRow & {
  /** Most recent finished workout started from this template, or null. */
  lastDone: string | null;
};

// The joined exercise columns and created_at feed the routine card art:
// which illustration a routine gets depends on its exercises' equipment
// and muscles, and on the order the templates were created. The embed
// follows template_exercises_exercise_id_fkey, applied 16 Sep 2026.
const TEMPLATE_FIELDS =
  'id, name, is_system, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, level, days_per_week, equipment, created_at, template_exercises(exercise_id, position, target_sets, target_reps, exercises(equipment, primary_muscle))';

/** Surfaces a read error in development; production keeps its empty result. */
function warnRead(where: string, error: { message: string; code?: string } | null) {
  if (error && __DEV__) console.warn(`[home] ${where}: ${error.code ?? ''} ${error.message}`);
}

export async function getUserTemplates(userId: string): Promise<HomeTemplate[]> {
  const { data, error } = await supabase
    .from('templates')
    .select(TEMPLATE_FIELDS)
    .eq('user_id', userId)
    .eq('is_system', false)
    .order('created_at', { ascending: false });
  warnRead('user templates', error);
  const rows = (data ?? []) as unknown as TemplateRow[];
  if (rows.length === 0) return [];

  // "Last done" keys on workouts.template_id, set when a workout is seeded
  // from a routine. Uses the (user_id, template_id) index. A renamed routine
  // or a workout renamed after the fact no longer breaks the match.
  const { data: recent } = await supabase
    .from('workouts')
    .select('template_id, workout_date')
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .in('template_id', rows.map((r) => r.id))
    .order('workout_date', { ascending: false })
    .limit(200);
  const lastByTemplate = new Map<string, string>();
  for (const w of recent ?? []) {
    if (w.template_id && !lastByTemplate.has(w.template_id)) {
      lastByTemplate.set(w.template_id, w.workout_date);
    }
  }
  return rows.map((r) => ({ ...r, lastDone: lastByTemplate.get(r.id) ?? null }));
}

/**
 * Your routines, grouped for Home. Copies saved by "Use routine" carry
 * `program`, and every variation of one routine gathers under a heading
 * with that name; a routine with no program (an older copy, or one built
 * by hand) is a group of one with no heading. Groups keep the newest-first
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
  const groups: UserRoutineGroup[] = [];
  const byProgram = new Map<string, UserRoutineGroup>();
  for (const t of mine) {
    const program = t.program?.trim() || null;
    if (!program) {
      groups.push({ key: t.id, program: null, level: null, templates: [t] });
      continue;
    }
    let g = byProgram.get(program);
    if (!g) {
      g = { key: `program:${program}`, program, level: t.level ?? null, templates: [] };
      byProgram.set(program, g);
      groups.push(g);
    }
    g.templates.push(t);
  }
  for (const g of groups) {
    if (g.program) g.templates.sort(byVariationOrder);
  }
  return groups;
}

/** Every system routine, all 17 programs. Filtering is the caller's. */
/**
 * The system routines, cached for the session: they only change with a
 * release, never while the app runs. Home and the routines list share one
 * request. A failed read is not kept, so the next call tries again.
 */
let systemTemplates: Promise<TemplateRow[] | null> | null = null;

export function getSystemTemplates(): Promise<TemplateRow[]> {
  if (!systemTemplates) {
    const pending = fetchSystemTemplates();
    systemTemplates = pending;
    pending.then(
      (rows) => {
        if (rows === null && systemTemplates === pending) systemTemplates = null;
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
 * Creates a workout and seeds its exercises from the prior session. Every Home
 * entry point that starts a non-empty workout funnels through here.
 *
 * Only seedExercise, never addExercise: the PR baseline and bodyweight the
 * full add fetches are for a card that is about to render, and here nothing
 * renders until the workout screen loads everything itself.
 */
type SeedPlan = { exerciseId: string; target?: SetTarget | null };

async function startWithExercises(
  userId: string,
  name: string | null,
  plan: SeedPlan[],
  unit: WeightUnit,
  templateId: string | null = null,
): Promise<string | null> {
  const workoutId = await createWorkout(userId, name, templateId);
  if (!workoutId) return null;
  const byId = await exercisesByIds(plan.map((p) => p.exerciseId));

  // Positions are assigned up front from the plan order, after dropping any
  // id the catalog no longer has, so they stay contiguous. That is what lets
  // the inserts run in parallel: nothing about position depends on which
  // insert happens to finish first.
  const planned = plan
    .map((p) => ({ exercise: byId.get(p.exerciseId), target: p.target ?? null }))
    .filter((p): p is { exercise: ExerciseInfo; target: SetTarget | null } => p.exercise != null)
    .map((p, position) => ({ ...p, position }));

  await Promise.all(
    planned.map(({ exercise, position, target }) =>
      seedExercise(userId, workoutId, exercise, position, unit, target),
    ),
  );
  return workoutId;
}

/** Starts from a routine: rows per target_sets, and the workout records which routine. */
export function startFromTemplate(
  userId: string,
  template: TemplateRow,
  unit: WeightUnit,
): Promise<string | null> {
  const ordered = [...template.template_exercises].sort((a, b) => a.position - b.position);
  return startWithExercises(
    userId,
    template.name,
    ordered.map((te) => ({
      exerciseId: te.exercise_id,
      target: { sets: te.target_sets ?? null, reps: te.target_reps ?? null },
    })),
    unit,
    template.id,
  );
}

/**
 * A new workout with the same exercises in the same order. Home's Last
 * workout card and the history detail both pass what they have; both carry
 * a name and the exercise ids.
 */
export function repeatWorkout(
  userId: string,
  source: { name: string | null; exerciseIds: string[] },
  unit: WeightUnit,
): Promise<string | null> {
  return startWithExercises(
    userId,
    source.name?.trim() || 'Workout',
    source.exerciseIds.map((exerciseId) => ({ exerciseId })),
    unit,
  );
}

/**
 * Save a starter routine as one of the user's own. Returns the new id.
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
  const id = randomUUID();
  const { error } = await supabase.from('templates').upsert(
    {
      id,
      user_id: userId,
      name: template.name,
      is_system: false,
      ...(keepProgram
        ? {
            program: template.program ?? null,
            program_slug: template.program_slug ?? null,
            level: template.level ?? null,
            position: template.position ?? null,
          }
        : {}),
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) return null;
  const ordered = [...template.template_exercises].sort((a, b) => a.position - b.position);
  if (ordered.length > 0) {
    await supabase.from('template_exercises').upsert(
      ordered.map((te, i) => ({
        id: randomUUID(),
        template_id: id,
        exercise_id: te.exercise_id,
        user_id: userId,
        position: i,
        // The targets come too, so a workout started from the copy shows
        // them on its cards the way one started from the original does.
        target_sets: te.target_sets ?? null,
        target_reps: te.target_reps ?? null,
      })),
      { onConflict: 'id', ignoreDuplicates: true },
    );
  }
  return id;
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
