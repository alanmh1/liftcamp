import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing } from '@/theme/tokens';

/** Pads the 26 pt chip's hit area to 44 pt, as the progression chip does. */
const HIT_SLOP = { top: 9, bottom: 9, left: 6, right: 6 };

/**
 * Where a free user's progression chip would be, once Pro is on sale:
 * the same size and place, with a lock. Tapping it opens the paywall.
 */
export function ProLockChip({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useTheme().colors;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={`${label}. LiftCamp Pro`}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: c.surface2, borderColor: c.border },
        pressed && styles.pressed,
      ]}>
      <SymbolView name={{ ios: 'lock.fill', android: 'lock' }} size={11} tintColor={c.text2} />
      <Text style={[styles.label, { color: c.text2 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 1,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  label: { fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
