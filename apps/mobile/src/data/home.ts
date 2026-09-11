import {
  GENERATOR_CATEGORIES,
  generateWorkout,
  musclesForDay,
  setVolume,
  type CandidateExercise,
  type DayType,
  type TemplateRow,
} from '@liftcamp/shared';
import { getRandomBytes, randomUUID } from 'expo-crypto';

import { createWorkout, getBodyweight, seedExercise, type ExerciseInfo } from '@/data/workouts';
import { supabase } from '../../lib/supabase';

/**
 * Reads and writes for the Home tab and first launch. Same rules as
 * workouts.ts: screens never import `supabase`, every insert carries a client
 * UUID, and every insert is idempotent on it.
 */

export const DEFAULT_WEEKLY_TARGET = 3;
export const WEEKLY_TARGET_OPTIONS = [2, 3, 4, 5] as const;

const EXERCISE_FIELDS =
  'id, name, weight_type, is_unilateral, mechanic, level, equipment, primary_muscle';

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

// ---------------------------------------------------------------------------
// Week strip
// ---------------------------------------------------------------------------

/** Finished-workout dates from the start of this week, as YYYY-MM-DD. */
export async function getWeekWorkoutDates(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('workouts')
    .select('workout_date')
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .gte('workout_date', localDateIso(startOfWeek()));
  return (data ?? []).map((r) => r.workout_date as string);
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

export async function getLastWorkout(userId: string): Promise<LastWorkout | null> {
  const { data } = await supabase
    .from('workouts')
    .select(
      `id, name, workout_date, created_at, finished_at,
       workout_exercises(exercise_id, position,
         exercises(weight_type, is_unilateral),
         sets(weight, weight_value, reps, completed))`,
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
    exercises: { weight_type: string | null; is_unilateral: boolean | null } | null;
    sets: { weight: string | null; weight_value: number | null; reps: number | null; completed: boolean }[] | null;
  }[];

  let volume = 0;
  for (const we of wes) {
    for (const s of we.sets ?? []) {
      if (!s.completed) continue;
      volume += setVolume(s, we.exercises, bodyweight);
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
  /** Most recent finished workout with this template's name, or null. */
  lastDone: string | null;
};

const TEMPLATE_FIELDS =
  'id, name, is_system, program, program_blurb, program_order, hide_from_onboarding, template_exercises(exercise_id, position)';

export async function getUserTemplates(userId: string): Promise<HomeTemplate[]> {
  const { data } = await supabase
    .from('templates')
    .select(TEMPLATE_FIELDS)
    .eq('user_id', userId)
    .eq('is_system', false)
    .order('created_at', { ascending: false });
  const rows = (data ?? []) as unknown as TemplateRow[];
  if (rows.length === 0) return [];

  // "Last done" is by name. Workouts do not carry a template id, and the web
  // has the same limitation; this matches what it shows.
  const { data: recent } = await supabase
    .from('workouts')
    .select('name, workout_date')
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .in('name', rows.map((r) => r.name))
    .order('workout_date', { ascending: false })
    .limit(200);
  const lastByName = new Map<string, string>();
  for (const w of recent ?? []) {
    if (w.name && !lastByName.has(w.name)) lastByName.set(w.name, w.workout_date);
  }
  return rows.map((r) => ({ ...r, lastDone: lastByName.get(r.name) ?? null }));
}

/** System routines minus those flagged off onboarding. */
export async function getStarterTemplates(): Promise<TemplateRow[]> {
  const { data } = await supabase
    .from('templates')
    .select(TEMPLATE_FIELDS)
    .eq('is_system', true)
    .order('program_order', { ascending: true })
    .order('name', { ascending: true });
  return ((data ?? []) as unknown as TemplateRow[]).filter((t) => !t.hide_from_onboarding);
}

async function exercisesByIds(ids: string[]): Promise<Map<string, ExerciseInfo>> {
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
async function startWithExercises(
  userId: string,
  name: string | null,
  exerciseIds: string[],
): Promise<string | null> {
  const workoutId = await createWorkout(userId, name);
  if (!workoutId) return null;
  const byId = await exercisesByIds(exerciseIds);

  // Positions are assigned up front from the template order, after dropping
  // any id the catalog no longer has, so they stay contiguous. That is what
  // lets the inserts run in parallel: nothing about position depends on
  // which insert happens to finish first.
  const planned = exerciseIds
    .map((id) => byId.get(id))
    .filter((e): e is ExerciseInfo => e != null)
    .map((exercise, position) => ({ exercise, position }));

  await Promise.all(
    planned.map(({ exercise, position }) => seedExercise(userId, workoutId, exercise, position)),
  );
  return workoutId;
}

export function startFromTemplate(userId: string, template: TemplateRow): Promise<string | null> {
  const ordered = [...template.template_exercises].sort((a, b) => a.position - b.position);
  return startWithExercises(userId, template.name, ordered.map((te) => te.exercise_id));
}

export function repeatWorkout(userId: string, last: LastWorkout): Promise<string | null> {
  return startWithExercises(userId, last.name?.trim() || 'Workout', last.exerciseIds);
}

/** Save a starter routine as one of the user's own. Returns the new id. */
export async function saveTemplateCopy(userId: string, template: TemplateRow): Promise<string | null> {
  const id = randomUUID();
  const { error } = await supabase
    .from('templates')
    .upsert({ id, user_id: userId, name: template.name, is_system: false }, { onConflict: 'id', ignoreDuplicates: true });
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
      })),
      { onConflict: 'id', ignoreDuplicates: true },
    );
  }
  return id;
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

