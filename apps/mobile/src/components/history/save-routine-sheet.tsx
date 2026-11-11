import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { RoutineExercise } from '@liftcamp/shared';
import { forwardRef, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { MAX_FONT_SCALE, Text } from '@/components/text';
import { getUserRoutineNames, saveWorkoutAsRoutine, type SaveRoutineResult } from '@/data/home';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/** Long enough for any routine name worth typing, short enough for a card. */
const NAME_MAX = 60;

/** Why a routine write failed, for the save sheet and Update routine. */
export function saveRoutineError(reason: Extract<SaveRoutineResult, { ok: false }>['reason']): string {
  return reason === 'offline'
    ? 'No connection. Saving a routine needs the internet.'
    : 'Could not save the routine. Try again.';
}

/**
 * Save routine, from a finished workout's detail. The name starts as
 * the workout's and can be edited; Save writes the routine (online only)
 * and the sheet closes. A failed save keeps the sheet open with a line
 * saying why, so nothing typed is lost.
 *
 * A name that matches one of the user's routines (trimmed, any case) turns
 * the hint into a warning. Save stays enabled; two routines may share a
 * name, but it is rarely what was meant.
 *
 * "Add to Up next", on by default, puts the routine at the end of the
 * rotation. Off, it saves out of the rotation, under Other routines.
 */
export const SaveRoutineSheet = forwardRef<
  SheetRef,
  {
    userId: string | undefined;
    /** The finished workout being saved, credited to the new routine. */
    workoutId: string;
    initialName: string;
    exercises: RoutineExercise[];
    /** Called with the saved name and the new routine's id once the sheet has closed. */
    onSaved: (name: string, routineId: string) => void;
  }
>(function SaveRoutineSheet({ userId, workoutId, initialName, exercises, onSaved }, ref) {
  const c = useColors();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inRotation, setInRotation] = useState(true);
  // Lower-cased, trimmed names of the user's routines. Empty until read,
  // and on a failed read, which only means no warning.
  const [taken, setTaken] = useState<Set<string>>(new Set());
  useEffect(() => {
    setName(initialName);
    setError(null);
    setInRotation(true);
  }, [initialName]);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getUserRoutineNames(userId)
      .then((names) => {
        if (!cancelled) setTaken(new Set(names.map((n) => n.trim().toLowerCase())));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const trimmed = name.trim();
  const duplicate = taken.has(trimmed.toLowerCase());
  const canSave = !busy && trimmed.length > 0 && exercises.length > 0;

  async function save() {
    if (!userId || !canSave) return;
    setBusy(true);
    setError(null);
    const result = await saveWorkoutAsRoutine(userId, trimmed, exercises, workoutId, inRotation);
    setBusy(false);
    if (result.ok) {
      (ref as React.RefObject<SheetRef | null>).current?.dismiss();
      onSaved(trimmed, result.id);
      return;
    }
    setError(saveRoutineError(result.reason));
  }

  return (
    <Sheet ref={ref} onDismiss={() => setError(null)}>
      <Text style={[styles.header, { color: c.text2 }]}>Save routine</Text>
      <BottomSheetTextInput
        maxFontSizeMultiplier={MAX_FONT_SCALE}
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
      <Text style={[type.meta, styles.hint, { color: error || duplicate ? c.danger : c.text3 }]}>
        {error ??
          (duplicate ? 'You already have a routine with this name.' : 'Saves each exercise with the sets you completed.')}
      </Text>
      <View style={styles.toggleRow}>
        <Text style={[type.button, styles.toggleLabel, { color: c.text }]}>Add to Up next</Text>
        <Switch
          value={inRotation}
          onValueChange={setInRotation}
          trackColor={{ true: c.accent }}
          accessibilityLabel="Add to Up next"
        />
      </View>
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: 4,
    paddingBottom: spacing.md,
  },
  toggleLabel: { flex: 1 },
  save: {
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
});
