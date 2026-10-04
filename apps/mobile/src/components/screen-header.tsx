import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

/**
 * The title row at the top of Home, History, Exercises, Workout and Profile, in
 * place of the native large title: the page title on the left and one
 * trailing control on the right, centred on the title, the way Finish
 * sits beside the workout name on the workout screen.
 *
 * It sits above the screen's scroll view, so it stays put and the content
 * scrolls under its bottom edge. The screen's own background, and the
 * top safe-area inset, are its own, so the screen needs no SafeAreaView.
 *
 * The title matches the native large title it replaced: Outfit Bold,
 * 34 pt, 16 pt from the leading edge. It keeps one line and shrinks to fit
 * before it would reach the trailing control, which never shrinks.
 */
export function ScreenHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.row, { paddingTop: insets.top + spacing.sm, backgroundColor: c.bg }]}>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        maxFontSizeMultiplier={TITLE_MAX_SCALE}
        style={[styles.title, { color: c.text }]}>
        {title}
      </Text>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

/**
 * The native large title did not grow with Dynamic Type in a custom face;
 * this one grows a little, and the one-line fit keeps it clear of the
 * trailing control at any size.
 */
const TITLE_MAX_SCALE = 1.3;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: 16,
    paddingBottom: spacing.sm,
  },
  title: { flex: 1, fontSize: 34, lineHeight: 41, fontWeight: '700' },
  trailing: { flexShrink: 0 },
});
