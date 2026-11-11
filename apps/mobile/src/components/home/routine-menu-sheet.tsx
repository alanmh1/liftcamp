import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { TemplateRow } from '@liftcamp/shared';
import { forwardRef, useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Sheet, SheetMenu, type SheetMenuItem, type SheetRef } from '@/components/BottomSheet';
import { MAX_FONT_SCALE, Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

export type RoutineAction = 'rename' | 'duplicate' | 'share' | 'delete';

const ITEMS: SheetMenuItem<RoutineAction>[] = [
  { key: 'rename', label: 'Rename' },
  { key: 'duplicate', label: 'Duplicate' },
  { key: 'share', label: 'Share link' },
  { key: 'delete', label: 'Delete routine', destructive: true },
];

/**
 * Long-press menu on one of the user's own routines. `removeLabel` renames
 * the destructive item where it removes the whole routine.
 */
export const RoutineMenuSheet = forwardRef<
  SheetRef,
  { template: TemplateRow | null; removeLabel?: string; onAction: (action: RoutineAction) => void }
>(function RoutineMenuSheet({ template, removeLabel, onAction }, ref) {
  const c = useColors();
  const items = removeLabel
    ? ITEMS.map((item) => (item.key === 'delete' ? { ...item, label: removeLabel } : item))
    : ITEMS;
  return (
    <Sheet ref={ref}>
      <Text style={[styles.header, { color: c.text2 }]} numberOfLines={1}>
        {template?.name ?? ''}
      </Text>
      <SheetMenu items={items} onSelect={onAction} />
    </Sheet>
  );
});

/**
 * Rename, in a sheet rather than Alert.prompt, which iOS has and Android does
 * not. BottomSheetTextInput keeps the sheet above the keyboard.
 */
export const RenameSheet = forwardRef<
  SheetRef,
  { initialName: string; onSave: (name: string) => void }
>(function RenameSheet({ initialName, onSave }, ref) {
  const c = useColors();
  const [name, setName] = useState(initialName);
  useEffect(() => setName(initialName), [initialName]);
  const trimmed = name.trim();

  return (
    <Sheet ref={ref}>
      <Text style={[styles.header, { color: c.text2 }]}>Rename routine</Text>
      <BottomSheetTextInput
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        value={name}
        onChangeText={setName}
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        onSubmitEditing={() => trimmed && onSave(trimmed)}
        style={[styles.input, { backgroundColor: c.inputFill, borderColor: c.border, color: c.text }]}
      />
      <Pressable
        onPress={() => trimmed && onSave(trimmed)}
        disabled={!trimmed}
        style={({ pressed }) => [
          styles.save,
          { backgroundColor: c.accent },
          (pressed || !trimmed) && styles.pressed,
        ]}>
        <Text style={[type.button, { color: '#FFFFFF' }]}>Save</Text>
      </Pressable>
    </Sheet>
  );
});

const styles = StyleSheet.create({
  header: { fontSize: 15, paddingBottom: spacing.md, paddingHorizontal: 4 },
  input: {
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 17,
    marginBottom: spacing.md,
  },
  save: {
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
});
