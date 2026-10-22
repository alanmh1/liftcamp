import { KEYPAD_REPS_STEP, PERCENT_STEPS, percentWeight } from '@liftcamp/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
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

/** Every pill, in both modes, so the tray keeps its height on the ±% toggle. */
const PILL_HEIGHT = 44;
/** Padding inside the tray, around the pills. */
const TRAY_PAD = 6;
const TRAY_HEIGHT = PILL_HEIGHT + TRAY_PAD * 2 + StyleSheet.hairlineWidth * 2;
/** The gap between the top of the keyboard and the bottom of the tray. */
const LIFT = spacing.sm;

/**
 * How much the tray adds above the keyboard, the gap under it included. The
 * screen scrolls the focused row clear of the keyboard plus this, since iOS
 * knows nothing about a bar that is not an InputAccessoryView.
 */
export const ACCESSORY_HEIGHT = Math.ceil(TRAY_HEIGHT) + LIFT;

/** "−25%" */
function pctLabel(pct: number): string {
  return `${pct > 0 ? '+' : '−'}${Math.round(Math.abs(pct) * 100)}%`;
}

/**
 * The tray above the numeric keypad: one container holding the keypad's
 * pills. A weight box gets two steppers, a divider, ±% and the action key.
 * A reps box gets the steppers and the action key. A cardio time, distance
 * or incline box gets the action key alone, in a tray of its own in the
 * right-hand third. On light the tray carries a shadow so it stands off
 * whatever card is scrolled underneath.
 *
 * ±% switches a weight box's tray to percent mode: three chips that take
 * 30, 25 or 20 percent off the box (its placeholder when empty), each
 * showing the result rounded to the exercise's weight step, then ±% again
 * in the action key's slot to switch back. A chip writes its weight and
 * moves on as Next does (`onPercent`). With nothing to work from the chips
 * show disabled. Moving focus or putting the keypad away resets the tray to
 * the steppers.
 *
 * The action reads Next while another input follows in the same exercise
 * (weight to reps, reps to the next set's weight) and moves focus there; on
 * the last input it reads Done and dismisses. The screen decides which by
 * passing `hasNext`. iOS's own decimal pad has no return key, so this is the
 * only way off it.
 *
 * Positioned from the keyboard height rather than iOS's InputAccessoryView,
 * because Android has no equivalent. On iOS the tray sits on the keyboard's
 * height. On Android the screen passes `androidBottom`, from the measured
 * keyboard overlap, since the window there may or may not resize.
 */
