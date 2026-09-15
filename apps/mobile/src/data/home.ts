import {
  GENERATOR_CATEGORIES,
  generateWorkout,
  musclesForDay,
  setVolume,
  byVariationOrder,
  isEquipmentAccess,
  isTrainingLevel,
  matchPrograms,
  type CandidateExercise,
  type DayType,
  type EquipmentAccess,
  type ProgramGroup,
  type ProgramMatch,
  type TemplateRow,
  type TrainingLevel,
} from '@liftcamp/shared';
import { getRandomBytes, randomUUID } from 'expo-crypto';

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

/**
 * The two onboarding answers that pick programs. Both null for every user
 * who onboarded before they were asked, and for anyone who skipped the page.
 */
export type TrainingPrefs = { level: TrainingLevel | null; equipment: EquipmentAccess | null };

export async function getTrainingPrefs(userId: string): Promise<TrainingPrefs> {
  const { data } = await supabase
    .from('user_profiles')
    .select('training_level, equipment_access')
    .eq('user_id', userId)
    .maybeSingle();
  return {
    level: isTrainingLevel(data?.training_level) ? data.training_level : null,
    equipment: isEquipmentAccess(data?.equipment_access) ? data.equipment_access : null,
  };
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
  /** Most recent finished workout started from this template, or null. */
  lastDone: string | null;
};

const TEMPLATE_FIELDS =
  'id, name, is_system, program, program_slug, program_blurb, program_order, position, hide_from_onboarding, level, days_per_week, equipment, template_exercises(exercise_id, position, target_sets, target_reps)';

export async function getUserTemplates(userId: string): Promise<HomeTemplate[]> {
  const { data } = await supabase
    .from('templates')
    .select(TEMPLATE_FIELDS)
    .eq('user_id', userId)
    .eq('is_system', false)
    .order('created_at', { ascending: false });
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
export async function getSystemTemplates(): Promise<TemplateRow[]> {
  const { data } = await supabase
    .from('templates')
    .select(TEMPLATE_FIELDS)
    .eq('is_system', true)
    .order('program_order', { ascending: true })
    .order('position', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });
  return (data ?? []) as unknown as TemplateRow[];
}

/**
 * The starter programs a user should see, from the system rows and their
 * answers. With a level, the matcher decides and `hide_from_onboarding` is
 * ignored. With no level (every user from before the question existed) the
 * list is what it was: everything not flagged off onboarding, unmatched.
 */
export function starterPrograms(rows: TemplateRow[], prefs: TrainingPrefs): ProgramMatch & { matched: boolean } {
  if (!prefs.level) {
    return { ...matchPrograms(rows.filter((t) => !t.hide_from_onboarding), null, null), matched: false };
  }
  return { ...matchPrograms(rows, prefs.level, prefs.equipment), matched: true };
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
      seedExercise(userId, workoutId, exercise, position, target),
    ),
  );
  return workoutId;
}

/** Starts from a routine: rows per target_sets, and the workout records which routine. */
export function startFromTemplate(userId: string, template: TemplateRow): Promise<string | null> {
  const ordered = [...template.template_exercises].sort((a, b) => a.position - b.position);
  return startWithExercises(
    userId,
    template.name,
    ordered.map((te) => ({
      exerciseId: te.exercise_id,
      target: { sets: te.target_sets ?? null, reps: te.target_reps ?? null },
    })),
    template.id,
  );
}

export function repeatWorkout(userId: string, last: LastWorkout): Promise<string | null> {
  return startWithExercises(
    userId,
    last.name?.trim() || 'Workout',
    last.exerciseIds.map((exerciseId) => ({ exerciseId })),
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

/** Every routine the user owns. Dev-only, behind Profile's Reset onboarding. */
export async function deleteUserTemplates(userId: string): Promise<void> {
  await supabase.from('templates').delete().eq('user_id', userId).eq('is_system', false);
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
  return startWithExercises(userId, 'First Workout', [{ exerciseId: exercise.id }]);
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
  return startWithExercises(userId, `${label} Workout`, picks.map((p) => ({ exerciseId: p.id })));
}
