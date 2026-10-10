import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { WORKOUT_NOTES_COUNTER_AT, WORKOUT_NOTES_MAX } from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { forwardRef } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { Text } from '@/components/text';
import { useSocialOn } from '@/lib/social-access';
import { useColors } from '@/theme/theme-provider';
import { fontFamilyFor, palettes, radius, spacing, tabular, type } from '@/theme/tokens';

/**
 * The workout's note, on the workout screen and the summary: a row under
 * the header that opens a sheet. The screen owns the text and saves each
 * change (data/workouts setWorkoutNotes); these only draw it. Each screen
 * renders its own BottomSheetModalProvider, so the sheet shows over the
 * full-screen modal.
 */

/** "Add a note", or the note cut to two lines. Either way a pencil, and a tap opens the sheet. */
export function WorkoutNoteRow({
  notes,
  onPress,
  style,
}: {
  notes: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const text = notes.trim();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={text ? `Note. ${text}. Edit note` : 'Add a note'}
      hitSlop={4}
      style={({ pressed }) => [styles.row, style, pressed && styles.pressed]}>
      {text ? (
        <Text style={[styles.rowText, { color: c.text }]} numberOfLines={2}>
          {text}
        </Text>
      ) : (
        <Text style={[type.button, styles.rowText, { color: c.accentText }]}>Add a note</Text>
      )}
      <SymbolView
        name={{ ios: 'pencil', android: 'edit' }}
        size={17}
        weight="semibold"
        tintColor={text ? c.text3 : c.accentText}
        fallback={<Text style={[styles.pencilGlyph, { color: text ? c.text3 : c.accentText }]}>✎</Text>}
      />
    </Pressable>
  );
}

/**
 * The note box in a sheet: autofocused, the counter near the cap, the
 * friends hint for users with social on, and Done. A drag down or a tap
 * outside closes it too; every change is already saved.
 */
export const WorkoutNoteSheet = forwardRef<
  SheetRef,
  { value: string; onChangeText: (text: string) => void; onDismiss?: () => void }
>(function WorkoutNoteSheet({ value, onChangeText, onDismiss }, ref) {
  const c = useColors();
  const socialOn = useSocialOn() === true;
  const length = value.length;
  const showCounter = length >= WORKOUT_NOTES_COUNTER_AT;

  return (
    <Sheet ref={ref} onDismiss={onDismiss}>
      <Text style={[styles.header, { color: c.text2 }]}>Notes</Text>
      <BottomSheetTextInput
        value={value}
        onChangeText={onChangeText}
        autoFocus
        multiline
        maxLength={WORKOUT_NOTES_MAX}
        placeholder="How did it feel? Sleep, energy, aches"
        placeholderTextColor={c.text3}
        accessibilityLabel="Workout notes"
        textAlignVertical="top"
        style={[styles.input, { backgroundColor: c.inputFill, borderColor: c.border, color: c.text }]}
      />
      {socialOn || showCounter ? (
        <View style={styles.under}>
          <Text style={[type.meta, styles.hint, { color: c.text3 }]}>
            {socialOn ? 'Friends can see this note.' : ''}
          </Text>
          {showCounter ? (
            <Text style={[type.meta, tabular, { color: length >= WORKOUT_NOTES_MAX ? c.danger : c.text3 }]}>
              {length}/{WORKOUT_NOTES_MAX}
            </Text>
          ) : null}
        </View>
      ) : null}
      <Pressable
        onPress={() => (ref as React.RefObject<SheetRef | null>).current?.dismiss()}
        accessibilityRole="button"
        style={({ pressed }) => [styles.done, { backgroundColor: c.accent }, pressed && styles.pressed]}>
        <Text style={[type.button, { color: palettes.light.bg }]}>Done</Text>
      </Pressable>
    </Sheet>
  );
});

/** The note from the last finished workout of this routine day, one line. Nothing when there is none. */
export function LastTimeNote({ note, style }: { note: string | null; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  if (!note) return null;
  return (
    <View style={style}>
      <Text style={[type.meta, { color: c.text2 }]} numberOfLines={1}>
        <Text style={[type.meta, styles.lastLabel, { color: c.text2 }]}>Last time</Text>
        {'  '}
        {note}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.sm,
  },
  rowText: { flex: 1, fontSize: 15, lineHeight: 20 },
  pencilGlyph: { fontSize: 17 },
  header: { fontSize: 15, paddingBottom: spacing.md, paddingHorizontal: 4 },
  input: {
    minHeight: 96,
    maxHeight: 200,
    borderRadius: radius.input,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    // BottomSheetTextInput is React Native's, not ours: Outfit set by hand.
    fontFamily: fontFamilyFor('400'),
    fontSize: 17,
    lineHeight: 22,
  },
  under: { flexDirection: 'row', gap: spacing.md, paddingTop: spacing.sm, paddingHorizontal: 4 },
  hint: { flex: 1 },
  done: {
    marginTop: spacing.md,
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  lastLabel: { fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
