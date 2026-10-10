import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  APP_STORAGE_PREFIX,
  hasPendingFor,
  lastRoutineNote,
  pendingWorkoutNotes,
  type RoutineNoteCandidate,
  type WeightUnit,
} from '@liftcamp/shared';

import { listDeviceWorkouts } from '@/data/device-workout';
import { pendingWrites } from '@/data/write-queue';
import { supabase } from '../../lib/supabase';

/**
 * "Last time" on the workout screen: the note from the most recent finished
 * workout of the same routine day (`workouts.template_id`). Read only.
 *
 * Two answers, phone first. `localRoutineNote` reads only the device: the
 * server's last answer for the day, kept per user under
 * `liftcamp:routine-notes:<userId>` (a map of template id to candidate),
 * the phone's copies of finished workouts not yet synced, and notes still
 * in the queue. `serverRoutineNote` asks the server, saves its answer to
 * that map, and gives undefined with no answer, so the screen keeps what
 * the phone said.
 */

type NoteMap = Record<string, RoutineNoteCandidate>;

function mapKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}routine-notes:${userId}`;
}

async function readMap(userId: string): Promise<NoteMap> {
  try {
    const raw = await AsyncStorage.getItem(mapKey(userId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as NoteMap) : {};
  } catch {
    return {};
  }
}

async function writeMap(userId: string, map: NoteMap): Promise<void> {
  try {
    await AsyncStorage.setItem(mapKey(userId), JSON.stringify(map));
  } catch {
    // Only the offline answer is lost; the server read still works.
  }
}

/** What the phone alone says the last note for this routine day is. */
export async function localRoutineNote(
  userId: string,
  templateId: string,
  excludeWorkoutId: string,
  unit: WeightUnit,
): Promise<string | null> {
  const [map, copies, ops] = await Promise.all([readMap(userId), listDeviceWorkouts(userId, unit), pendingWrites(userId)]);
  const withQueued = (c: RoutineNoteCandidate): RoutineNoteCandidate => {
    const queued = pendingWorkoutNotes(ops, c.workoutId);
    return queued !== undefined ? { ...c, notes: queued } : c;
  };
  const candidates: RoutineNoteCandidate[] = [];
  const cached = map[templateId];
  if (cached) candidates.push(withQueued(cached));
  for (const { workout } of copies) {
    if (workout.templateId !== templateId || !workout.finishedAt) continue;
    candidates.push(
      withQueued({ workoutId: workout.id, templateId, finishedAt: workout.finishedAt, notes: workout.notes ?? null }),
    );
  }
  return lastRoutineNote(candidates, templateId, excludeWorkoutId);
}

/**
 * The server's answer, with the phone's unsent work over it. Undefined when
 * the read got no answer.
 */
export async function serverRoutineNote(
  userId: string,
  templateId: string,
  excludeWorkoutId: string,
  unit: WeightUnit,
): Promise<string | null | undefined> {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, template_id, finished_at, notes')
    .eq('user_id', userId)
    .eq('template_id', templateId)
    .neq('id', excludeWorkoutId)
    .not('finished_at', 'is', null)
    .not('notes', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return undefined;
  const [map, ops] = await Promise.all([readMap(userId), pendingWrites(userId)]);
  const server: RoutineNoteCandidate | null = data
    ? { workoutId: data.id, templateId, finishedAt: data.finished_at, notes: data.notes }
    : null;
  // The server is the answer, unless the saved one is newer and still has
  // writes on the phone: then the server has not seen it yet.
  const saved = map[templateId];
  const keepSaved =
    saved != null &&
    hasPendingFor(ops, saved.workoutId) &&
    (server == null || (saved.finishedAt ?? '') > (server.finishedAt ?? ''));
  if (!keepSaved) {
    if (server) map[templateId] = server;
    else delete map[templateId];
    await writeMap(userId, map);
  }
  return localRoutineNote(userId, templateId, excludeWorkoutId, unit);
}

/**
 * Keeps the saved answers current without a read: a workout of a routine
 * day finished here with a note becomes that day's answer when it is the
 * newest, and a note edited later (on the summary) changes the saved text.
 */
export async function rememberRoutineNote(
  userId: string,
  workout: { id: string; templateId?: string | null; finishedAt?: string | null; notes?: string | null },
): Promise<void> {
  const map = await readMap(userId);
  let changed = false;
  for (const [day, c] of Object.entries(map)) {
    if (c.workoutId === workout.id && workout.notes !== undefined) {
      map[day] = { ...c, notes: workout.notes };
      changed = true;
    }
  }
  const { templateId, finishedAt, notes } = workout;
  if (templateId && finishedAt && notes?.trim()) {
    const prior = map[templateId];
    if (!prior?.finishedAt || prior.finishedAt <= finishedAt) {
      map[templateId] = { workoutId: workout.id, templateId, finishedAt, notes };
      changed = true;
    }
  }
  if (changed) await writeMap(userId, map);
}
