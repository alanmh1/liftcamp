import { ISO_WEEKDAYS, toggleTrainingDay, WEEKDAY_LETTERS, WEEKDAY_LONG } from '@liftcamp/shared';
import { forwardRef, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { palettes, radius, spacing, type } from '@/theme/tokens';

const TOGGLE = 44;

/**
 * Seven 44 pt circular toggles, M T W T F S S, Monday first, multi-select.
 * Onboarding's schedule page and the Settings days sheet. Selected is the
 * accent fill with white text; unselected is `surface2`.
 */
export function DayToggles({
  days,
  onChange,
  disabled = false,
}: {
  days: readonly number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <View style={styles.row}>
      {ISO_WEEKDAYS.map((d) => {
        const on = days.includes(d);
        return (
          <Pressable
            key={d}
            onPress={() => onChange(toggleTrainingDay(days, d))}
            disabled={disabled}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={WEEKDAY_LONG[d]}
            style={({ pressed }) => [
              styles.toggle,
              { backgroundColor: on ? c.accent : c.surface2 },
              pressed && styles.pressed,
            ]}>
            <Text style={[type.button, { color: on ? '#FFFFFF' : c.text }]}>{WEEKDAY_LETTERS[d]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Settings › Training days: the same toggles and a Save. Clearing every day
 * is allowed (it turns the reminders off).
 */
export const TrainingDaysSheet = forwardRef<
  SheetRef,
  { current: readonly number[] | null; onSave: (days: number[]) => void }
>(function TrainingDaysSheet({ current, onSave }, ref) {
  const c = useColors();
  const [days, setDays] = useState<number[]>(() => [...(current ?? [])]);
  useEffect(() => {
    setDays([...(current ?? [])]);
  }, [current]);

  function save() {
    onSave(days);
    (ref as React.RefObject<SheetRef | null>).current?.dismiss();
  }

  return (
    <Sheet ref={ref}>
      <Text style={[styles.header, { color: c.text2 }]}>Training days</Text>
      <DayToggles days={days} onChange={setDays} />
      <Text style={[type.meta, styles.hint, { color: c.text2 }]}>
        {days.length === 0 ? 'No days means no reminders.' : 'One reminder on each of these days.'}
      </Text>
      <Pressable
        onPress={save}
        accessibilityRole="button"
        style={({ pressed }) => [styles.save, { backgroundColor: c.accent }, pressed && styles.pressed]}>
        <Text style={[type.button, { color: palettes.light.bg }]}>Save</Text>
      </Pressable>
    </Sheet>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  toggle: {
    width: TOGGLE,
    height: TOGGLE,
    borderRadius: TOGGLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { fontSize: 15, paddingBottom: spacing.md, paddingHorizontal: 4 },
  hint: { paddingTop: spacing.md, paddingBottom: spacing.md, paddingHorizontal: 4 },
  save: { borderRadius: radius.bar, paddingVertical: spacing.lg, alignItems: 'center' },
  pressed: { opacity: 0.7 },
});
