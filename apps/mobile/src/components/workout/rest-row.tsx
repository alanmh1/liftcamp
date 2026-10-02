import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

const RING = 22;
const STROKE = 3;

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The rest ring: a track at 15% text and an accentText arc showing the
 * fraction remaining, so it starts full and empties clockwise from 12
 * o'clock. The row and the rest sheet draw the same ring at two sizes.
 */
export function RestRing({
  size,
  stroke,
  fraction,
}: {
  size: number;
  stroke: number;
  /** Remaining over total, 0 to 1. */
  fraction: number;
}) {
  const c = useColors();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={c.text}
        strokeOpacity={0.15}
        strokeWidth={stroke}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={c.accentText}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

/** Remaining over total for the ring, clamped to 0 to 1. */
export function restFraction(remaining: number, total: number): number {
  return total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
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

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Rest, ${mmss(remaining)} left`}
      accessibilityHint="Opens rest options"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Text style={[type.label, { color: c.accentText }]}>Rest</Text>

      <RestRing size={RING} stroke={STROKE} fraction={restFraction(remaining, total)} />

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
