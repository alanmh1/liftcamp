import {
  coldStartSuggestion,
  effectiveLoad,
  firstCompletedPriorSession,
  normalizeSearch,
  oneRepMaxNumeric,
  priorSetForPosition,
  type PriorExerciseRow,
  type PriorSet,
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
 */

export type WorkoutSet = {
  id: string;
  position: number;
  weight_value: number | null;
  reps: number | null;
  completed: boolean;
  note: string | null;
};

export type ExerciseInfo = {
  id: string;
  name: string;
  weight_type: string | null;
  is_unilateral: boolean;
  mechanic: string | null;
  level: string | null;
  equipment: string | null;
  primary_muscle: string | null;
};

export type WorkoutExercise = {
  /** The `workout_exercises` row id, not the exercise id. */
  id: string;
  position: number;
  exercise: ExerciseInfo;
  sets: WorkoutSet[];
  /** The user's previous session of this exercise, for the PREVIOUS column. */
  prior: PriorSet[];
  /** Best estimated 1RM before this workout. Null when never logged. */
  priorBestOrm: number | null;
};

export type ActiveWorkout = {
  id: string;
  name: string | null;
  createdAt: string;
  finishedAt: string | null;
  exercises: WorkoutExercise[];
};

const EXERCISE_FIELDS =
  'id, name, weight_type, is_unilateral, mechanic, level, equipment, primary_muscle';

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
  excludeWorkoutExerciseId?: string | null,
): Promise<PriorSet[]> {
  let q = supabase
    .from('workouts')
    .select(
      'id, workout_date, created_at, workout_exercises!inner(id, created_at, exercise_id, sets(position, weight, weight_value, reps, completed))',
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

  const workouts = data.map(
    (w) => (w.workout_exercises ?? []) as unknown as PriorExerciseRow[],
  );
  return firstCompletedPriorSession(workouts);
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
): Promise<number | null> {
  const { data, error } = await supabase
    .from('workout_exercises')
    .select('workout_id, sets(weight, weight_value, reps, completed)')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .neq('workout_id', excludeWorkoutId)
    .limit(500);

  if (error || !data) return null;

  let best: number | null = null;
  for (const we of data) {
    for (const s of we.sets ?? []) {
      if (!s.completed) continue;
      const load = effectiveLoad(s, exercise, bodyweight);
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
): Promise<ActiveWorkout | null> {
  const { data, error } = await supabase
    .from('workouts')
    .select(
      `id, name, created_at, finished_at,
       workout_exercises(id, position, exercise_id,
         exercises(${EXERCISE_FIELDS}),
         sets(id, position, weight_value, reps, completed, note))`,
    )
    .eq('id', workoutId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;

  const bodyweight = await getBodyweight(userId);

  const wes = (data.workout_exercises ?? []) as unknown as {
    id: string;
    position: number;
    exercise_id: string;
    exercises: ExerciseInfo | null;
    sets: WorkoutSet[] | null;
  }[];

  const exercises: WorkoutExercise[] = [];
  for (const we of [...wes].sort((a, b) => a.position - b.position)) {
    if (!we.exercises) continue;
    const [prior, priorBestOrm] = await Promise.all([
      getPriorSets(userId, we.exercise_id, we.id),
      getPriorBestOrm(userId, we.exercise_id, workoutId, we.exercises, bodyweight),
    ]);
    exercises.push({
      id: we.id,
      position: we.position,
      exercise: we.exercises,
      sets: [...(we.sets ?? [])].sort((a, b) => a.position - b.position),
      prior,
      priorBestOrm,
    });
  }

  return {
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
    finishedAt: data.finished_at,
    exercises,
  };
}

/** Exercise search for the picker. Compounds first, then isolation. */
export async function searchExercises(term: string, limit = 40): Promise<ExerciseInfo[]> {
  let q = supabase.from('exercises').select(EXERCISE_FIELDS);

  // Every whitespace-separated token must appear somewhere in search_all
  // (normalized name plus curated aliases). Repeated .ilike calls are ANDed by
  // PostgREST, so "smith hip thrust" matches Smith Machine Hip Thrust even
  // though the words are not adjacent in the stored name.
  //
  // Tokens are normalized one at a time with the same transform that generates
  // search_all, which is why a partial word works: "incline dumb" becomes
  // %incline% AND %dumb%, and both are substrings of "inclinedumbbellpress".
  // Passing the raw string instead would search for "incline dumb" with its
  // space intact, and search_all has no spaces in it.
  for (const raw of term.split(/\s+/)) {
    const token = normalizeSearch(raw);
    if (token) q = q.ilike('search_all', `%${token}%`);
  }

  const { data, error } = await q.limit(limit * 3);
  if (error || !data) return [];

  // Compounds first. Alphabetical defaults dump beginners into yoga.
  const rank = (m: string | null) => (m === 'compound' ? 0 : m === 'isolation' ? 1 : 2);
  return (data as ExerciseInfo[])
    .sort((a, b) => rank(a.mechanic) - rank(b.mechanic) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Creates an empty ad-hoc workout and returns its id. */
export async function startAdHocWorkout(userId: string): Promise<string | null> {
  const id = randomUUID();
  const { error } = await insertOnce('workouts', {
    id,
    user_id: userId,
    workout_date: todayIso(),
  });
  if (error) return null;
  return id;
}

/**
 * Adds an exercise and seeds its sets: position for position from the prior
 * session when there is one, otherwise the cold-start suggestion.
 */
export async function addExercise(
  userId: string,
  workoutId: string,
  exercise: ExerciseInfo,
  position: number,
): Promise<WorkoutExercise | null> {
  const weId = randomUUID();
  const { error } = await insertOnce('workout_exercises', {
    id: weId,
    workout_id: workoutId,
    exercise_id: exercise.id,
    user_id: userId,
    position,
  });
  if (error) return null;

  const bodyweight = await getBodyweight(userId);
  const [prior, priorBestOrm] = await Promise.all([
    getPriorSets(userId, exercise.id, weId),
    getPriorBestOrm(userId, exercise.id, workoutId, exercise, bodyweight),
  ]);

  let rows: WorkoutSet[];
  if (prior.length > 0) {
    rows = prior.map((_, idx) => {
      const src = priorSetForPosition(prior, idx);
      return {
        id: randomUUID(),
        position: idx,
        weight_value: src?.weight_value ?? null,
        reps: src?.reps ?? null,
        completed: false,
        note: null,
      };
    });
  } else {
    const sugg = coldStartSuggestion(exercise);
    rows = Array.from({ length: sugg.sets }, (_, idx) => ({
      id: randomUUID(),
      position: idx,
      weight_value: null,
      reps: sugg.reps,
      completed: false,
      note: null,
    }));
  }

  await supabase.from('sets').upsert(
    rows.map((r) => ({
      id: r.id,
      workout_exercise_id: weId,
      user_id: userId,
      position: r.position,
      weight_value: r.weight_value,
      reps: r.reps,
    })),
    { onConflict: 'id', ignoreDuplicates: true },
  );

  return { id: weId, position, exercise, sets: rows, prior, priorBestOrm };
}

/**
 * Appends a set. Past the end of the prior session a new set copies the
 * previous set in this workout, which is what the spec's prefill rule asks for.
 */
export async function addSet(
  userId: string,
  workoutExerciseId: string,
  position: number,
  seed: { weight_value: number | null; reps: number | null },
): Promise<WorkoutSet> {
  const row: WorkoutSet = {
    id: randomUUID(),
    position,
    weight_value: seed.weight_value,
    reps: seed.reps,
    completed: false,
    note: null,
  };
  await insertOnce('sets', {
    id: row.id,
    workout_exercise_id: workoutExerciseId,
    user_id: userId,
    position,
    weight_value: row.weight_value,
    reps: row.reps,
  });
  return row;
}

export async function updateSet(
  setId: string,
  patch: Partial<Pick<WorkoutSet, 'weight_value' | 'reps' | 'completed' | 'note' | 'position'>>,
): Promise<void> {
  await supabase.from('sets').update(patch).eq('id', setId);
}

export async function completeSet(setId: string, completed: boolean): Promise<void> {
  await updateSet(setId, { completed });
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
): Promise<void> {
  await insertOnce('sets', {
    id: set.id,
    workout_exercise_id: workoutExerciseId,
    user_id: userId,
    position: set.position,
    weight_value: set.weight_value,
    reps: set.reps,
    completed: set.completed,
    note: set.note,
  });
}

export async function removeExercise(workoutExerciseId: string): Promise<void> {
  // sets cascade on workout_exercise_id.
  await supabase.from('workout_exercises').delete().eq('id', workoutExerciseId);
}

export async function reorderExercises(ordered: { id: string }[]): Promise<void> {
  await Promise.all(
    ordered.map((we, i) => supabase.from('workout_exercises').update({ position: i }).eq('id', we.id)),
  );
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
