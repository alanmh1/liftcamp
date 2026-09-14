import { DAY_TYPES, type DayType } from '@liftcamp/shared';
import { Pressable, StyleSheet, View } from 'react-native';

import { BusyLabel } from '@/components/busy-label';

import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/** One row of four: Push, Pull, Legs, Full. The web generator, same logic. */
export function GeneratorChips({
  busy,
  disabled = false,
  onPick,
}: {
  /** The chip currently generating. Shows the spinner. */
  busy: DayType | null;
  /** Anything on Home is starting. Blocks taps without changing the look. */
  disabled?: boolean;
  onPick: (day: DayType) => void;
}) {
  const c = useColors();
  return (
    <View style={styles.wrap}>
      <Text style={[type.label, { color: c.text3 }]}>Generate a day</Text>
      <View style={styles.row}>
        {DAY_TYPES.map((d) => (
          <Pressable
            key={d.value}
            onPress={() => onPick(d.value)}
            disabled={busy !== null || disabled}
            accessibilityRole="button"
            accessibilityState={{ busy: busy === d.value, disabled: busy !== null || disabled }}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: c.surface2 },
              pressed && styles.pressed,
            ]}>
            <BusyLabel
              label={d.value === 'full' ? 'Full' : d.label}
              busy={busy === d.value}
              color={c.text}
              fontSize={14}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radius.bar,
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.6 },
});
