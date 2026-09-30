import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { ExerciseLibrary } from '@/components/exercises/exercise-library';
import { HeaderWorkoutButton, workoutPillOptions } from '@/components/header-workout-button';
import { getLastDoneDates } from '@/data/exercise-progress';
import { useColors } from '@/theme/theme-provider';

/**
 * The library: every exercise, searchable and filterable, with the ones
 * the user has done marked by their last date. Tapping a row opens the
 * exercise screen. Last done refreshes on focus, so a workout finished
 * since the last visit shows without a pull to refresh.
 */
export default function ExercisesScreen() {
  const { session } = useAuth();
  const router = useRouter();
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
      {/* The search field and filter chips are in the list's header, not
          the native one, so the pill has the bar's right side to itself. */}
      <Stack.Screen options={PILL_OPTIONS} />
      <ExerciseLibrary
        lastDone={lastDone}
        onSelect={(e) => router.push({ pathname: '/exercises/[id]', params: { id: e.id } })}
      />
    </View>
  );
}

/** Made once, so the header item is not remade on every render. */
const PILL_OPTIONS = workoutPillOptions(<HeaderWorkoutButton />);

const styles = StyleSheet.create({ fill: { flex: 1 } });
