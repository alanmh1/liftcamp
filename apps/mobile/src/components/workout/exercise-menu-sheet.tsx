import { forwardRef } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Sheet, SheetMenu, type SheetMenuItem, type SheetRef } from '@/components/BottomSheet';
import { useColors } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

export type ExerciseAction = 'info' | 'replace' | 'note' | 'remove';

const ITEMS: SheetMenuItem<ExerciseAction>[] = [
  { key: 'info', label: 'Exercise info' },
  { key: 'replace', label: 'Replace exercise' },
  { key: 'note', label: 'Add note' },
  { key: 'remove', label: 'Remove exercise', destructive: true },
];

/**
 * The ellipsis menu on an exercise card. Moving an exercise lives on the
 * dedicated reorder screen, reached from the workout header's menu.
 */
export const ExerciseMenuSheet = forwardRef<
  SheetRef,
  { exerciseName: string; onAction: (action: ExerciseAction) => void }
>(function ExerciseMenuSheet({ exerciseName, onAction }, ref) {
  const c = useColors();

  return (
    <Sheet ref={ref}>
      <Text style={[styles.header, { color: c.text2 }]} numberOfLines={1}>
        {exerciseName}
      </Text>
      <SheetMenu items={ITEMS} onSelect={onAction} />
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
