import { SymbolView } from 'expo-symbols';
import { cleanPercent, KEYPAD_REPS_STEP, percentBase, percentWeight, signedPercent } from '@liftcamp/shared';
import { useEffect, useState, type RefObject } from 'react';
import { Platform, Pressable, StyleSheet, View, type TextInput as RNTextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, TextInput } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { mmss } from '@/components/workout/rest-row';
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

/** Every key, in every tray, so the tray keeps its height on the ±% toggle. */
const KEY_HEIGHT = 44;
/** Padding inside the tray, around the keys. */
const TRAY_PAD = 6;
const TRAY_HEIGHT = KEY_HEIGHT + TRAY_PAD * 2 + StyleSheet.hairlineWidth * 2;
/** Between groups of keys. */
const GAP = 6;
/** The hide key, the same width with or without a rest running. */
const HIDE_WIDTH = 56;
/** One half of the split stepper control; the control is two of them. */
const HALF_WIDTH = 44;
/** The line between the two halves, drawn over the join. */
const SPLIT_LINE = 1;
/** Percent mode's percent box. */
const PERCENT_WIDTH = 64;
/** ±% and Plates: squares. */
const TOOL_WIDTH = KEY_HEIGHT;
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
 * on it, sign and all. Kept in memory on purpose: a fresh launch starts
 * empty, on −.
 */
let lastApplied: { digits: string; sign: Sign } | null = null;

