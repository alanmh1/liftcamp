import {
  ageFromBirthday,
  availablePlates,
  barWeight,
  convertWeight,
  equipmentFamily,
  numericWeight,
  type HistorySession,
  type SiblingHistory,
  type WeightUnit,
} from '@liftcamp/shared';

import { getScanRows, type ScanRow } from '@/data/history';
import { getBodyProfile } from '@/data/home';
import type { ExerciseInfo } from '@/data/workouts';
import { supabase } from '../../lib/supabase';
import type { ProInputs } from '@/lib/pro-inputs';

/**
 * Reads the Pro inputs (lib/pro-inputs.ts) for a workout: body details,
 * the bar and plates, and for each exercise in `firstSession` (no history
 * of its own) the related lifts the user has logged. The workout screen
 * calls it only while the Pro gate is open, once its server read has
 * landed, and puts the result in the store. Null when the profile read
 * fails.
 *
 * Related lifts come from the account scan the progress chart and the PRs
 * already read (scan-cache.ts), so after the first screen pays for it this
 * reads nothing. Without signal the profile read fails and nothing is set:
 * a first session offline gets no starting weight, as before.
 */
export async function loadProInputs(
  userId: string,
  unit: WeightUnit,
  workoutId: string,
  firstSession: readonly ExerciseInfo[],
): Promise<ProInputs | null> {
  const [body, plates, rows] = await Promise.all([
    getBodyProfile(userId),
    getPlatePrefs(userId),
    firstSession.length > 0 ? getScanRows(userId, unit) : Promise.resolve(null),
  ]);
  if (!plates) return null;
  const siblings = new Map<string, SiblingHistory[]>();
  for (const ex of firstSession) siblings.set(ex.id, rows ? siblingsFromScan(rows, ex, workoutId, unit) : []);
  const inputs: ProInputs = {
    userId,
    unit,
    sex: body.sex,
    // Stored in the profile's unit, which the read says.
    bodyweightKg: body.bodyweight == null ? null : convertWeight(body.bodyweight, body.weightUnit, 'kg'),
    age: ageFromBirthday(body.birthday),
    barWeight: barWeight(unit, plates),
    plates: availablePlates(unit, plates),
    siblings,
  };
  return inputs;
}

export type PlatePrefs = { bar_weight: number | null; plate_inventory: unknown };

/** The bar and plates, as stored. Null when the read fails. */
export async function getPlatePrefs(userId: string): Promise<PlatePrefs | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('bar_weight, plate_inventory')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return { bar_weight: data?.bar_weight ?? null, plate_inventory: data?.plate_inventory ?? null };
}

/**
 * Finished sessions of the other exercises that could stand in for `ex`,
 * newest first. Only a first filter (same primary muscle and equipment
 * family); `startingWeight` in shared applies the full rule. The scan's
 * sets are already in `unit`.
 */
export function siblingsFromScan(
  rows: readonly ScanRow[],
  ex: ExerciseInfo,
  workoutId: string,
  unit: WeightUnit,
): SiblingHistory[] {
  const family = equipmentFamily(ex.equipment);
  if (family == null || !ex.primary_muscle) return [];
  const byExercise = new Map<string, { exercise: SiblingHistory['exercise']; sessions: Map<string, HistorySession> }>();
  for (const row of rows) {
    const other = row.exercises;
    if (!other || other.id === ex.id || row.workout_id === workoutId) continue;
    if (other.primary_muscle !== ex.primary_muscle || equipmentFamily(other.equipment) !== family) continue;
    if (!row.workouts?.finished_at) continue;
    let group = byExercise.get(other.id);
    if (!group) {
      group = {
        exercise: {
          id: other.id,
          name: other.name,
          equipment: other.equipment,
          weight_type: other.weight_type,
          mechanic: other.mechanic,
          primary_muscle: other.primary_muscle,
          set_type: other.set_type,
        },
        sessions: new Map(),
      };
      byExercise.set(other.id, group);
    }
    let session = group.sessions.get(row.workout_id);
    if (!session) {
      session = { workoutId: row.workout_id, date: row.workouts.workout_date, sets: [] };
      group.sessions.set(row.workout_id, session);
    }
    for (const s of [...(row.sets ?? [])].filter((x) => x.completed).sort((a, b) => a.position - b.position)) {
      session.sets.push({ weight_value: numericWeight(s), weight_unit: unit, reps: s.reps });
    }
  }
  return [...byExercise.values()].map((g) => ({
    exercise: g.exercise,
    sessions: [...g.sessions.values()].sort((a, b) => b.date.localeCompare(a.date)),
  }));
}