export function KeypadAccessory({
  field,
  focusKey,
  weightStep,
  weightValue,
  weightPlaceholder,
  hasNext,
  onStep,
  onPercent,
  onAdvance,
  androidBottom = null,
}: {
  field: EditField | null;
  /** The focused box, as `<setId>:<field>`. A change resets percent mode. */
  focusKey: string | null;
  /** One tap on a weight box, from the exercise's equipment (`keypadWeightStep`). */
  weightStep: number;
  /** The focused weight box's value, and the placeholder it shows when empty. */
  weightValue: number | null;
  weightPlaceholder: number | null;
  hasNext: boolean;
  onStep: (delta: number) => void;
  /** A percent chip: write this weight into the box, then advance as Next does. */
  onPercent: (weight: number) => void;
  onAdvance: () => void;
  /**
   * Android only: where the keyboard's top edge is, in points up from the
   * bottom of the screen, worked out by the screen from the measured
   * keyboard overlap. Null hides the tray. iOS ignores it and sits on the
   * keyboard's height.
   */
  androidBottom?: number | null;
}) {
  const { scheme, colors: c } = useTheme();
  const { height } = useKeyboard();
  const { unit, label: unitLabel } = useWeightUnit();
  // The box percent mode was opened on, so it never carries to another.
  const [percentFor, setPercentFor] = useState<string | null>(null);

  const base = Platform.OS === 'android' ? androidBottom : height;
  const shown = field != null && base != null && (Platform.OS === 'android' || height > 0);

  useEffect(() => {
    setPercentFor(null);
  }, [focusKey, shown]);

  if (!field || !shown || base == null) return null;

  const percent = field === 'weight' && percentFor != null && percentFor === focusKey;
  const step = field === 'weight' ? weightStep : KEYPAD_REPS_STEP;
  const label = (d: number) => `${d > 0 ? '+' : '−'}${Math.abs(d)}`;
  const tray = [
    styles.tray,
    { backgroundColor: c.surface, borderColor: c.border },
    scheme === 'dark' ? styles.liftDark : styles.liftLight,
  ];
  const pressed = [styles.pressed, pressedFlat];

  const percentToggle = (
    <Pressable
      key="toggle"
      onPress={() => setPercentFor(percent ? null : focusKey)}
      accessibilityRole="button"
      accessibilityLabel={percent ? 'Back to steppers' : 'Adjust by percent'}
      accessibilityState={{ expanded: percent }}
      style={({ pressed: p }) => [
        styles.pill,
        percent ? { backgroundColor: c.accent } : [styles.outline, { borderColor: c.accent }],
        p && pressed,
      ]}>
      <Text style={[styles.keyText, { color: percent ? '#FFFFFF' : c.accentText }]}>±%</Text>
    </Pressable>
  );

  const divider = <View key="divider" style={[styles.divider, { backgroundColor: c.border }]} />;

  const advance = (
    <Pressable
      key="advance"
      onPress={onAdvance}
      accessibilityRole="button"
      style={({ pressed: p }) => [styles.pill, { backgroundColor: c.accent }, p && pressed]}>
      <Text style={[type.button, { color: '#FFFFFF' }]}>{hasNext ? 'Next' : 'Done'}</Text>
    </Pressable>
  );

  let content: ReactNode;
  if (!steps(field)) {
    content = advance;
  } else if (percent) {
    content = [
      ...PERCENT_STEPS.map((pct) => {
        const result = percentWeight(weightValue, weightPlaceholder, pct, unit, weightStep);
        const spoken = `${Math.round(Math.abs(pct) * 100)} percent less`;
        return (
          <Pressable
            key={pct}
            disabled={result == null}
            onPress={() => {
              if (result == null) return;
              setPercentFor(null);
              onPercent(result);
            }}
            accessibilityRole="button"
            accessibilityLabel={result == null ? spoken : `${spoken}, ${result} ${unitLabel}`}
            accessibilityState={{ disabled: result == null }}
            style={({ pressed: p }) => [
              styles.pill,
              { backgroundColor: c.surface2 },
              result == null && styles.disabled,
              p && pressed,
            ]}>
            <Text style={[styles.chipPct, { color: c.text2 }]}>{pctLabel(pct)}</Text>
            <Text style={[styles.chipWeight, { color: c.text }]}>{result ?? '–'}</Text>
          </Pressable>
        );
      }),
      divider,
      percentToggle,
    ];
  } else {
    content = [
      ...[-step, step].map((d) => (
        <Pressable
          key={d}
          onPress={() => onStep(d)}
          accessibilityRole="button"
          accessibilityLabel={`${d > 0 ? 'Add' : 'Subtract'} ${Math.abs(d)}`}
          style={({ pressed: p }) => [styles.pill, { backgroundColor: c.surface2 }, p && pressed]}>
          <Text style={[styles.keyText, { color: c.text }]}>{label(d)}</Text>
        </Pressable>
      )),
      ...(field === 'weight' ? [divider, percentToggle] : []),
      advance,
    ];
  }

  return (
    <View style={[styles.row, { bottom: base + LIFT }]} pointerEvents="box-none">
      {steps(field) ? (
        <View style={[tray, styles.fill]}>{content}</View>
      ) : (
        // Empty slots, so the action key stays in the right-hand third.
        <>
          <View style={styles.fill} pointerEvents="none" />
          <View style={styles.fill} pointerEvents="none" />
          <View style={[tray, styles.fill]}>{content}</View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Same side margins as the workout cards.
  row: {
    position: 'absolute',
    left: spacing.screen,
    right: spacing.screen,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tray: {
    height: TRAY_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: TRAY_PAD,
    padding: TRAY_PAD,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fill: { flex: 1 },
  pill: {
    flex: 1,
    height: PILL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.input,
  },
  outline: { borderWidth: 1 },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: PILL_HEIGHT - spacing.md,
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
  chipPct: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    ...tabular,
  },
  chipWeight: {
    ...type.button,
    lineHeight: 19,
    ...tabular,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
});
