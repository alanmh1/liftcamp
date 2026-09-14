import { forwardRef } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Sheet, SheetMenu, type SheetMenuItem, type SheetRef } from '@/components/BottomSheet';
import { useColors } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

export type ExerciseAction = 'info' | 'replace' | 'moveUp' | 'moveDown' | 'note' | 'remove';

/** Rows whose enabled state depends on the card's position are built per open. */
function items(isFirst: boolean, isLast: boolean): SheetMenuItem<ExerciseAction>[] {
  return [
    { key: 'info', label: 'Exercise info' },
    { key: 'replace', label: 'Replace exercise' },
    { key: 'moveUp', label: 'Move up', disabled: isFirst },
    { key: 'moveDown', label: 'Move down', disabled: isLast },
    { key: 'note', label: 'Add note' },
    { key: 'remove', label: 'Remove exercise', destructive: true },
  ];
}

/**
 * The ellipsis menu on an exercise card.
 *
 * The About, History, Records and Charts tabs from the spec will mount in this
 * same Sheet when the exercise detail work lands; only the body below the
 * header changes.
 */
export const ExerciseMenuSheet = forwardRef<
  SheetRef,
  {
    exerciseName: string;
    isFirst: boolean;
    isLast: boolean;
    onAction: (action: ExerciseAction) => void;
  }
>(function ExerciseMenuSheet({ exerciseName, isFirst, isLast, onAction }, ref) {
  const c = useColors();

  return (
    <Sheet ref={ref}>
      <Text style={[styles.header, { color: c.text2 }]} numberOfLines={1}>
        {exerciseName}
      </Text>
      <SheetMenu items={items(isFirst, isLast)} onSelect={onAction} />
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
