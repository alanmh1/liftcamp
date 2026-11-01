import { showCustomEntry } from '@liftcamp/shared';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { ExerciseLibrary, type ExerciseLibraryHandle } from '@/components/exercises/exercise-library';
import { useNavHref } from '@/components/tab-layout';
import { Text } from '@/components/text';
import { getLastDoneDates } from '@/data/exercise-progress';
import { promptGuestForCustomExercises, useCustomExerciseStatus } from '@/lib/custom-exercise-access';
import { useColors } from '@/theme/theme-provider';
import { type } from '@/theme/tokens';

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
  // New, in the header, for a user with custom exercises on. The library
  // owns the sheet; the button only asks it to open.
  const status = useCustomExerciseStatus();
  const library = useRef<ExerciseLibraryHandle>(null);
  const isGuest = !!session?.user.is_anonymous;
  // A guest sees New once the feature is on for everyone; the tap asks
  // them to sign up rather than opening the sheet.
  const showNew = showCustomEntry(status, isGuest);
  function onNew() {
    if (isGuest) {
      promptGuestForCustomExercises(() => router.push('/link-account'));
      return;
    }
    library.current?.openCreate();
  }

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
      <Stack.Screen
        options={{
          headerRight: showNew
            ? () => (
                <Pressable
                  onPress={onNew}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="New custom exercise"
                  style={({ pressed }) => pressed && styles.pressed}>
                  <Text style={[type.button, { color: c.accentText }]}>New</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <ExerciseLibrary
        ref={library}
        lastDone={lastDone}
        onSelect={(e) => router.push(navHref({ kind: 'exercise', id: e.id }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pressed: { opacity: 0.7 },
});
