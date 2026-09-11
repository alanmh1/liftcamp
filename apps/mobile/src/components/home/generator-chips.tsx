import { DAY_TYPES, type DayType } from '@liftcamp/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/** One row of four: Push, Pull, Legs, Full. The web generator, same logic. */
export function GeneratorChips({
  busy,
  onPick,
}: {
  busy: DayType | null;
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
            disabled={busy !== null}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: c.surface2 },
              (pressed || busy === d.value) && styles.pressed,
            ]}>
            <Text style={[type.button, { color: c.text, fontSize: 14 }]}>
              {busy === d.value ? '…' : d.value === 'full' ? 'Full' : d.label}
            </Text>
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
