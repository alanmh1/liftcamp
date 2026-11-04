import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

const DISMISS_HIT = 44;

/**
 * Above the rows of the first card given generated warm-ups, the first time
 * that happens for a user (lib/warmup-note.ts). Says why a row appeared and
 * where to turn it off.
 */
export function WarmupTip({ onDismiss }: { onDismiss: () => void }) {
  const c = useColors();

  return (
    <View style={[styles.tip, { backgroundColor: c.surface2 }]}>
      <Text style={[type.meta, styles.body, { color: c.text }]}>
        We added warm-up sets before your first working set. You can turn them off in Settings.
      </Text>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}>
        <Svg width={14} height={14} viewBox="0 0 14 14">
          <Path d="M2 2l10 10M12 2L2 12" stroke={c.text3} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radius.input,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
  },
  body: { flex: 1 },
  // A 44 pt target, pulled in so the cross sits level with the first line.
  dismiss: {
    width: DISMISS_HIT,
    height: DISMISS_HIT,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -spacing.md,
  },
  pressed: { opacity: 0.7 },
});
