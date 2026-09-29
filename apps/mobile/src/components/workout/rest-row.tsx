import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

const RING = 22;
const STROKE = 3;
const R = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The rest row. A plain row under the header, no background, hidden when no
 * rest is running. A tap anywhere on it opens the rest sheet, where the time
 * is adjusted or skipped.
 *
 * The ring shows the fraction remaining, so it starts full and empties
 * clockwise from 12 o'clock.
 */
export function RestRow({
  remaining,
  total,
  onPress,
}: {
  remaining: number;
  total: number;
  onPress: () => void;
}) {
  const c = useColors();
  const fraction = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Rest, ${mmss(remaining)} left`}
      accessibilityHint="Opens rest options"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Text style={[type.label, { color: c.accentText }]}>Rest</Text>

      <Svg width={RING} height={RING}>
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={R}
          stroke={c.text}
          strokeOpacity={0.15}
          strokeWidth={STROKE}
          fill="none"
        />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={R}
          stroke={c.accentText}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>

      <Text style={[type.restTime, { color: c.text }]}>{mmss(remaining)}</Text>

      <View style={styles.spacer} />

      <Text style={[type.meta, { color: c.text2 }]}>Edit</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.sm,
  },
  spacer: { flex: 1 },
  pressed: { opacity: 0.7 },
});
