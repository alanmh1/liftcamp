import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ExerciseScreen } from '@/components/exercises/exercise-screen';
import { CollapseChevron } from '@/components/workout/collapse-chevron';

function CloseButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Close"
      style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
      <CollapseChevron />
    </Pressable>
  );
}

// headerBackVisible: Android would otherwise draw its back arrow beside the
// chevron. Constant, because Stack.Screen sets options again whenever this
// object changes.
const HEADER_OPTIONS = {
  headerBackVisible: false,
  headerLeft: () => <CloseButton />,
};

/**
 * An exercise opened over a running workout, from the card's ⋯ menu. The
 * exercise routes live inside the tabs, under the workout modal, so this
 * one sits at the root and is pushed over the modal, as progression-guide
 * is. The workout stays mounted beneath it, and the chevron or a swipe down
 * returns to it as it was. Not `exercise/[id]`: Home's stack already owns
 * that URL.
 *
 * Its own providers, for the reason the workout screen has them: a sheet
 * portalled to the root provider opens behind the modal.
 */
export default function WorkoutExerciseScreen() {
  return (
    <SafeAreaProvider>
      <BottomSheetModalProvider>
        <Stack.Screen options={HEADER_OPTIONS} />
        <ExerciseScreen overWorkout />
      </BottomSheetModalProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
