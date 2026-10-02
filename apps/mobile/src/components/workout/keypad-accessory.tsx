import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useKeyboard } from '@/lib/use-keyboard';
import { useTheme } from '@/theme/theme-provider';
import { pressedFlat, spacing, type } from '@/theme/tokens';

export type EditField = 'weight' | 'reps';

const KEY_HEIGHT = 42;
const BAR_PADDING = 6;

/**
 * How much the bar adds above the keyboard. The screen scrolls the focused
 * row clear of the keyboard plus this, since iOS knows nothing about a bar
 * that is not an InputAccessoryView.
 */
export const ACCESSORY_HEIGHT = KEY_HEIGHT + BAR_PADDING * 2;

/**
 * Colours lifted from the iOS keyboard itself rather than the app palette.
 *
 * The bar used to be surface2, and users read it as part of the screen and
 * never found Done. iOS's own decimal pad has no return key, so this bar is
 * the only way off it; it has to look attached to the keyboard. These are the
 * system keyboard's tray and key colours in each appearance.
 */
const KEYBOARD = {
  light: { tray: '#D1D3D9', key: '#FFFFFF', keyText: '#000000', keyShadow: '#898A8D' },
  dark: { tray: '#2B2B2D', key: '#6B6B6E', keyText: '#FFFFFF', keyShadow: '#000000' },
} as const;

/**
 * The bar above the numeric keypad: two steppers and one action key.
 *
 * The action reads Next while another input follows in the same exercise
 * (weight to reps, reps to the next set's weight) and moves focus there; on
 * the last input it reads Done and dismisses. The screen decides which by
 * passing `hasNext`.
 *
 * Positioned from the keyboard height rather than iOS's InputAccessoryView,
 * because Android has no equivalent. On iOS the bar sits on the keyboard's
 * height. On Android the screen passes `androidBottom`, from the measured
 * keyboard overlap, since the window there may or may not resize.
 */
export function KeypadAccessory({
  field,
  hasNext,
  onStep,
  onAdvance,
  androidBottom = null,
}: {
  field: EditField | null;
  hasNext: boolean;
  onStep: (delta: number) => void;
  onAdvance: () => void;
  /**
   * Android only: where the bar sits, in points up from the bottom of the
   * screen, worked out by the screen from the measured keyboard overlap.
   * Null hides the bar. iOS ignores it and sits on the keyboard's height.
   */
  androidBottom?: number | null;
}) {
  const { scheme, colors: c } = useTheme();
  const k = KEYBOARD[scheme];
  const { height } = useKeyboard();

  const bottom = Platform.OS === 'android' ? androidBottom : height;
  if (!field || bottom == null || (Platform.OS !== 'android' && height === 0)) return null;

  const step = field === 'weight' ? 2.5 : 1;
  const label = (d: number) => `${d > 0 ? '+' : '−'}${Math.abs(d)}`;

  return (
    <View style={[styles.bar, { bottom, backgroundColor: k.tray }]}>
      {[-step, step].map((d) => (
        <Pressable
          key={d}
          onPress={() => onStep(d)}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.key,
            { backgroundColor: k.key, shadowColor: k.keyShadow },
            pressed && [styles.pressed, pressedFlat],
          ]}>
          <Text style={[styles.keyText, { color: k.keyText }]}>{label(d)}</Text>
        </Pressable>
      ))}

      <View style={styles.spacer} />

      <Pressable
        onPress={onAdvance}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.key,
          styles.action,
          { backgroundColor: c.accent, shadowColor: k.keyShadow },
          pressed && [styles.pressed, pressedFlat],
        ]}>
        <Text style={[type.button, { color: '#FFFFFF' }]}>{hasNext ? 'Next' : 'Done'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: BAR_PADDING,
  },
  // Shaped like a keyboard key: 5pt radius, a hairline drop shadow, 42 tall.
  key: {
    minWidth: 64,
    height: KEY_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  keyText: {
    fontSize: 17,
    fontWeight: '500',
  },
  action: {
    minWidth: 88,
    paddingHorizontal: spacing.lg,
  },
  spacer: { flex: 1 },
  pressed: { opacity: 0.6 },
});
