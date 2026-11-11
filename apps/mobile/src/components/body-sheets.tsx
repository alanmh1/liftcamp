import DateTimePicker from '@expo/ui/community/datetime-picker';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import {
  cleanDecimal,
  defaultBirthday,
  EARLIEST_BIRTHDAY,
  isoFromLocalDate,
  latestBirthday,
  localDateFromIso,
  parseDecimal,
  type WeightUnit,
} from '@liftcamp/shared';
import { forwardRef, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { MAX_FONT_SCALE, Text } from '@/components/text';
import { BODYWEIGHT_RANGE } from '@/data/home';
import { useColors, useTheme } from '@/theme/theme-provider';
import { palettes, radius, spacing, type } from '@/theme/tokens';

/**
 * Editors for the Settings rows that need more than an action sheet:
 * birthday and bodyweight. Each saves through the parent's callback and
 * dismisses.
 */

/**
 * Month, day and year wheels, from Jan 1, 1920 to 13 years ago. Opens on
 * the saved birthday, or Jan 1 thirty years back. Saves on Done.
 *
 * The wheel is SwiftUI's DatePicker through @expo/ui, which is in the dev
 * build. Android gets that library's Material picker instead.
 */
export const BirthdaySheet = forwardRef<
  SheetRef,
  { current: string | null; onSave: (isoDate: string) => void }
>(function BirthdaySheet({ current, onSave }, ref) {
  const { scheme, colors: c } = useTheme();
  const [value, setValue] = useState<Date>(() => localDateFromIso(current) ?? defaultBirthday());
  useEffect(() => {
    setValue(localDateFromIso(current) ?? defaultBirthday());
  }, [current]);

  function done() {
    onSave(isoFromLocalDate(value));
    (ref as React.RefObject<SheetRef | null>).current?.dismiss();
  }

  return (
    <Sheet ref={ref}>
      <Text style={[styles.header, { color: c.text2 }]}>Birthday</Text>
      <DateTimePicker
        value={value}
        mode="date"
        display="spinner"
        minimumDate={localDateFromIso(EARLIEST_BIRTHDAY) ?? undefined}
        maximumDate={latestBirthday()}
        onValueChange={(_e, date) => setValue(date)}
        accentColor={c.accent}
        themeVariant={scheme}
        locale="en_US"
      />
      <Pressable
        onPress={done}
        accessibilityRole="button"
        style={({ pressed }) => [styles.save, styles.done, { backgroundColor: c.accent }, pressed && styles.pressed]}>
        <Text style={[type.button, { color: palettes.light.bg }]}>Done</Text>
      </Pressable>
    </Sheet>
  );
});

/**
 * Bodyweight in the current unit. Empty clears it. The range is the same
 * body in either unit: 30 to 700 lbs, 14 to 320 kg.
 */
export const BodyweightSheet = forwardRef<
  SheetRef,
  {
    current: number | null;
    unit: WeightUnit;
    /** The label printed after the number, `lbs` or `kg`. */
    label: string;
    onSave: (value: number | null) => void;
  }
>(function BodyweightSheet({ current, unit, label, onSave }, ref) {
  const c = useColors();
  const [value, setValue] = useState(current == null ? '' : String(current));
  useEffect(() => {
    setValue(current == null ? '' : String(current));
  }, [current]);

  const range = BODYWEIGHT_RANGE[unit];
  // The box keeps a typed comma, so it is read with parseDecimal. A lone
  // separator is NaN, out of range, so it never saves as a clear.
  const parsed = value === '' ? null : (parseDecimal(value) ?? Number.NaN);
  const outOfRange = parsed != null && (!Number.isFinite(parsed) || parsed < range.min || parsed > range.max);
  const unchanged = parsed === current;
  const canSave = !outOfRange && !unchanged;

  function save() {
    if (!canSave) return;
    onSave(parsed);
    (ref as React.RefObject<SheetRef | null>).current?.dismiss();
  }

  return (
    <Sheet ref={ref}>
      <Text style={[styles.header, { color: c.text2 }]}>Bodyweight</Text>
      <View style={[styles.field, { backgroundColor: c.inputFill, borderColor: c.border }]}>
        <BottomSheetTextInput
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          value={value}
          onChangeText={(t) => setValue(cleanDecimal(t, 1))}
          autoFocus
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={save}
          placeholder="Not set"
          placeholderTextColor={c.text3}
          style={[styles.input, { color: c.text }]}
        />
        <Text style={[styles.unit, { color: c.text3 }]}>{label}</Text>
      </View>
      <Text style={[type.meta, styles.hint, { color: outOfRange ? c.danger : c.text3 }]}>
        {`Between ${range.min} and ${range.max} ${label}. Leave it empty to remove it.`}
      </Text>
      <Pressable
        onPress={save}
        disabled={!canSave}
        accessibilityRole="button"
        style={({ pressed }) => [styles.save, { backgroundColor: c.accent }, (pressed || !canSave) && styles.pressed]}>
        <Text style={[type.button, { color: palettes.light.bg }]}>Save</Text>
      </Pressable>
    </Sheet>
  );
});

const styles = StyleSheet.create({
  header: { fontSize: 15, paddingBottom: spacing.md, paddingHorizontal: 4 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, fontSize: 17, paddingVertical: spacing.md, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 17, paddingLeft: spacing.sm },
  hint: { paddingTop: spacing.sm, paddingBottom: spacing.md, paddingHorizontal: 4 },
  save: {
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  done: { marginTop: spacing.md },
  pressed: { opacity: 0.7 },
});
