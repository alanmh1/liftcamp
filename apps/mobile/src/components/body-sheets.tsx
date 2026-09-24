import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { WeightUnit } from '@liftcamp/shared';
import { forwardRef, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { Text } from '@/components/text';
import { BODYWEIGHT_RANGE } from '@/data/home';
import { useColors } from '@/theme/theme-provider';
import { palettes, radius, spacing, type } from '@/theme/tokens';

/**
 * Editors for the two Body fields that need more than a chip: birth year
 * and bodyweight. Each saves through the parent's callback and dismisses.
 */

/** Youngest allowed age. The list starts this many years back. */
const MIN_AGE = 13;
const OLDEST_YEAR = 1920;

function birthYears(now = new Date()): number[] {
  const newest = now.getFullYear() - MIN_AGE;
  return Array.from({ length: newest - OLDEST_YEAR + 1 }, (_, i) => newest - i);
}

/** A scrolling list of years, newest first. Tapping one saves it. */
export const BirthYearSheet = forwardRef<
  SheetRef,
  { current: number | null; onPick: (year: number) => void }
>(function BirthYearSheet({ current, onPick }, ref) {
  const c = useColors();
  return (
    <Sheet ref={ref} scroll>
      <Text style={[styles.header, { color: c.text2 }]}>Birth year</Text>
      {birthYears().map((year) => {
        const selected = year === current;
        return (
          <Pressable
            key={year}
            onPress={() => {
              onPick(year);
              (ref as React.RefObject<SheetRef | null>).current?.dismiss();
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.yearRow,
              selected && { backgroundColor: c.accentSoft },
              pressed && styles.pressed,
            ]}>
            <Text style={[type.setNumeral, { color: selected ? c.accentText : c.text }]}>{year}</Text>
          </Pressable>
        );
      })}
    </Sheet>
  );
});

/** Digits and one decimal place. A comma counts as the decimal point. */
function cleanDecimal(raw: string): string {
  const s = raw.replace(',', '.').replace(/[^0-9.]/g, '');
  const [whole, ...rest] = s.split('.');
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join('').slice(0, 1)}`;
}

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
  const parsed = value === '' ? null : Number.parseFloat(value);
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
          value={value}
          onChangeText={(t) => setValue(cleanDecimal(t))}
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
  yearRow: {
    alignItems: 'center',
    borderRadius: radius.input,
    paddingVertical: spacing.md,
  },
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
  pressed: { opacity: 0.7 },
});
