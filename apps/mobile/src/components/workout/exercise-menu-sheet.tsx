import { forwardRef } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Sheet, SheetMenu, type SheetMenuItem, type SheetRef } from '@/components/BottomSheet';
import { useColors } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

export type ExerciseAction = 'replace' | 'reorder' | 'note' | 'remove';

const ITEMS: SheetMenuItem<ExerciseAction>[] = [
  { key: 'replace', label: 'Replace exercise' },
  { key: 'reorder', label: 'Move down' },
  { key: 'note', label: 'Add note' },
  { key: 'remove', label: 'Remove exercise', destructive: true },
];

/**
 * The ellipsis menu on an exercise card.
 *
 * The About, History, Records and Charts tabs from the spec will mount in this
 * same Sheet when the exercise detail work lands; only the body below the
 * header changes.
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