// ---------------------------------------------------------------------------
// Quick start and generator
// ---------------------------------------------------------------------------

/** The same three fixed lifts as the web QuickStart, matched on search_text. */
const QUICK_LIFTS = ['benchpress', 'barbellsquat', 'barbellrow', 'deadlift'];

export async function getQuickStartExercises(): Promise<ExerciseInfo[]> {
  const { data } = await supabase
    .from('exercises')
    .select(`${EXERCISE_FIELDS}, search_text`)
    .or(QUICK_LIFTS.map((l) => `search_text.ilike.*${l}*`).join(','))
    .limit(200);
  const rows = (data ?? []) as (ExerciseInfo & { search_text: string | null })[];
  const found: ExerciseInfo[] = [];
  for (const token of QUICK_LIFTS) {
    const matches = rows
      .filter((r) => (r.search_text ?? '').includes(token))
      .filter((r) => !found.some((f) => f.id === r.id))
      // Shortest name wins: the plainest variant over a qualified one.
      .sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name));
    if (matches[0]) found.push(matches[0]);
  }
  return found.slice(0, 3);
}

export function startQuickWorkout(userId: string, exercise: ExerciseInfo): Promise<string | null> {
  return startWithExercises(userId, 'First Workout', [exercise.id]);
}

export async function startGeneratedWorkout(userId: string, day: DayType): Promise<string | null> {
  const { data: pool } = await supabase
    .from('exercises')
    .select('id, name, primary_muscle, mechanic, equipment, level')
    .in('primary_muscle', musclesForDay(day))
    .in('category', [...GENERATOR_CATEGORIES])
    .limit(500);
  if (!pool || pool.length === 0) return null;

  const { data: history } = await supabase
    .from('workout_exercises')
    .select('exercise_id')
    .eq('user_id', userId)
    .limit(2000);
  const trainedIds = new Set((history ?? []).map((h) => h.exercise_id));

  const picks = generateWorkout(day, pool as CandidateExercise[], { trainedIds });
  if (picks.length === 0) return null;

  const label = day === 'full' ? 'Full body' : day[0].toUpperCase() + day.slice(1);
  return startWithExercises(userId, `${label} Workout`, picks.map((p) => p.id));
}
