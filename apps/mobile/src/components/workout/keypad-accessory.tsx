import { KEYPAD_REPS_STEP } from '@liftcamp/shared';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useKeyboard } from '@/lib/use-keyboard';
import { useTheme } from '@/theme/theme-provider';
import { palettes, pressedFlat, radius, spacing, tabular, type } from '@/theme/tokens';

/**
 * The boxes of a set row: weight and reps, or a cardio set's time and
 * distance, plus incline on a treadmill.
 */
export type EditField = 'weight' | 'reps' | 'time' | 'distance' | 'incline';

/** Cardio boxes have no steppers; a time, distance or incline is typed. */
function steps(field: EditField): boolean {
  return field === 'weight' || field === 'reps';
}

const KEY_HEIGHT = 44;
/** The gap between the top of the keyboard and the bottom of the row. */
const LIFT = spacing.sm;

/**
 * How much the row adds above the keyboard, the gap under it included. The
 * screen scrolls the focused row clear of the keyboard plus this, since iOS
 * knows nothing about a bar that is not an InputAccessoryView.
 */
export const ACCESSORY_HEIGHT = KEY_HEIGHT + LIFT;

/**
 * The row above the numeric keypad: two steppers and one action key, equal
 * widths, floating over the workout with no tray behind them. A cardio
 * time, distance or incline box gets the action key alone, in the same place. Each button
 * carries its own shadow (and a border on dark, where a shadow reads as
 * nothing) so it stands off whatever card is scrolled underneath.
 *
 * The action reads Next while another input follows in the same exercise
 * (weight to reps, reps to the next set's weight) and moves focus there; on
 * the last input it reads Done and dismisses. The screen decides which by
 * passing `hasNext`. iOS's own decimal pad has no return key, so this is the
 * only way off it.
 *
 * Positioned from the keyboard height rather than iOS's InputAccessoryView,
 * because Android has no equivalent. On iOS the row sits on the keyboard's
 * height. On Android the screen passes `androidBottom`, from the measured
 * keyboard overlap, since the window there may or may not resize.
 */
export function KeypadAccessory({
  field,
  weightStep,
  hasNext,
  onStep,
  onAdvance,
  androidBottom = null,
}: {
  field: EditField | null;
  /** One tap on a weight box, from the exercise's equipment (`keypadWeightStep`). */
  weightStep: number;
  hasNext: boolean;
  onStep: (delta: number) => void;
  onAdvance: () => void;
  /**
   * Android only: where the keyboard's top edge is, in points up from the
   * bottom of the screen, worked out by the screen from the measured
   * keyboard overlap. Null hides the row. iOS ignores it and sits on the
   * keyboard's height.
   */
  androidBottom?: number | null;
}) {
  const { scheme, colors: c } = useTheme();
  const { height } = useKeyboard();

  const base = Platform.OS === 'android' ? androidBottom : height;
  if (!field || base == null || (Platform.OS !== 'android' && height === 0)) return null;

  const step = field === 'weight' ? weightStep : KEYPAD_REPS_STEP;
  const label = (d: number) => `${d > 0 ? '+' : '−'}${Math.abs(d)}`;
  const lift = scheme === 'dark' ? [styles.liftDark, { borderColor: c.border }] : styles.liftLight;

  return (
    <View style={[styles.row, { bottom: base + LIFT }]} pointerEvents="box-none">
      {[-step, step].map((d) =>
        steps(field) ? (
          <Pressable
            key={d}
            onPress={() => onStep(d)}
            accessibilityRole="button"
            accessibilityLabel={`${d > 0 ? 'Add' : 'Subtract'} ${Math.abs(d)}`}
            style={({ pressed }) => [
              styles.key,
              lift,
              { backgroundColor: c.surface },
              pressed && [styles.pressed, pressedFlat],
            ]}>
            <Text style={[styles.keyText, { color: c.text }]}>{label(d)}</Text>
          </Pressable>
        ) : (
          // An empty slot, so the action key stays in its usual place.
          <View key={d} style={styles.key} pointerEvents="none" />
        ),
      )}

      <Pressable
        onPress={onAdvance}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.key,
          lift,
          { backgroundColor: c.accent },
          scheme === 'dark' && { borderColor: c.accent },
          pressed && [styles.pressed, pressedFlat],
        ]}>
        <Text style={[type.button, { color: '#FFFFFF' }]}>{hasNext ? 'Next' : 'Done'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Same side margins as the workout cards, same gap between every button.
  row: {
    position: 'absolute',
    left: spacing.screen,
    right: spacing.screen,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  key: {
    flex: 1,
    height: KEY_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.bar,
  },
  // Softer and wider than a card's, since it has to read over anything.
  liftLight: {
    shadowColor: palettes.light.text,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  liftDark: {
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  keyText: {
    ...type.button,
    fontSize: 17,
    ...tabular,
  },
  pressed: { opacity: 0.6 },
});
