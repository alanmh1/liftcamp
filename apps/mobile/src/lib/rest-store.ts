import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The running rest timer, saved per workout so it survives leaving the
 * workout screen (Close, then Resume from Home) and a relaunch. The screen
 * saves it whenever the rest starts or changes and clears it when the rest
 * ends or is skipped; finishing or discarding the workout clears it too.
 * The rest-end alert (lib/rest-alert) is scheduled and cancelled with it.
 *
 * Under the `liftcamp:` prefix, so deleting an account and Start fresh
 * clear it with the rest.
 */
export type RunningRest = {
  /** Epoch ms when the rest runs out. */
  endsAt: number;
  /** The rest's full length in seconds, for the ring. */
  total: number;
  /** The exercise whose set started it, for "Use for this exercise next time". */
  exerciseId: string | null;
};

function key(workoutId: string): string {
  return `liftcamp:rest:${workoutId}`;
}

export async function saveRunningRest(workoutId: string, rest: RunningRest): Promise<void> {
  try {
    await AsyncStorage.setItem(key(workoutId), JSON.stringify(rest));
  } catch {
    // Losing the saved timer only matters if the screen is left; never an error.
  }
}

/** The saved rest if it is still running. One already past is cleared. */
export async function loadRunningRest(workoutId: string): Promise<RunningRest | null> {
  try {
    const raw = await AsyncStorage.getItem(key(workoutId));
    if (!raw) return null;
    const rest = JSON.parse(raw) as Partial<RunningRest>;
    if (typeof rest.endsAt !== 'number' || typeof rest.total !== 'number' || rest.endsAt <= Date.now()) {
      await AsyncStorage.removeItem(key(workoutId));
      return null;
    }
    return { endsAt: rest.endsAt, total: rest.total, exerciseId: rest.exerciseId ?? null };
  } catch {
    return null;
  }
}

export async function clearRunningRest(workoutId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(workoutId));
  } catch {
    // Nothing to do; a stale record is cleared on the next load.
  }
}