/** "1 minute 35 seconds", for VoiceOver, rounded up as `mmss` rounds. */
function spokenDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const parts: string[] = [];
  if (m > 0) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`);
  if (r > 0 || m === 0) parts.push(`${r} ${r === 1 ? 'second' : 'seconds'}`);
  return parts.join(' ');
}

/**
 * The tray above the numeric keypad. Every key is 44pt tall, keys sit
 * 6pt apart, and Next (or Done) is the only filled accent key; every other
 * key is the neutral fill with no border. Left to right:
 *
 * - The hide key, 56pt, in every tray. It puts the keypad away
 *   (`onDismiss`), keeping what was typed, and never logs a set. In
 *   percent mode it goes back to the steppers instead, keypad up, and
 *   with no rest running shows a back chevron. With no
 *   rest running it shows the keyboard-down symbol. While a rest runs
 *   (`restRemaining` set) it takes the light accent tint and shows a timer
 *   symbol and the time left ("1:35"; from 10:00 up, the time alone), from
 *   the screen's ticker and the rest's end time, the same figures the rest
 *   tray draws, so the two always agree. A tap then also shows the full
 *   rest tray, since the keypad is gone. When the rest ends it is the
 *   keyboard symbol again.
 * - On a weight or reps box, the steppers: one 88pt control, two fixed
 *   44pt halves split by a hairline. Labels are never shrunk.
 * - On a weight box, ±% and, when the screen passes `onPlates`, Plates:
 *   44pt squares.
 * - The action key, Next or Done, taking all the width left.
 *
 * A key that does not apply to a box is left out and the action key grows;
 * nothing else changes width. A cardio box gets the hide key and the
 * action key.
 *
 * ±% switches a weight box's tray to percent mode, which reads, left to
 * right: the hide key; a sign control in the steppers' 88pt, two 44pt
 * halves − and +, the chosen one in the light accent tint, the last
 * applied sign on entry (− with none); a
 * 64pt percent box that takes the keypad's focus, drawn as the focused
 * input; and a filled Use key in the rest of the width. ±% and Plates are
 * left out. Use reads "Use" and the weight it will write: the percent
 * applied, rounded to the exercise's weight step, or with nothing typed
 * the current weight. A tap writes it (`onPercent`) and moves on as Next
 * or Done does; it never logs a set and is never disabled. The weight box
 * keeps its focused look throughout, since `editing` on the screen still
 * names it. The hide key goes back to the steppers with the keypad up and
 * focus returned to the weight box (`onCancelPercent`), writing nothing
 * and leaving the remembered sign and percent as they were. Moving focus
 * anywhere else, the percent box losing focus, or a tap outside the tray
 * (which puts the keypad away) leave percent mode the same way. ±% itself
 * is disabled when the weight box has no value and no placeholder.
 *
 * Percent mode follows the percent box's focus, never keyboard events. A
 * keyboard that hides while the box keeps its focus (iOS swaps the
 * on-screen keyboard for a hardware one on the first key typed on it, as
 * in the Simulator) leaves percent mode open, with the tray on the bottom
 * safe-area inset, so the box is never unmounted under the user's typing.
 *
 * The action reads Next while another input follows in the same exercise
 * (weight to reps, reps to the next set's weight) and moves focus there; on
 * the last input it reads Done and dismisses. The screen decides which by
 * passing `hasNext`. Neither marks a set done; that is only ever the set's
 * check.
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
  onAdvance,
  onPlates,
  onDismiss,
  onCancelPercent,
  restRemaining = null,
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
  /** Percent mode's Use key: write this weight into the box, then advance as Next does. */
  onPercent: (weight: number) => void;
  /** Percent mode's hide key: give focus back to the weight box. */
  onCancelPercent: () => void;
  onAdvance: () => void;
  /**
   * Pro only, and only for a weight box on a barbell, EZ bar or Smith
   * machine: a Plates key after ±% that opens the plate calculator for the
   * box's value, or its placeholder when empty. Missing hides the key.
   */
  onPlates?: () => void;
  /** The hide key outside percent mode: put the keypad away, keeping the value. */
  onDismiss: () => void;
  /** Seconds left in the running rest, or null with no rest running. */
  restRemaining?: number | null;
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
  const insets = useSafeAreaInsets();
  const { unit } = useWeightUnit();
  // The box percent mode was opened on, so it never carries to another.
  const [percentFor, setPercentFor] = useState<string | null>(null);
  const [digits, setDigits] = useState('');
  const [sign, setSign] = useState<Sign>(-1);

  // A real dismissal clears the screen's `editing`, so `focusKey` covers it.
  useEffect(() => {
    setPercentFor(null);
  }, [focusKey]);

  const percent = field === 'weight' && percentFor != null && percentFor === focusKey;
  const keypad = Platform.OS === 'android' ? androidBottom : height > 0 ? height : null;
  const base = keypad ?? (percent ? insets.bottom : null);
  if (!field || base == null) return null;

  const step = field === 'weight' ? weightStep : KEYPAD_REPS_STEP;
  const label = (d: number) => `${d > 0 ? '+' : '−'}${Math.abs(d)}`;
  const from = percentBase(weightValue, weightPlaceholder, unit);
  const pct = signedPercent(sign, digits);
  const result = pct == null ? null : percentWeight(weightValue, weightPlaceholder, pct, unit, weightStep);
  const pressed = [styles.pressed, pressedFlat];
  const neutral = { backgroundColor: c.surface2 };

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

  // What Use writes: the percent applied, or with nothing typed the
  // current weight.
  const useWeight = result ?? from;

  function applyPercent() {
    if (result != null) lastApplied = { digits, sign };
    // The screen moves focus on (or puts the keypad away) before the
    // percent box unmounts. With no weight at all (it cannot open on
    // one), Use moves on as Next does, writing nothing.
    if (useWeight != null) onPercent(useWeight);
    else onAdvance();
    setPercentFor(null);
  }

  const resting = restRemaining != null;
  const restTime = resting ? mmss(restRemaining) : '';
  const hideKey = (
    <Pressable
      onPress={percent ? cancelPercent : onDismiss}
      accessibilityRole="button"
      accessibilityLabel={
        resting
          ? `Rest, ${spokenDuration(restRemaining)} left. ${percent ? 'Leaves percent mode.' : 'Hides the keypad.'}`
          : percent
            ? 'Leave percent mode'
            : 'Hide keypad'
      }
      style={({ pressed: p }) => [
        styles.key,
        styles.hide,
        { backgroundColor: resting ? c.accentSoft : c.surface2 },
        p && pressed,
      ]}>
      {resting ? (
        <View style={styles.restLine}>
          {/* From 10:00 up the time alone, so it fits the key. */}
          {restTime.length <= 4 ? (
            <SymbolView
              name={{ ios: 'timer', android: 'timer' }}
              size={12}
              weight="semibold"
              tintColor={c.accentText}
              fallback={null}
            />
          ) : null}
          <Text style={[styles.restText, { color: c.accentText }]} numberOfLines={1}>
            {restTime}
          </Text>
        </View>
      ) : (
        <SymbolView
          name={
            percent
              ? { ios: 'chevron.left', android: 'chevron_left' }
              : { ios: 'keyboard.chevron.compact.down', android: 'keyboard_hide' }
          }
          size={20}
          weight="semibold"
          tintColor={c.text}
          fallback={<Text style={[styles.keyText, { color: c.text }]}>{percent ? '‹' : '⌄'}</Text>}
        />
      )}
    </Pressable>
  );

  // Slightly darker than the fill, over the join between the two halves.
  const splitLine = (left: number) => (
    <View pointerEvents="none" style={[styles.splitLine, { left, backgroundColor: c.border }]} />
  );

  const steppers = (
    <View style={[styles.key, styles.split, neutral]}>
      {[-step, step].map((d) => (
        <Pressable
          key={d}
          onPress={() => onStep(d)}
          accessibilityRole="button"
          accessibilityLabel={`${d > 0 ? 'Add' : 'Subtract'} ${Math.abs(d)}`}
          style={({ pressed: p }) => [styles.half, p && pressed]}>
          <Text style={[styles.keyText, { color: c.text }]} numberOfLines={1}>
            {label(d)}
          </Text>
        </Pressable>
      ))}
      {splitLine(HALF_WIDTH - SPLIT_LINE / 2)}
    </View>
  );

  // The sign, in the steppers' 88pt so the hide key and the split
  // control stay where they are.
  const signControl = (
    <View style={[styles.key, styles.split, neutral]}>
      {([-1, 1] as const).map((v) => {
        const on = sign === v;
        return (
          <Pressable
            key={v}
            onPress={() => setSign(v)}
            accessibilityRole="button"
            accessibilityLabel={v === -1 ? 'Decrease' : 'Increase'}
            accessibilityState={{ selected: on }}
            style={({ pressed: p }) => [styles.half, on && { backgroundColor: c.accentSoft }, p && pressed]}>
            <Text style={[styles.keyText, { color: on ? c.accentText : c.text }]}>{v === -1 ? '−' : '+'}</Text>
          </Pressable>
        );
      })}
      {splitLine(HALF_WIDTH - SPLIT_LINE / 2)}
    </View>
  );

  // The focused input: the surface fill and an accent border.
  const percentBox = (
    <Pressable
      onPress={() => percentInputRef.current?.focus()}
      accessible={false}
      style={[styles.key, styles.percentBox, { backgroundColor: c.surface, borderColor: c.accent }]}>
      <View style={styles.percentLine}>
        <TextInput
          ref={percentInputRef}
          value={digits}
          onChangeText={(t) => setDigits(cleanPercent(t))}
          onBlur={() => setPercentFor(null)}
          autoFocus
          keyboardType="number-pad"
          maxLength={2}
          accessibilityLabel={`Percent to ${sign === -1 ? 'take off' : 'add'}`}
          style={[styles.keyText, styles.percentInput, { color: c.text }]}
        />
        <Text style={[styles.keyText, { color: digits ? c.text : c.text3 }]}>%</Text>
      </View>
    </Pressable>
  );

  const percentToggle = (
    <Pressable
      onPress={openPercent}
      disabled={from == null}
      accessibilityRole="button"
      accessibilityLabel="Adjust by percent"
      accessibilityState={{ disabled: from == null }}
      style={({ pressed: p }) => [styles.key, styles.tool, neutral, from == null && styles.disabled, p && pressed]}>
      <Text style={[styles.keyText, { color: c.text }]}>±%</Text>
    </Pressable>
  );

  const platesKey =
    field === 'weight' && !percent && onPlates ? (
      <Pressable
        onPress={onPlates}
        disabled={from == null}
        accessibilityRole="button"
        accessibilityLabel="Plates"
        accessibilityState={{ disabled: from == null }}
        style={({ pressed: p }) => [
          styles.key,
          styles.tool,
          neutral,
          from == null && styles.disabled,
          p && pressed,
        ]}>
        {/* A disc with a centre hole: SF Symbols has no plate, and this reads as one. */}
        <SymbolView
          name={{ ios: 'circle.circle', android: 'trip_origin' }}
          size={22}
          weight="semibold"
          tintColor={c.text}
          fallback={<Text style={[styles.keyText, { color: c.text }]}>◎</Text>}
        />
      </Pressable>
    ) : null;

  const advance = (
    <Pressable
      onPress={percent ? applyPercent : onAdvance}
      accessibilityRole="button"
      style={({ pressed: p }) => [styles.key, styles.advance, { backgroundColor: c.accent }, p && pressed]}>
      <Text style={[type.button, styles.advanceText, { color: '#FFFFFF' }]} numberOfLines={1}>
        {percent ? (useWeight != null ? `Use ${useWeight}` : 'Use') : hasNext ? 'Next' : 'Done'}
      </Text>
    </Pressable>
  );

  return (
    <View style={[styles.row, { bottom: base + LIFT }]} pointerEvents="box-none">
      <View
        style={[
          styles.tray,
          { backgroundColor: c.surface, borderColor: c.border },
          scheme === 'dark' ? styles.liftDark : styles.liftLight,
        ]}>
        {hideKey}
        {percent ? (
          <>
            {signControl}
            {percentBox}
          </>
        ) : (
          <>
            {steps(field) ? steppers : null}
            {field === 'weight' ? percentToggle : null}
            {platesKey}
          </>
        )}
        {advance}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Same side margins as the workout cards.
  row: {
    position: 'absolute',
    left: spacing.screen,
    right: spacing.screen,
  },
  tray: {
    height: TRAY_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    padding: TRAY_PAD,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  key: {
    height: KEY_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.input,
  },
  hide: { width: HIDE_WIDTH },
  tool: { width: TOOL_WIDTH },
  advance: { flex: 1, minWidth: 0, paddingHorizontal: spacing.sm },
  advanceText: tabular,
  // The stepper control, and percent mode's sign and box: one key, split.
  split: {
    width: HALF_WIDTH * 2,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  half: {
    width: HALF_WIDTH,
    height: KEY_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitLine: {
    position: 'absolute',
    top: spacing.md / 2,
    bottom: spacing.md / 2,
    width: SPLIT_LINE,
  },
  percentBox: {
    width: PERCENT_WIDTH,
    borderWidth: 1.5,
  },
  restLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  restText: {
    ...type.button,
    ...tabular,
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
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
});
