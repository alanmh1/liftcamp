import {
  coldStartSuggestion,
  effectiveLoad,
  firstCompletedPriorSession,
  normalizeSearch,
  oneRepMaxNumeric,
  priorSetForPosition,
  storedWeightOf,
  toUserUnit,
  weightToWrite,
  type PriorExerciseRow,
  type PriorSet,
  type StoredWeight,
  type WeightUnit,
} from '@liftcamp/shared';
import { randomUUID } from 'expo-crypto';

import { supabase } from '../../lib/supabase';

/**
 * Every write the active workout screen performs goes through this module.
 *
 * Today each function talks to Supabase directly. The Phase 2 offline rules
 * call for a local write-first queue, and this is the seam it slots behind:
 * screens never import `supabase`, so swapping the bodies here for
 * enqueue-then-sync does not touch a single screen.
 *
 * Two rules make that swap safe, and they are honoured now rather than later:
 * every insert carries a client-generated UUID, and every insert is idempotent
 * on that id, so a replayed write is a no-op instead of a duplicate row.
 *
 * Units: every set read passes through `toUserUnit`, so a set in memory is in
 * the user's current unit whatever unit it was logged in. Every write that
 * carries `weight_value` also carries `weight_unit`. Callers pass the unit
 * from `useWeightUnit` rather than this module reading the profile again.
 *
 * A converted set also keeps `stored`, its weight exactly as the row holds
 * it. A weight carried into a new set without being edited is written from
 * `stored`, so it ties its source rather than beating it by the rounding.
 */

export type WorkoutSet = {
  id: string;
  position: number;
  /** In the user's current unit. */
  weight_value: number | null;
  reps: number | null;
  completed: boolean;
  note: string | null;
  /**
   * The weight as stored, when it is in the other unit. Null once the user
   * edits the weight, and for a set already in the current unit.
   */
  stored: StoredWeight | null;
};

/** A prior-session set, converted, with the weight it was logged as. */
export type SeedSource = PriorSet & { stored: StoredWeight | null };

export type ExerciseInfo = {
  id: string;
  name: string;
  weight_type: string | null;
  is_unilateral: boolean;
  mechanic: string | null;
  level: string | null;
  equipment: string | null;
  primary_muscle: string | null;
  /** Pipe-delimited canonical muscles; canonMuscleList() splits it. */
  secondary_muscles: string | null;
  description: string | null;
  /**
   * Media, in the order the UI falls back through them. The GIFs are the
   * licensed ExerciseDB set: in-app, behind auth, alongside the exercise
   * data only. 548 of 898 rows have them; 882 have a photo; 16 have neither.
   */
  gif_url_sm: string | null;
  gif_url: string | null;
  image_url: string | null;
};

export type WorkoutExercise = {
  /** The `workout_exercises` row id, not the exercise id. */
  id: string;
  position: number;
  exercise: ExerciseInfo;
  sets: WorkoutSet[];
  /** The user's previous session of this exercise, for the PREVIOUS column. */
  prior: SeedSource[];
  /** Best estimated 1RM before this workout. Null when never logged. */
  priorBestOrm: number | null;
  /**
   * The routine's target for this exercise: a set count and free-text reps
   * ("8-10", "30s", "8 each"). Shown as a meta line under the name, never
   * logged. Null for exercises the workout did not get from a routine.
   */
  target: SetTarget | null;
};

export type ActiveWorkout = {
  id: string;
  name: string | null;
  createdAt: string;
  finishedAt: string | null;
  exercises: WorkoutExercise[];
  /** Fetched once here so the screen does not fetch it again. */
  bodyweight: number | null;
};

export const EXERCISE_FIELDS =
  'id, name, weight_type, is_unilateral, mechanic, level, equipment, primary_muscle, secondary_muscles, description, gif_url_sm, gif_url, image_url';

/** One exercise by id, for an info sheet opened with only the id in hand. */
export async function getExercise(id: string): Promise<ExerciseInfo | null> {
  const { data } = await supabase.from('exercises').select(EXERCISE_FIELDS).eq('id', id).maybeSingle();
  return (data as ExerciseInfo | null) ?? null;
}

