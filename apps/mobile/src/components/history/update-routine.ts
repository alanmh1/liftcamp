import { isCardio, routineChanges, type RoutineEntry } from '@liftcamp/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { saveRoutineError } from '@/components/history/save-routine-sheet';
import type { WorkoutDetail } from '@/data/history';
import { getUpdatableRoutine, updateRoutineExercises, type UpdatableRoutine } from '@/data/home';

/** What Update routine would do: the routine it writes to and the exercises it writes. */
export type RoutineUpdate = { routine: UpdatableRoutine; exercises: RoutineEntry[] };

/**
 * Update routine, for a finished workout started from a routine: offered
 * when the routine is the user's own and still there, and the workout
 * added, removed or replaced an exercise (routineChanges in shared). Null
 * while loading, offline, for an unlinked workout, and once updated.
 *
 * `latestOnly` (History) also needs the workout to be the routine's most
 * recent finished one, so an older workout never overwrites a newer change.
 */
export function useRoutineUpdate(
  userId: string | undefined,
  workout: WorkoutDetail | null,
  { latestOnly }: { latestOnly: boolean },
): { update: RoutineUpdate | null; onUpdated: () => void } {
  const templateId = workout?.templateId ?? null;
  const workoutId = workout?.id;
  const [routine, setRoutine] = useState<UpdatableRoutine | null>(null);
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    setRoutine(null);
    if (!userId || !templateId || !workoutId) return;
    let cancelled = false;
    getUpdatableRoutine(userId, templateId, latestOnly ? workoutId : undefined)
      .then((r) => {
        if (!cancelled) setRoutine(r);
      })
      .catch(() => {
        // No offer; the screen is whole without it.
      });
    return () => {
      cancelled = true;
    };
  }, [userId, templateId, workoutId, latestOnly]);

  const exercises = useMemo(
    () =>
      routine && workout
        ? routineChanges(
            routine.exercises,
            workout.exercises.map((we) => ({
              exerciseId: we.exercise.id,
              sets: we.sets,
              cardio: isCardio(we.exercise),
            })),
          )
        : null,
    [routine, workout],
  );

  const onUpdated = useCallback(() => setUpdated(true), []);
  const update = routine && exercises && !updated ? { routine, exercises } : null;
  return { update, onUpdated };
}

/**
 * Asks, then writes. True once the routine has today's exercises; false on
 * Not now, or on a failed write, which says why with the save sheet's copy.
 */
export function confirmUpdateRoutine(userId: string, { routine, exercises }: RoutineUpdate): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      `Update ${routine.name}?`,
      "Saves today's exercises to this routine for next time.",
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Update',
          onPress: () => {
            void updateRoutineExercises(userId, routine.id, exercises).then((result) => {
              if (result.ok) Alert.alert('Routine updated');
              else Alert.alert(saveRoutineError(result.reason));
              resolve(result.ok);
            });
          },
        },
      ],
      // Android: a tap outside the alert is a Not now.
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
