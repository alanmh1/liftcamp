import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { RoutineExercise } from '@liftcamp/shared';
import { forwardRef, useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { Text } from '@/components/text';
import { saveWorkoutAsRoutine } from '@/data/home';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/** Long enough for any routine name worth typing, short enough for a card. */
const NAME_MAX = 60;

/**
 * Save routine, from a finished workout's detail. The name starts as
 * the workout's and can be edited; Save writes the routine (online only)
 * and the sheet closes. A failed save keeps the sheet open with a line
 * saying why, so nothing typed is lost.
 */
export const SaveRoutineSheet = forwardRef<
  SheetRef,
  {
    userId: string | undefined;
    initialName: string;
    exercises: RoutineExercise[];
    /** Called with the saved name once the sheet has closed. */
    onSaved: (name: string) => void;
  }
>(function SaveRoutineSheet({ userId, initialName, exercises, onSaved }, ref) {
  const c = useColors();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setName(initialName);
    setError(null);
  }, [initialName]);

  const trimmed = name.trim();
  const canSave = !busy && trimmed.length > 0 && exercises.length > 0;

  async function save() {
    if (!userId || !canSave) return;
    setBusy(true);
    setError(null);
    const result = await saveWorkoutAsRoutine(userId, trimmed, exercises);
    setBusy(false);
    if (result.ok) {
      (ref as React.RefObject<SheetRef | null>).current?.dismiss();
      onSaved(trimmed);
      return;
    }
    setError(
      result.reason === 'offline'
        ? 'No connection. Saving a routine needs the internet.'
        : 'Could not save the routine. Try again.',
    );
  }

  return (
    <Sheet ref={ref} onDismiss={() => setError(null)}>
      <Text style={[styles.header, { color: c.text2 }]}>Save routine</Text>
      <BottomSheetTextInput
        value={name}
        onChangeText={(t) => {
          setName(t);
          setError(null);
        }}
        autoFocus
        selectTextOnFocus
        maxLength={NAME_MAX}
        returnKeyType="done"
        onSubmitEditing={() => void save()}
        accessibilityLabel="Routine name"
        style={[styles.input, { backgroundColor: c.inputFill, borderColor: c.border, color: c.text }]}
      />
      <Text style={[type.meta, styles.hint, { color: error ? c.danger : c.text3 }]}>
        {error ?? 'Saves each exercise with the sets you completed.'}
      </Text>
      <Pressable
        onPress={() => void save()}
        disabled={!canSave}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.save,
          { backgroundColor: c.accent },
          (pressed || !canSave) && styles.pressed,
        ]}>
        <Text style={[type.button, { color: '#FFFFFF' }]}>{busy ? 'Saving…' : 'Save'}</Text>
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
  },
  hint: { paddingTop: spacing.sm, paddingBottom: spacing.md, paddingHorizontal: 4 },
  save: {
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
});
