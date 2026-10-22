import { cleanPercent, KEYPAD_REPS_STEP, percentBase, percentWeight } from '@liftcamp/shared';
import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { Platform, Pressable, StyleSheet, View, type TextInput as RNTextInput } from 'react-native';

import { Text, TextInput } from '@/components/text';
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

type Sign = 1 | -1;

/**
 * The last percent applied, this app session only, so the next ±% opens
 * on it. Kept in memory on purpose: a fresh launch starts empty, on −.
 */
let lastApplied: { digits: string; sign: Sign } | null = null;

/**
 * The tray above the numeric keypad: one container holding the keypad's
 * pills. A weight box gets two steppers, a divider, ±% and the action key.
 * A reps box gets the steppers and the action key. A cardio time, distance
 * or incline box gets the action key alone, in a tray of its own in the
 * right-hand third. On light the tray carries a shadow so it stands off
 * whatever card is scrolled underneath.
 *
 * ±% switches a weight box's tray to percent mode: a sign pill (− or +), a
 * percent box that takes the keypad's focus, a live "100 → 75" preview,
 * and ±% again to go back with no change, focus returned to the weight
 * box. The weight box keeps its focused look throughout, since `editing`
 * on the screen still names it. The action key applies the percent
 * (`onPercent`): the screen writes the result, rounded to the exercise's
 * weight step, and then moves on as Next or Done does. It is disabled
 * while the percent box is empty. ±% itself is disabled when the weight
 * box has no value and no placeholder. Moving focus anywhere else or
 * putting the keypad away resets the tray to the steppers.
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
  percentInputRef,
  onStep,
  onPercent,
  onCancelPercent,
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
  /**
   * The percent box, so the screen can tell it holds the keypad's focus
   * when it checks whether any of its boxes do.
   */
  percentInputRef: RefObject<RNTextInput | null>;
  onStep: (delta: number) => void;
  /** Percent mode's action key: write this weight into the box, then advance as Next does. */
  onPercent: (weight: number) => void;
  /** Percent mode's ±%: give focus back to the weight box. */
  onCancelPercent: () => void;
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
  const { unit } = useWeightUnit();
  // The box percent mode was opened on, so it never carries to another.
  const [percentFor, setPercentFor] = useState<string | null>(null);
  const [digits, setDigits] = useState('');
  const [sign, setSign] = useState<Sign>(-1);

  const base = Platform.OS === 'android' ? androidBottom : height;
  const shown = field != null && base != null && (Platform.OS === 'android' || height > 0);

  useEffect(() => {
    setPercentFor(null);
  }, [focusKey, shown]);

  if (!field || !shown || base == null) return null;

  const percent = field === 'weight' && percentFor != null && percentFor === focusKey;
  const step = field === 'weight' ? weightStep : KEYPAD_REPS_STEP;
  const label = (d: number) => `${d > 0 ? '+' : '−'}${Math.abs(d)}`;
  const from = percentBase(weightValue, weightPlaceholder, unit);
  const result = digits === '' ? null : percentWeight(weightValue, weightPlaceholder, (sign * Number(digits)) / 100, unit, weightStep);
  const tray = [
    styles.tray,
    { backgroundColor: c.surface, borderColor: c.border },
    scheme === 'dark' ? styles.liftDark : styles.liftLight,
  ];
  const pressed = [styles.pressed, pressedFlat];

  function openPercent() {
    setDigits(lastApplied?.digits ?? '');
    setSign(lastApplied?.sign ?? -1);
    setPercentFor(focusKey);
  }

  function cancelPercent() {
    // Focus first, so the keypad has a box to stay on when the percent box
    // unmounts.
    onCancelPercent();
    setPercentFor(null);
  }

  function applyPercent() {
    if (result == null) return;
    lastApplied = { digits, sign };
    // The screen moves focus on (or puts the keypad away) before the
    // percent box unmounts.
    onPercent(result);
    setPercentFor(null);
  }

  const percentToggle = (
    <Pressable
      key="toggle"
      onPress={percent ? cancelPercent : openPercent}
      disabled={!percent && from == null}
      accessibilityRole="button"
      accessibilityLabel={percent ? 'Cancel percent' : 'Adjust by percent'}
      accessibilityState={{ expanded: percent, disabled: !percent && from == null }}
      style={({ pressed: p }) => [
        styles.pill,
        percent ? { backgroundColor: c.accent } : [styles.outline, { borderColor: c.accent }],
        !percent && from == null && styles.disabled,
        p && pressed,
      ]}>
      <Text style={[styles.keyText, { color: percent ? '#FFFFFF' : c.accentText }]}>±%</Text>
    </Pressable>
  );

  const divider = <View key="divider" style={[styles.divider, { backgroundColor: c.border }]} />;

  const advanceDisabled = percent && result == null;
  const advance = (
    <Pressable
      key="advance"
      onPress={percent ? applyPercent : onAdvance}
      disabled={advanceDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: advanceDisabled }}
      style={({ pressed: p }) => [
        styles.pill,
        { backgroundColor: c.accent },
        advanceDisabled && styles.disabled,
        p && pressed,
      ]}>
      <Text style={[type.button, { color: '#FFFFFF' }]}>{hasNext ? 'Next' : 'Done'}</Text>
    </Pressable>
  );

  let content: ReactNode;
  if (!steps(field)) {
    content = advance;
  } else if (percent) {
    content = [
      // The sign and the percent box share the steppers' two slots, so ±%
      // and Next stay where they are.
      <View key="left" style={styles.pair}>
        <Pressable
          onPress={() => setSign((s) => (s === -1 ? 1 : -1))}
          accessibilityRole="button"
          accessibilityLabel={sign === -1 ? 'Decrease. Switch to increase' : 'Increase. Switch to decrease'}
          style={({ pressed: p }) => [styles.pill, styles.sign, { backgroundColor: c.surface2 }, p && pressed]}>
          <Text style={[styles.keyText, { color: c.text }]}>{sign === -1 ? '−' : '+'}</Text>
        </Pressable>
        <Pressable
          onPress={() => percentInputRef.current?.focus()}
          accessible={false}
          style={[styles.pill, { backgroundColor: c.surface2 }]}>
          <View style={styles.percentLine}>
            <TextInput
              ref={percentInputRef}
              value={digits}
              onChangeText={(t) => setDigits(cleanPercent(t))}
              onBlur={() => setPercentFor(null)}
              autoFocus
              keyboardType="number-pad"
              maxLength={2}
              placeholder="0"
              placeholderTextColor={c.text3}
              accessibilityLabel={`Percent to ${sign === -1 ? 'take off' : 'add'}`}
              style={[styles.keyText, styles.percentInput, { color: c.text }]}
            />
            <Text style={[styles.keyText, { color: c.text }]}>%</Text>
          </View>
          <Text style={[styles.preview, { color: c.text2 }]} numberOfLines={1}>
            {`${from ?? ''} → ${result ?? ''}`}
          </Text>
        </Pressable>
      </View>,
      divider,
      percentToggle,
      advance,
    ];
  } else {
    content = [
      <View key="left" style={styles.pair}>
        {[-step, step].map((d) => (
          <Pressable
            key={d}
            onPress={() => onStep(d)}
            accessibilityRole="button"
            accessibilityLabel={`${d > 0 ? 'Add' : 'Subtract'} ${Math.abs(d)}`}
            style={({ pressed: p }) => [styles.pill, { backgroundColor: c.surface2 }, p && pressed]}>
            <Text style={[styles.keyText, { color: c.text }]}>{label(d)}</Text>
          </Pressable>
        ))}
      </View>,
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
  // Two slots wide, holding the steppers or the sign and the percent box.
  pair: {
    flex: 2,
    flexDirection: 'row',
    gap: TRAY_PAD,
  },
  pill: {
    flex: 1,
    height: PILL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.input,
  },
  sign: {
    flex: 0,
    width: PILL_HEIGHT,
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
  percentLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  percentInput: {
    minWidth: 22,
    padding: 0,
    textAlign: 'right',
    lineHeight: 21,
  },
  preview: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    ...tabular,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
});
