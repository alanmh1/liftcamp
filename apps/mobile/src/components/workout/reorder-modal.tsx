import { StyleSheet } from 'react-native';

import { ExerciseThumb } from '@/components/exercise-media';
import { ReorderListModal } from '@/components/reorder-list-modal';
import { Text } from '@/components/text';
import type { WorkoutExercise } from '@/data/workouts';
import { useTheme } from '@/theme/theme-provider';
import { type } from '@/theme/tokens';

/**
 * Drag-to-reorder for the workout's exercises: the shared list modal with
 * a thumbnail and the exercise name on each row. Nothing is persisted
 * here: the caller receives the final order from `onDone` and writes once.
 */
export function ReorderModal({
  visible,
  exercises,
  onDone,
}: {
  visible: boolean;
  exercises: WorkoutExercise[];
  onDone: (ordered: WorkoutExercise[]) => void;
}) {
  const { colors: c } = useTheme();
  return (
    <ReorderListModal
      visible={visible}
      title="Reorder exercises"
      items={exercises}
      keyOf={(we) => we.id}
      onDone={onDone}
      renderItem={(we) => (
        <>
          <ExerciseThumb exercise={we.exercise} size={44} />
          <Text style={[type.exerciseName, styles.name, { color: c.text }]} numberOfLines={2}>
            {we.exercise.name}
          </Text>
        </>
      )}
    />
  );
}

const styles = StyleSheet.create({
  name: { flex: 1 },
});
