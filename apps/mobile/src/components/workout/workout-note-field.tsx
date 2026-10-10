import { WORKOUT_NOTES_COUNTER_AT, WORKOUT_NOTES_MAX } from '@liftcamp/shared';
import type { Ref } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text, TextInput } from '@/components/text';
import { useSocialOn } from '@/lib/social-access';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, tabular, type } from '@/theme/tokens';

/**
 * The workout's note box, on the workout screen and the summary. The
 * screen owns the text and the save (data/workouts setWorkoutNotes); this
 * only draws it. `ref` is the whole block, for a scroll-into-view that
 * keeps the hint and the counter above the keyboard too.
 *
 * The hint under the box shows only to users with social on.
 */
export function WorkoutNoteField({
  ref,
  value,
  onChangeText,
  onFocus,
  onBlur,
  style,
}: {
  ref?: Ref<View>;
  value: string;
  onChangeText: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const socialOn = useSocialOn() === true;
  const length = value.length;

  return (
    <View ref={ref} collapsable={false} style={[styles.block, style]}>
      <Text style={[type.label, { color: c.text3 }]}>Notes</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        multiline
        maxLength={WORKOUT_NOTES_MAX}
        placeholder="How did it feel? Sleep, energy, aches"
        placeholderTextColor={c.text3}
        accessibilityLabel="Workout notes"
        textAlignVertical="top"
        style={[styles.input, type.meta, { backgroundColor: c.inputFill, borderColor: c.border, color: c.text }]}
      />
      {socialOn || length >= WORKOUT_NOTES_COUNTER_AT ? (
        <View style={styles.under}>
          <Text style={[type.meta, styles.hint, { color: c.text3 }]}>
            {socialOn ? 'Friends can see this note.' : ''}
          </Text>
          {length >= WORKOUT_NOTES_COUNTER_AT ? (
            <Text style={[type.meta, tabular, { color: length >= WORKOUT_NOTES_MAX ? c.danger : c.text3 }]}>
              {length}/{WORKOUT_NOTES_MAX}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  input: {
    minHeight: 72,
    borderRadius: radius.input,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    lineHeight: 18,
  },
  under: { flexDirection: 'row', gap: spacing.md },
  hint: { flex: 1 },
});
