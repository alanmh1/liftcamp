import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ExerciseScreen } from '@/components/exercises/exercise-screen';

/**
 * An exercise opened over a running workout, from the card's ⋯ menu. The
 * exercise routes live inside the tabs, under the workout modal, so this
 * one sits at the root and is pushed over the modal, as progression-guide
 * is. The workout stays mounted beneath it, and Back returns to it as it
 * was. Not `exercise/[id]`: Home's stack already owns that URL.
 *
 * Its own providers, for the reason the workout screen has them: a sheet
 * portalled to the root provider opens behind the modal.
 */
export default function WorkoutExerciseScreen() {
  return (
    <SafeAreaProvider>
      <BottomSheetModalProvider>
        <ExerciseScreen overWorkout />
      </BottomSheetModalProvider>
    </SafeAreaProvider>
  );
}
