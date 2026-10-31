import {
  classifyCustomExerciseError,
  draftToRow,
  type CustomExerciseDraft,
  type CustomExerciseError,
} from '@liftcamp/shared';
import { randomUUID } from 'expo-crypto';

import { EXERCISE_FIELDS, invalidateExerciseCache, type ExerciseInfo } from '@/data/workouts';
import { refreshCustomExerciseStatus } from '@/lib/custom-exercise-access';
import { supabase } from '../../lib/supabase';

/**
 * A user's own exercises: rows in `exercises` with `owner_id` set. The
 * server owns the rules (docs/custom-exercises.sql): the flag, the free
 * cap, the slug and the shape. This file sends the columns the app
 * chooses and reads the refusals back.
 *
 * Direct writes, not the write queue. The user is in a form and wants
 * the answer now; a refusal (at the cap, flag off) has to show in the
 * sheet, not surface minutes later from a queue flush. Offline, the
 * sheet says so and keeps the draft. Sets logged against a custom
 * exercise still go through the queue like any other, and the exercise
 * row is on the server before any set can reference it.
 *
 * Every write that lands drops the library cache and re-reads the
 * status, so the Create row's count and the list are right on return.
 */

export type CustomWriteResult = { ok: true; exercise: ExerciseInfo } | { ok: false; error: CustomExerciseError };

function settle(error: { code?: string | null; message?: string | null } | null): CustomExerciseError {
  return classifyCustomExerciseError(error);
}

function landed() {
  invalidateExerciseCache();
  refreshCustomExerciseStatus();
}

/** Creates one. The id is minted here so the sheet can select it at once. */
export async function createCustomExercise(userId: string, draft: CustomExerciseDraft): Promise<CustomWriteResult> {
  const row = draftToRow(draft, { id: randomUUID(), ownerId: userId });
  try {
    // The trigger sets the slug to custom-<id> whatever is sent; the column
    // has no default, so the generated type wants one here.
    const { data, error } = await supabase
      .from('exercises')
      .insert({ ...row, slug: `custom-${row.id}` })
      .select(EXERCISE_FIELDS)
      .single();
    if (error) return { ok: false, error: settle(error) };
    landed();
    return { ok: true, exercise: data as ExerciseInfo };
  } catch (e) {
    return {
      ok: false,
      error: settle({ code: '', message: e instanceof Error ? e.message : '' }),
    };
  }
}

/**
 * Edits one. `lockTracking` keeps weight_type and set_type as they are,
 * for an exercise with logged sets: switching a weighted exercise to
 * timed would break its PRs.
 */
export async function updateCustomExercise(
  userId: string,
  id: string,
  draft: CustomExerciseDraft,
  lockTracking: boolean,
): Promise<CustomWriteResult> {
  const row = draftToRow(draft, { id, ownerId: userId });
  const patch: Partial<typeof row> = {
    name: row.name,
    primary_muscle: row.primary_muscle,
    secondary_muscles: row.secondary_muscles,
    equipment: row.equipment,
    is_unilateral: row.is_unilateral,
    mechanic: row.mechanic,
  };
  if (!lockTracking) {
    patch.weight_type = row.weight_type;
    patch.set_type = row.set_type;
  }
  try {
    const { data, error } = await supabase
      .from('exercises')
      .update(patch)
      .eq('id', id)
      .eq('owner_id', userId)
      .select(EXERCISE_FIELDS)
      .single();
    if (error) return { ok: false, error: settle(error) };
    landed();
    return { ok: true, exercise: data as ExerciseInfo };
  } catch (e) {
    return {
      ok: false,
      error: settle({ code: '', message: e instanceof Error ? e.message : '' }),
    };
  }
}

/**
 * Deletes one, as the user sees it. The row stays (archived_at set) so
 * every logged set keeps its exercise; it leaves the library, the picker
 * and Recent, and frees a slot against the cap.
 */
export async function archiveCustomExercise(userId: string, id: string): Promise<CustomExerciseError | null> {
  try {
    const { error } = await supabase
      .from('exercises')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_id', userId);
    if (error) return settle(error);
    landed();
    return null;
  } catch (e) {
    return settle({ code: '', message: e instanceof Error ? e.message : '' });
  }
}

/** Brings a deleted one back. Counts against the cap again, so it can be refused. */
export async function restoreCustomExercise(userId: string, id: string): Promise<CustomExerciseError | null> {
  try {
    const { error } = await supabase
      .from('exercises')
      .update({ archived_at: null })
      .eq('id', id)
      .eq('owner_id', userId);
    if (error) return settle(error);
    landed();
    return null;
  } catch (e) {
    return settle({ code: '', message: e instanceof Error ? e.message : '' });
  }
}

/** Whether any set has been logged against it, which locks its tracking type. */
export async function customExerciseHasSets(userId: string, id: string): Promise<boolean> {
  const { count } = await supabase
    .from('workout_exercises')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('exercise_id', id);
  return (count ?? 0) > 0;
}
