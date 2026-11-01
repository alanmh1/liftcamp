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
  const [body, prefs, rows] = await Promise.all([
    getBodyProfile(userId),
    getProPrefs(userId),
    firstSession.length > 0 ? getScanRows(userId, unit) : Promise.resolve(null),
  ]);
  if (!prefs) return null;
  const siblings = new Map<string, SiblingHistory[]>();
  for (const ex of firstSession) siblings.set(ex.id, rows ? siblingsFromScan(rows, ex, workoutId, unit) : []);
  const inputs: ProInputs = {
    userId,
    unit,
    sex: body.sex,
    // Stored in the profile's unit, which the read says.
    bodyweightKg: body.bodyweight == null ? null : convertWeight(body.bodyweight, body.weightUnit, 'kg'),
    age: ageFromBirthday(body.birthday),
    barWeight: barWeight(unit, prefs),
    plates: availablePlates(unit, prefs),
    warmups: prefs.warmups_enabled,
    siblings,
  };
  return inputs;
}

export type ProPrefs = { bar_weight: number | null; plate_inventory: unknown; warmups_enabled: boolean };

/** The bar, the plates and the Warm-up sets setting, as stored. Null when the read fails. */
export async function getProPrefs(userId: string): Promise<ProPrefs | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('bar_weight, plate_inventory, warmups_enabled')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return {
    bar_weight: data?.bar_weight ?? null,
    plate_inventory: data?.plate_inventory ?? null,
    // The column's default; also an anonymous user with no profile row yet.
    warmups_enabled: data?.warmups_enabled ?? true,
  };
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

/** The Warm-up sets switch. Upserts: an anonymous user may have no profile row yet. */
export async function setWarmupsEnabled(userId: string, on: boolean): Promise<void> {
  await supabase.from('user_profiles').upsert({ user_id: userId, warmups_enabled: on }, { onConflict: 'user_id' });
}

/** The bar and plates from Settings → Plates, in the profile's unit. Upserts, like the other profile writes. */
export async function setPlatePrefs(userId: string, bar: number, plates: readonly number[]): Promise<void> {
  await supabase
    .from('user_profiles')
    .upsert({ user_id: userId, bar_weight: bar, plate_inventory: [...plates] }, { onConflict: 'user_id' });
}
