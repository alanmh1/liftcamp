import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/**
 * A small heading action: `accentSoft` fill, `accentText` label, 14 pt
 * semibold, about 30 pt tall, fully rounded. See All and Your rotation's
 * Edit on the Workout tab, and Reorder in the routine builder.
 */
export function SoftPill({
  label,
  onPress,
  accessibilityLabel,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={PILL_SLOP}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.pill, { backgroundColor: c.accentSoft }, pressed && styles.pressed]}>
      <Text style={[type.button, styles.label, { color: c.accentText }]}>{label}</Text>
    </Pressable>
  );
}

/** 30 pt tall plus 7 above and below: a 44 pt target. Sideways too, for a short label. */
const PILL_SLOP = { top: 7, bottom: 7, left: 7, right: 7 };

const styles = StyleSheet.create({
  // About 30 pt tall: an 18 pt line of 14 pt text, centred in a 30 pt minimum.
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
