import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { ExerciseLibrary } from '@/components/exercises/exercise-library';
import { useNavHref } from '@/components/tab-layout';
import { getLastDoneDates } from '@/data/exercise-progress';
import { useColors } from '@/theme/theme-provider';

/**
 * The exercise library, pushed from the Workout tab's Exercises row: every
 * exercise, searchable and filterable by Muscle, Equipment, Level and
 * Yours, with the ones the user has done marked by their last date. It
 * opens with the keyboard down. A row pushes the exercise on this stack,
 * so Back returns here. Last done refreshes on focus, so a workout
 * finished since the last visit shows without a pull to refresh.
 */
export default function ExercisesScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const navHref = useNavHref();
  const c = useColors();
  const userId = session?.user.id;
  const [lastDone, setLastDone] = useState<Map<string, string>>(new Map());

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      getLastDoneDates(userId).then((m) => {
        if (!cancelled) setLastDone(m);
      });
      return () => {
        cancelled = true;
      };
    }, [userId]),
  );

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <ExerciseLibrary lastDone={lastDone} onSelect={(e) => router.push(navHref({ kind: 'exercise', id: e.id }))} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
