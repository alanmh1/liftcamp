import { forwardRef } from 'react';
import { StyleSheet } from 'react-native';

import { Sheet, SheetMenu, type SheetMenuItem, type SheetRef } from '@/components/BottomSheet';
import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

export type ExerciseAction = 'history' | 'info' | 'replace' | 'reorder' | 'note' | 'remove';

/**
 * Reorder is built per open because it depends on the workout, not the card:
 * it opens the whole-workout reorder screen and is disabled below two
 * exercises, since there is nothing to move.
 */
function items(canReorder: boolean): SheetMenuItem<ExerciseAction>[] {
  return [
    { key: 'history', label: 'History' },
    { key: 'info', label: 'Exercise Info' },
    { key: 'reorder', label: 'Reorder', disabled: !canReorder },
    { key: 'replace', label: 'Replace' },
    { key: 'note', label: 'Add Note' },
    { key: 'remove', label: 'Remove', destructive: true },
  ];
}

/**
 * The ellipsis menu on an exercise card. Reorder exercises opens the
 * whole-workout reorder screen; it is here rather than in the header because
 * the card is where a user is looking when they decide an exercise is in the
 * wrong place.
 */
export const ExerciseMenuSheet = forwardRef<
  SheetRef,
  { exerciseName: string; canReorder: boolean; onAction: (action: ExerciseAction) => void }
>(function ExerciseMenuSheet({ exerciseName, canReorder, onAction }, ref) {
  const c = useColors();

  return (
    <Sheet ref={ref}>
      <Text style={[styles.header, { color: c.text2 }]} numberOfLines={1}>
        {exerciseName}
      </Text>
      <SheetMenu items={items(canReorder)} onSelect={onAction} />
    </Sheet>
  );
});

const styles = StyleSheet.create({
  header: {
    fontSize: 15,
    paddingBottom: spacing.md,
    paddingHorizontal: 4,
  },
});
