import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { TipIcon } from '@/components/exercise-steps';
import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing } from '@/theme/tokens';

const DISMISS_HIT = 44;

/**
 * The one style for an in-app tip: the amber lightbulb from exercise steps,
 * a `tipSoft` fill and `tipText` body, with a dismiss cross on the right.
 * Used by the warm-up tip and the first-session banner. Workout notes, undo
 * toasts, the What's new card and set-row hints keep their own styles.
 */
export function TipNote({ children, onDismiss }: { children: ReactNode; onDismiss: () => void }) {
  const c = useColors();

  return (
    <View style={[styles.tip, { backgroundColor: c.tipSoft }]}>
      <TipIcon color={c.tip} />
      <Text style={[styles.body, { color: c.tipText }]}>{children}</Text>
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
  // No right padding: the dismiss target fills that corner.
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radius.input,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
  },
  // Same size as the exercise steps' tip lines, so TipIcon's 3 pt top
  // margin centres it on the first line.
  body: { flex: 1, fontSize: 15, lineHeight: 22 },
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