/** Idempotent insert. A replayed write with the same id changes nothing. */
function insertOnce<T extends { id: string }>(table: 'workouts' | 'workout_exercises' | 'sets', row: T) {
  return supabase.from(table).upsert(row as never, { onConflict: 'id', ignoreDuplicates: true });
}

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * How many recent workouts to consider before giving up. A workout where the
 * exercise was added but never logged is skipped, so more than one may be
 * needed to find real history.
 */
const LOOKBACK_WORKOUTS = 10;

/**
 * The user's most recent other session of an exercise. Ported from the web
 * query in apps/web/src/lib/prior-session.ts; the normalization itself lives
 * in @liftcamp/shared so both platforms renumber identically.
 *
 * Only completed sets count as history.
 */
export async function getPriorSets(
  userId: string,
  exerciseId: string,
  unit: WeightUnit,
  excludeWorkoutExerciseId?: string | null,
): Promise<SeedSource[]> {
  let q = supabase
    .from('workouts')
    .select(
      'id, workout_date, created_at, workout_exercises!inner(id, created_at, exercise_id, sets(position, weight, weight_value, weight_unit, reps, completed))',
    )
    .eq('user_id', userId)
    .eq('workout_exercises.exercise_id', exerciseId);

  if (excludeWorkoutExerciseId) {
    q = q.neq('workout_exercises.id', excludeWorkoutExerciseId);
  }

  const { data, error } = await q
    .order('workout_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(LOOKBACK_WORKOUTS);

  if (error || !data) return [];

  const workouts = data.map((w) => (w.workout_exercises ?? []) as unknown as PriorExerciseRow[]);
  // Converted after normalizing, which has already resolved any legacy text
  // weight to a number, so `stored` is exact for those too.
  return firstCompletedPriorSession(workouts).map((p) => ({
    ...toUserUnit(p, unit),
    stored: storedWeightOf(p.weight_value, p.weight_unit, unit),
  }));
}

/**
 * The user's most recently logged distinct exercises, newest first. Same
 * query as the web picker's defaults: the last 200 workout_exercises rows,
 * deduplicated in order, capped at `limit`.
 */
export async function getRecentExercises(userId: string, limit = 8): Promise<ExerciseInfo[]> {
  const { data: recent } = await supabase
    .from('workout_exercises')
    .select('exercise_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);

  const ids: string[] = [];
  for (const r of recent ?? []) {
    if (!ids.includes(r.exercise_id)) ids.push(r.exercise_id);
    if (ids.length === limit) break;
  }
  if (ids.length === 0) return [];

  const { data } = await supabase.from('exercises').select(EXERCISE_FIELDS).in('id', ids);
  const byId = new Map(((data ?? []) as ExerciseInfo[]).map((e) => [e.id, e]));
  return ids.map((id) => byId.get(id)).filter((e): e is ExerciseInfo => e != null);
}

/**
 * Set targets for a workout started from a routine, keyed by exercise id.
 * Read through `workouts.template_id`, so a renamed workout or two routines
 * with the same name cannot confuse it. Empty for workouts with no routine.
 */
export async function getTemplateTargets(templateId: string | null): Promise<Map<string, SetTarget>> {
  if (!templateId) return new Map();
  const { data } = await supabase
    .from('template_exercises')
    .select('exercise_id, target_sets, target_reps')
    .eq('template_id', templateId);
  const out = new Map<string, SetTarget>();
  for (const row of data ?? []) {
    const target = cleanTarget({ sets: row.target_sets, reps: row.target_reps });
    if (target) out.set(row.exercise_id, target);
  }
  return out;
}

/** Trims the reps and drops a target with nothing in it. */
function cleanTarget(target: SetTarget | null | undefined): SetTarget | null {
  if (!target) return null;
  const sets = target.sets != null && target.sets > 0 ? target.sets : null;
  const reps = target.reps?.trim() || null;
  return sets == null && reps == null ? null : { sets, reps };
}

/** The user's bodyweight, needed to score bodyweight exercises. */
export async function getBodyweight(userId: string): Promise<number | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('bodyweight')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.bodyweight ?? null;
}

/**
 * Best estimated 1RM across every completed set of this exercise before now.
 * A set in the current workout beating this is a PR.
 */
export async function getPriorBestOrm(
  userId: string,
  exerciseId: string,
  excludeWorkoutId: string,
  exercise: { weight_type?: string | null } | null,
  bodyweight: number | null,
  unit: WeightUnit,
): Promise<number | null> {
  const { data, error } = await supabase
    .from('workout_exercises')
    .select('workout_id, sets(weight, weight_value, weight_unit, reps, completed)')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .neq('workout_id', excludeWorkoutId)
    .limit(500);

  if (error || !data) return null;

  let best: number | null = null;
  for (const we of data) {
    for (const s of we.sets ?? []) {
      if (!s.completed) continue;
      const load = effectiveLoad(toUserUnit(s, unit), exercise, bodyweight);
      const orm = oneRepMaxNumeric(load, s.reps);
      if (orm != null && (best == null || orm > best)) best = orm;
    }
  }
  return best;
}

/** Loads the whole workout tree the screen renders. */
export async function loadWorkout(
  userId: string,
  workoutId: string,
  unit: WeightUnit,
): Promise<ActiveWorkout | null> {
  const { data, error } = await supabase
    .from('workouts')
    .select(
      `id, name, created_at, finished_at, template_id,
       workout_exercises(id, position, exercise_id,
         exercises(${EXERCISE_FIELDS}),
         sets(id, position, weight_value, weight_unit, reps, completed, note))`,
    )
    .eq('id', workoutId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;

  const [bodyweight, targets] = await Promise.all([
    getBodyweight(userId),
    getTemplateTargets(data.template_id),
  ]);

  const wes = (data.workout_exercises ?? []) as unknown as {
    id: string;
    position: number;
    exercise_id: string;
    exercises: ExerciseInfo | null;
    sets: (WorkoutSet & { weight_unit: string })[] | null;
  }[];

  // Every exercise's history lookup is independent, so they all go at once.
  // Mapping over the sorted list keeps the card order without a sort after.
  const ordered = [...wes]
    .sort((a, b) => a.position - b.position)
    .filter((we) => we.exercises != null);

  const exercises: WorkoutExercise[] = await Promise.all(
    ordered.map(async (we) => {
      const [prior, priorBestOrm] = await Promise.all([
        getPriorSets(userId, we.exercise_id, unit, we.id),
        getPriorBestOrm(userId, we.exercise_id, workoutId, we.exercises, bodyweight, unit),
      ]);
      return {
        id: we.id,
        position: we.position,
        exercise: we.exercises!,
        // Converted, then the stored unit dropped: in memory every set is
        // in the current unit, and a later write says so itself.
        sets: (we.sets ?? [])
          .map((row): WorkoutSet => {
            const s = toUserUnit(row, unit);
            return {
              id: s.id,
              position: s.position,
              weight_value: s.weight_value,
              reps: s.reps,
              completed: s.completed,
              note: s.note,
              stored: storedWeightOf(row.weight_value, row.weight_unit, unit),
            };
          })
          .sort((a, b) => a.position - b.position),
        prior,
        priorBestOrm,
        target: targets.get(we.exercise_id) ?? null,
      };
    }),
  );

  return {
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
    finishedAt: data.finished_at,
    exercises,
    bodyweight,
  };
}

/**
 * PostgREST caps a single response (Supabase's `max-rows`), so the full library
 * is fetched in pages. 500 keeps each request well under any common cap.
 */
const EXERCISE_PAGE = 500;

/** Compounds first, then isolation, then anything unclassified. */
function mechanicRank(m: string | null): number {
  return m === 'compound' ? 0 : m === 'isolation' ? 1 : 2;
}

/**
 * The unfiltered library, cached for the session. It is 898 rows that cannot
 * change while the app is running, and the picker re-runs its query every time
 * it opens.
 */
let allExercisesCache: ExerciseInfo[] | null = null;

/**
 * Exercise search for the picker.
 *
 * Returns every match, not a page of them. The previous version fetched 120
 * rows with no ORDER BY and sliced to 40, which capped an empty search at 40 of
 * 898 and, worse, made the compounds-first sort meaningless: it ordered
 * whatever arbitrary 120 rows Postgres happened to hand back rather than the
 * whole library.
 *
 * Ordering by name in the database is what makes paging safe. Without a stable
 * ORDER BY, two `.range()` calls can return overlapping or missing rows.
 * JavaScript's sort is stable, so ranking by mechanic afterwards preserves the
 * alphabetical order inside each rank.
 */
export async function searchExercises(term: string): Promise<ExerciseInfo[]> {
  const tokens = term
    .split(/\s+/)
    .map((raw) => normalizeSearch(raw))
    .filter(Boolean);

  if (tokens.length === 0 && allExercisesCache) return allExercisesCache;

  const rows: ExerciseInfo[] = [];
  for (let from = 0; ; from += EXERCISE_PAGE) {
    let q = supabase.from('exercises').select(EXERCISE_FIELDS).order('name', { ascending: true });

    // Every whitespace-separated token must appear somewhere in search_all
    // (normalized name plus curated aliases). Repeated .ilike calls are ANDed
    // by PostgREST, so "smith hip thrust" matches Smith Machine Hip Thrust even
    // though the words are not adjacent in the stored name.
    //
    // Tokens are normalized one at a time with the same transform that
    // generates search_all, which is why a partial word works: "incline dumb"
    // becomes %incline% AND %dumb%, and both are substrings of
    // "inclinedumbbellpress". Passing the raw string instead would search for
    // "incline dumb" with its space intact, and search_all has no spaces.
    for (const token of tokens) q = q.ilike('search_all', `%${token}%`);

    const { data, error } = await q.range(from, from + EXERCISE_PAGE - 1);
    if (error) return [];
    if (!data || data.length === 0) break;
    rows.push(...(data as ExerciseInfo[]));
    if (data.length < EXERCISE_PAGE) break;
  }

  const sorted = rows.sort(
    (a, b) => mechanicRank(a.mechanic) - mechanicRank(b.mechanic) || a.name.localeCompare(b.name),
  );

  if (tokens.length === 0) allExercisesCache = sorted;
  return sorted;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Creates an empty workout, optionally named, and returns its id. */
export async function createWorkout(
  userId: string,
  name?: string | null,
  templateId?: string | null,
): Promise<string | null> {
  const id = randomUUID();
  const { error } = await insertOnce('workouts', {
    id,
    user_id: userId,
    name: name?.trim() || null,
    workout_date: todayIso(),
    // Only a workout started from a routine carries this. Empty and
    // generated workouts leave it null, and loadWorkout reads targets from it.
    template_id: templateId ?? null,
  });
  if (error) return null;
  return id;
}

/** Creates an empty ad-hoc workout and returns its id. */
export function startAdHocWorkout(userId: string): Promise<string | null> {
  return createWorkout(userId);
}

/**
 * Inserts an exercise row and seeds its sets: position for position from the
 * prior session when there is one, otherwise the cold-start suggestion.
 *
 * This is everything a workout needs to be started. It reads only the prior
 * session; the PR baseline and bodyweight are display concerns, and the
 * screen fetches them itself in loadWorkout. The Home start path calls this
 * directly, so a six-exercise routine costs six parallel (insert → prior →
 * seed) chains and nothing else.
 */
/** What a routine asks for. `sets` drives the seeded count; `reps` is guidance. */
export type SetTarget = { sets: number | null; reps: string | null };

export async function seedExercise(
  userId: string,
  workoutId: string,
  exercise: ExerciseInfo,
  position: number,
  unit: WeightUnit,
  target?: SetTarget | null,
): Promise<{ id: string; sets: WorkoutSet[]; prior: SeedSource[]; target: SetTarget | null } | null> {
  const weId = randomUUID();
  const { error } = await insertOnce('workout_exercises', {
    id: weId,
    workout_id: workoutId,
    exercise_id: exercise.id,
    user_id: userId,
    position,
  });
  if (error) return null;

  const prior = await getPriorSets(userId, exercise.id, unit, weId);

  // Row count: the routine's target_sets when there is one, else the prior
  // session's count, else the cold-start suggestion. Values: position N takes
  // prior N (repeating the last prior set past its end), so the weight and
  // reps a user actually did still win. With no prior, a routine's rows are
  // left empty so the reps box shows the target as a placeholder; the target
  // is guidance and is never parsed into a number to log. Without a routine,
  // the cold-start reps are prefilled as before.
  let count: number;
  if (target?.sets != null && target.sets > 0) count = target.sets;
  else if (prior.length > 0) count = prior.length;
  else count = coldStartSuggestion(exercise).sets;

  const coldReps = prior.length === 0 && target == null ? coldStartSuggestion(exercise).reps : null;

  const rows: WorkoutSet[] = Array.from({ length: count }, (_, idx) => {
    const src = priorSetForPosition(prior, idx);
    return {
      id: randomUUID(),
      position: idx,
      // A prior set logged in the other unit shows converted and is
      // written as it was logged, until the user edits it.
      weight_value: src?.weight_value ?? null,
      reps: src?.reps ?? coldReps,
      completed: false,
      note: null,
      stored: src?.stored ?? null,
    };
  });

  await supabase.from('sets').upsert(
    rows.map((r) => ({
      id: r.id,
      workout_exercise_id: weId,
      user_id: userId,
      position: r.position,
      ...weightToWrite(r.weight_value, r.stored, unit),
      reps: r.reps,
    })),
    { onConflict: 'id', ignoreDuplicates: true },
  );

  return { id: weId, sets: rows, prior, target: cleanTarget(target) };
}

/**
 * seedExercise plus the PR baseline, for the workout screen, which renders
 * the new card immediately and needs everything the other cards have. The
 * baseline lookup is independent of seeding, so the two run together.
 */
export async function addExercise(
  userId: string,
  workoutId: string,
  exercise: ExerciseInfo,
  position: number,
  bodyweight: number | null,
  unit: WeightUnit,
): Promise<WorkoutExercise | null> {
  const [seeded, priorBestOrm] = await Promise.all([
    seedExercise(userId, workoutId, exercise, position, unit),
    getPriorBestOrm(userId, exercise.id, workoutId, exercise, bodyweight, unit),
  ]);
  if (!seeded) return null;
  return {
    id: seeded.id,
    position,
    exercise,
    sets: seeded.sets,
    prior: seeded.prior,
    priorBestOrm,
    target: seeded.target,
  };
}

/**
 * Appends a set. Past the end of the prior session a new set copies the
 * previous set in this workout, which is what the spec's prefill rule asks for.
 */
export async function addSet(
  userId: string,
  workoutExerciseId: string,
  position: number,
  seed: { weight_value: number | null; reps: number | null; stored: StoredWeight | null },
  unit: WeightUnit,
): Promise<WorkoutSet> {
  const row: WorkoutSet = {
    id: randomUUID(),
    position,
    weight_value: seed.weight_value,
    reps: seed.reps,
    completed: false,
    note: null,
    stored: seed.stored,
  };
  await insertOnce('sets', {
    id: row.id,
    workout_exercise_id: workoutExerciseId,
    user_id: userId,
    position,
    ...weightToWrite(row.weight_value, row.stored, unit),
    reps: row.reps,
  });
  return row;
}

/**
 * A patch that sets `weight_value` is a user edit and says which unit it is
 * in. One that only touches reps, completion, the note or position leaves
 * the stored weight and unit as they were, so ticking a set logged in lb
 * does not relabel its weight as kg. Anything else on the patch, such as
 * the in-memory `stored`, is not a column and is not sent.
 */
export async function updateSet(
  setId: string,
  patch: Partial<WorkoutSet>,
  unit: WeightUnit,
): Promise<void> {
  const row = {
    ...(patch.weight_value !== undefined ? { weight_value: patch.weight_value, weight_unit: unit } : {}),
    ...(patch.reps !== undefined ? { reps: patch.reps } : {}),
    ...(patch.completed !== undefined ? { completed: patch.completed } : {}),
    ...(patch.note !== undefined ? { note: patch.note } : {}),
    ...(patch.position !== undefined ? { position: patch.position } : {}),
  };
  if (Object.keys(row).length === 0) return;
  await supabase.from('sets').update(row).eq('id', setId);
}

export async function completeSet(setId: string, completed: boolean): Promise<void> {
  await supabase.from('sets').update({ completed }).eq('id', setId);
}

export async function deleteSet(setId: string): Promise<void> {
  await supabase.from('sets').delete().eq('id', setId);
}

/**
 * Puts a deleted set back, id and all. The undo toast calls this, and the
 * idempotent insert means a double undo is harmless.
 */
export async function restoreSet(
  userId: string,
  workoutExerciseId: string,
  set: WorkoutSet,
  unit: WeightUnit,
): Promise<void> {
  await insertOnce('sets', {
    id: set.id,
    workout_exercise_id: workoutExerciseId,
    user_id: userId,
    position: set.position,
    ...weightToWrite(set.weight_value, set.stored, unit),
    reps: set.reps,
    completed: set.completed,
    note: set.note,
  });
}

export async function removeExercise(workoutExerciseId: string): Promise<void> {
  // sets cascade on workout_exercise_id.
  await supabase.from('workout_exercises').delete().eq('id', workoutExerciseId);
}

/**
 * Writes the new order of a workout's exercises in one request.
 *
 * An upsert on `id` with every row present is a single INSERT ... ON CONFLICT
 * DO UPDATE, so the whole reorder is one statement rather than one UPDATE per
 * exercise. Each row carries every NOT NULL column without a default
 * (`workout_id`, `exercise_id`, `user_id`), because PostgREST validates the
 * INSERT shape even when every row already exists. There is no unique index
 * on (workout_id, position), so no transient collision mid-statement, and
 * RLS passes on `user_id` for both the insert and the update path.
 *
 * Only rows whose position actually changed are sent.
 */
export async function reorderExercises(
  userId: string,
  workoutId: string,
  ordered: { id: string; exercise: { id: string }; position: number }[],
): Promise<void> {
  const changed = ordered
    .map((we, i) => ({ we, position: i }))
    .filter(({ we, position }) => we.position !== position)
    .map(({ we, position }) => ({
      id: we.id,
      workout_id: workoutId,
      exercise_id: we.exercise.id,
      user_id: userId,
      position,
    }));
  if (changed.length === 0) return;
  await supabase.from('workout_exercises').upsert(changed, { onConflict: 'id' });
}

export async function reorderSets(ordered: { id: string }[]): Promise<void> {
  await Promise.all(
    ordered.map((s, i) => supabase.from('sets').update({ position: i }).eq('id', s.id)),
  );
}

/** Swaps which exercise a card points at, keeping its position. */
export async function replaceExercise(
  workoutExerciseId: string,
  exerciseId: string,
): Promise<void> {
  await supabase
    .from('workout_exercises')
    .update({ exercise_id: exerciseId })
    .eq('id', workoutExerciseId);
}

export async function setWorkoutName(workoutId: string, name: string): Promise<void> {
  await supabase.from('workouts').update({ name }).eq('id', workoutId);
}

export async function finishWorkout(workoutId: string): Promise<void> {
  await supabase
    .from('workouts')
    .update({ finished_at: new Date().toISOString() })
    .eq('id', workoutId);
}

/** Cancel discards the whole workout. Sets and exercises cascade. */
export async function discardWorkout(workoutId: string): Promise<void> {
  await supabase.from('workouts').delete().eq('id', workoutId);
}
