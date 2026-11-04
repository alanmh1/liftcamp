import {
  asWeightUnit,
  cleanDecimal,
  cleanIncline,
  distanceToMeters,
  formatCardioSet,
  formatCardioTime,
  formatPreviousSet,
  formatTimerDigits,
  isWarmupSet,
  parseDecimal,
  secondsToTimerDigits,
  tidyDistance,
  tidyIncline,
  tidyWeight,
  timerDigits,
  timerSeconds,
  type PriorSet,
} from '@liftcamp/shared';
import { useRef, useState } from 'react';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { Text, TextInput } from '@/components/text';
import { PrRibbon } from '@/components/workout/pr-ribbon';
import type { EditField } from '@/components/workout/keypad-accessory';
import { useColors } from '@/theme/theme-provider';
import { COLUMNS, radius, spacing, type } from '@/theme/tokens';
import type { WorkoutSet } from '@/data/workouts';

export type SetState = 'pending' | 'active' | 'done';

const ROW_HEIGHT = 60;

/**
 * Height of the weight and reps boxes, and of the swipe Delete action.
 *
 * One constant for both: Delete sits alongside the inputs when a row is open,
 * so any drift between the two reads as a misalignment.
 */
const INPUT_HEIGHT = 44;

/**
 * Column widths, as flex, for a cardio row with an incline box: Previous
 * and three boxes between the set and done columns. On an iPhone SE
 * (375 pt) those leave 227 pt; at 0.9 for Previous and 1 for each box,
 * a box is 58 pt and its input 53 pt at INCLINE_INPUT_WIDTH, room for
 * "25:00" in the set numeral style (about 49 pt with the border).
 * Previous gets 52 pt, enough for its "PREVIOUS" header, and truncates
 * its line, as it already does for a long one in the two-box layout. The
 * exercise card's column headers use the same values.
 */
export const INCLINE_FLEX = { previous: 0.9, box: 1 } as const;

/** An input's share of its column in an incline row; 86% elsewhere. */
const INCLINE_INPUT_WIDTH = '92%';

/** The check box, and the 44pt target it sits in. */
const CHECK_SIZE = 25;
const CHECK_TARGET = 44;

/** Drag this far across the row and the delete commits without a tap. */
const FULL_SWIPE = 0.6;

/**
 * The revealed Delete action.
 *
 * Two ways to delete, matching iOS: a short swipe parks the button and you tap
 * it, or you keep dragging past FULL_SWIPE of the row width and it commits on
 * its own. Neither confirms on a set; the undo toast is the safety net. A
 * History workout row uses it too, with its own sizes, and confirms.
 */
export function DeleteAction({
  translation,
  rowWidth,
  color,
  onDelete,
  wrapStyle,
  actionStyle,
}: {
  translation: SharedValue<number>;
  rowWidth: number;
  color: string;
  onDelete: () => void;
  wrapStyle?: StyleProp<ViewStyle>;
  actionStyle?: StyleProp<ViewStyle>;
}) {
  // Guards against firing twice while the finger is still down.
  const fired = useSharedValue(false);

  useAnimatedReaction(
    () => translation.value,
    (t) => {
      // Re-arms once the row is closed again, for a row that survives the
      // swipe (a workout whose delete was cancelled).
      if (t > -1) fired.value = false;
      if (fired.value || rowWidth <= 0) return;
      if (-t >= rowWidth * FULL_SWIPE) {
        fired.value = true;
        runOnJS(onDelete)();
      }
    },
  );

  return (
    <View style={[styles.actionWrap, wrapStyle]}>
      <Pressable
        accessibilityRole="button"
        onPress={onDelete}
        style={({ pressed }) => [
          styles.deleteAction,
          actionStyle,
          { backgroundColor: color },
          pressed && styles.pressed,
        ]}>
        <Text style={[type.button, styles.deleteLabel]}>Delete</Text>
      </Pressable>
    </View>
  );
}

/** A set logged in the other unit arrives converted and prints rounded to 0.1. */
function fmt(n: number | null, unit: string): string {
  const v = tidyWeight(n, asWeightUnit(unit));
  return v == null ? '' : String(v);
}

/**
 * What a typed box shows while it has the cursor, so "68." keeps its dot
 * and a typed comma stays a comma. Every keystroke still saves the number.
 * An outside change (the +/- bar, a placeholder fill) is the saved number
 * moving to one this row did not send; the draft is dropped and the box
 * shows the saved number. The draft is never compared with the saved
 * number, which may land a render after the keystroke. Blur clears the
 * draft and the box prints the saved number: "68." reads 68, "68,5" reads
 * 68.5. The weight, distance, incline and time boxes all work this way.
 */
function useBoxDraft(saved: number | null) {
  const [draft, setDraft] = useState<string | null>(null);
  // undefined: nothing sent since the box took focus.
  const lastSent = useRef<number | null | undefined>(undefined);
  const seen = useRef(saved);
  let current = draft;
  if (saved !== seen.current) {
    seen.current = saved;
    if (saved !== lastSent.current && draft != null) {
      current = null;
      lastSent.current = undefined;
      setDraft(null);
    }
  }
  return {
    draft: current,
    /** A keystroke: what the box now shows, and the number it saves. */
    typed(text: string, sent: number | null) {
      setDraft(text);
      lastSent.current = sent;
    },
    clear() {
      setDraft(null);
      lastSent.current = undefined;
    },
  };
}

/**
 * The most a focused time box holds: five timer digits and the colon,
 * "999:99". A sixth digit is refused by the box itself, so it never shows.
 */
const TIME_MAX_LENGTH = 6;

/**
 * A key that remounts a box on Android when its placeholder changes.
 *
 * Android draws a box's placeholder only if the box had it when it
 * mounted. One that arrives later never shows: set 1 stepped or typed to
 * 120 left sets 2 and 3 blank on Android while they printed 120 on iOS,
 * though the screen passed them "120". A box mounted with its placeholder
 * already in place draws it, so the box remounts on each change. Never
 * while it has the cursor, which a remount would drop; the box catches up
 * once it loses focus. Undefined on iOS, which draws the change in place.
 */
function usePlaceholderKey(placeholder: string | undefined, focused: boolean): string | undefined {
  const key = useRef(placeholder ?? '');
  if (!focused) key.current = placeholder ?? '';
  return Platform.OS === 'android' ? key.current : undefined;
}

export function SetRow({
  set,
  index,
  label,
  state,
  prior,
  exercise,
  unit,
  weightPlaceholder = '',
  repsPlaceholder = '',
  cardio = false,
  timePlaceholder = '',
  distancePlaceholder = '',
  incline = false,
  inclinePlaceholder = '',
  isPr,
  onEdit,
  onChange,
  onToggleDone,
  onDelete,
  registerInput,
  hint = null,
  hintLink = null,
  focusedField = null,
  onLongPressWeight,
  onOpenSetType,
}: {
  set: WorkoutSet;
  index: number;
  /**
   * Pro, bar exercises only: a long press on a done set's weight opens the
   * plate calculator for it. A tap still edits the weight.
   */
  onLongPressWeight?: () => void;
  /** Pro: a tap on the badge opens the set type sheet. Without it the badge is not tappable. */
  onOpenSetType?: () => void;
  /** The badge: "W" for a Pro warm-up row, else its working-set number. Defaults to `index + 1`. */
  label?: string;
  state: SetState;
  prior: PriorSet | null;
  /** For the Previous column: a bodyweight set reads "BW × 12", "BW +10 × 12". */
  exercise: { weight_type: string | null; equipment: string | null };
  unit: string;
  /**
   * What an empty weight box shows in gray: the placeholder weight, "BW" for
   * a no-equipment exercise, or nothing.
   */
  weightPlaceholder?: string;
  /** What an empty reps box shows in gray, or nothing. */
  repsPlaceholder?: string;
  /**
   * A cardio set: a time box and a distance box (km or mi, from `unit`)
   * instead of weight and reps, and the Previous column reads
   * "25:00 · 3.2 km".
   */
  cardio?: boolean;
  /** What an empty time box shows in gray, as mm:ss, or nothing. */
  timePlaceholder?: string;
  /** What an empty distance box shows in gray, in km or mi, or nothing. */
  distancePlaceholder?: string;
  /**
   * A cardio set on an exercise with an incline (the treadmills): a third
   * box after distance, in percent, and a narrower Previous column.
   */
  incline?: boolean;
  /** What an empty incline box shows in gray, as a percent number, or nothing. */
  inclinePlaceholder?: string;
  isPr: boolean;
  onEdit: (field: EditField) => void;
  onChange: (field: EditField, raw: string) => void;
  onToggleDone: () => void;
  onDelete: () => void;
  /** Hands each input's ref up so the keypad bar's Next can focus it. */
  registerInput: (field: EditField, input: TextInput | null) => void;
  /**
   * A line under the row, from the weight column on. The screen sets it when
   * a check is refused for want of a weight, so the tap is never silent.
   */
  hint?: string | null;
  /**
   * A second, tappable line under the hint: the way to the info sheet's
   * Starting weight when an exercise's first weight is refused.
   */
  hintLink?: { label: string; onPress: () => void } | null;
  /** The box in this row with the cursor, if any. Only it gets the outline. */
  focusedField?: EditField | null;
}) {
  const c = useColors();
  const [rowWidth, setRowWidth] = useState(0);
  const done = state === 'done';
  const weightInput = useRef<TextInput | null>(null);

  // A warm-up row reads as lighter than the working sets until it is done:
  // its badge stays gray even as the next set up, and its numerals are muted.
  const warmup = isWarmupSet(set);
  const muted = warmup && !done;

  // Pending: gray badge, text2 number. Active: accent badge. Done: green
  // badge. Active and done both print the number in white; the tick lives in
  // the check box only.
  const badgeFill = state === 'pending' || muted ? c.surface2 : state === 'active' ? c.accent : c.success;
  const numberColor = muted ? c.text3 : state === 'pending' ? c.text2 : '#FFFFFF';
  const setLabel = label ?? index + 1;

  // A done set's values sit straight on the green band, in bold. The set
  // up next is marked by its blue number alone; the accent outline is the
  // focus ring, drawn only on the box with the cursor, so a row never looks
  // focused when it is not. Every box keeps a 2pt border in every state and
  // only its color changes, so nothing inside shifts when a box takes focus.
  const restingStyle =
    state === 'done'
      ? { backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 2 }
      : { backgroundColor: c.inputFill, borderColor: c.border, borderWidth: 2 };
  const focusStyle = { backgroundColor: c.inputFill, borderColor: c.accentText, borderWidth: 2 };
  const weightUnit = asWeightUnit(unit);
  const weight = useBoxDraft(set.weight_value);
  const weightText = weight.draft ?? fmt(set.weight_value, unit);
  // A distance is typed in km or mi and saved in meters.
  const distance = useBoxDraft(set.distance_meters ?? null);
  const distanceText = distance.draft ?? tidyDistance(set.distance_meters, weightUnit);
  // An incline is a percent, the same number in kg and lb.
  const inclineBox = useBoxDraft(set.incline_percent ?? null);
  const inclineText = inclineBox.draft ?? tidyIncline(set.incline_percent);
  const withIncline = cardio && incline;
  // A time is typed like a timer, its digits filling from the right: the
  // draft is the digits. Focused, it reads in minutes ("75:00"); otherwise
  // mm:ss, or h:mm:ss from an hour.
  const time = useBoxDraft(set.duration_seconds ?? null);
  const timeText =
    time.draft != null
      ? formatTimerDigits(time.draft)
      : focusedField === 'time'
        ? formatTimerDigits(secondsToTimerDigits(set.duration_seconds))
        : formatCardioTime(set.duration_seconds);

  const weightKey = usePlaceholderKey(weightPlaceholder, focusedField === 'weight');
  const repsKey = usePlaceholderKey(repsPlaceholder, focusedField === 'reps');
  const timeKey = usePlaceholderKey(timePlaceholder, focusedField === 'time');
  const distanceKey = usePlaceholderKey(distancePlaceholder, focusedField === 'distance');
  const inclineKey = usePlaceholderKey(inclinePlaceholder, focusedField === 'incline');
  const inputText = (field: EditField) => [
    styles.input,
    withIncline && styles.inclineInput,
    type.setNumeral,
    focusedField === field ? focusStyle : restingStyle,
    { color: muted && focusedField !== field ? c.text3 : state === 'pending' ? c.text2 : c.text },
    done && styles.bold,
  ];
  const previous = cardio
    ? (formatCardioSet(prior, weightUnit) ?? '—')
    : formatPreviousSet(prior, weightUnit, exercise);

  return (
    <Swipeable
      // friction 1 means the row tracks the finger exactly. At 2 the row moves
      // half as far as the drag, so reaching 60% of the row width would take a
      // 120% drag and the full swipe could never fire.
      friction={1}
      rightThreshold={40}
      // The row bleeds through the card padding so a done set's band spans
      // the card edge to edge, then pads back so the columns stay put. The
      // container clips, so the bleed has to be on it, not on the child.
      containerStyle={styles.bleed}
      childrenContainerStyle={[styles.padBack, done && { backgroundColor: c.successTint }]}
      renderRightActions={(_progress, translation) => (
        <DeleteAction
          translation={translation}
          rowWidth={rowWidth}
          color={c.danger}
          onDelete={onDelete}
        />
      )}>
      <View>
        <View
          onLayout={(e: LayoutChangeEvent) => setRowWidth(e.nativeEvent.layout.width)}
          style={styles.row}>
          <Pressable
            onPress={onOpenSetType}
            disabled={!onOpenSetType}
            accessible={warmup || onOpenSetType != null}
            accessibilityRole={onOpenSetType ? 'button' : undefined}
            accessibilityLabel={warmup ? 'Warm-up set' : onOpenSetType ? `Set ${setLabel}` : undefined}
            accessibilityHint={onOpenSetType ? 'Change the set type' : undefined}
            style={({ pressed }) => [styles.cell, styles.setCell, styles.setTap, pressed && styles.pressed]}>
            <View style={[styles.circle, { backgroundColor: badgeFill }]}>
              <Text style={[type.prevNumeral, { color: numberColor }, state !== 'pending' && !muted && styles.bold]}>
                {setLabel}
              </Text>
            </View>
          </Pressable>

          <View style={[styles.cell, withIncline ? styles.inclinePrev : styles.third, styles.prevCell]}>
            <Text style={[type.prevNumeral, { color: c.text3 }]} numberOfLines={1}>
              {warmup && previous === '—' ? 'Warm-up' : previous}
            </Text>
            {isPr ? <PrRibbon size={18} /> : null}
          </View>

          {cardio ? (
            <>
              <View style={[styles.cell, withIncline ? styles.inclineBox : styles.third]}>
                <TextInput
                  key={timeKey}
                  ref={(r) => registerInput('time', r)}
                  value={timeText}
                  onFocus={() => onEdit('time')}
                  onBlur={time.clear}
                  onChangeText={(t) => {
                    const digits = timerDigits(t);
                    time.typed(digits, timerSeconds(digits));
                    onChange('time', digits);
                  }}
                  keyboardType="number-pad"
                  maxLength={TIME_MAX_LENGTH}
                  selectTextOnFocus
                  placeholder={timePlaceholder}
                  placeholderTextColor={c.text3}
                  style={inputText('time')}
                />
              </View>

              <View style={[styles.cell, withIncline ? styles.inclineBox : styles.third]}>
                <TextInput
                  key={distanceKey}
                  ref={(r) => registerInput('distance', r)}
                  value={distanceText}
                  onFocus={() => onEdit('distance')}
                  onBlur={distance.clear}
                  onChangeText={(t) => {
                    const next = cleanDecimal(t, 2);
                    distance.typed(next, distanceToMeters(parseDecimal(next), weightUnit));
                    onChange('distance', next);
                  }}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  placeholder={distancePlaceholder}
                  placeholderTextColor={c.text3}
                  style={inputText('distance')}
                />
              </View>

              {withIncline ? (
                <View style={[styles.cell, styles.inclineBox]}>
                  <TextInput
                    key={inclineKey}
                    ref={(r) => registerInput('incline', r)}
                    value={inclineText}
                    onFocus={() => onEdit('incline')}
                    onBlur={inclineBox.clear}
                    onChangeText={(t) => {
                      const next = cleanIncline(t, inclineText);
                      inclineBox.typed(next, parseDecimal(next));
                      onChange('incline', next);
                    }}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    placeholder={inclinePlaceholder}
                    placeholderTextColor={c.text3}
                    style={inputText('incline')}
                  />
                </View>
              ) : null}
            </>
          ) : (
            <>
              <View style={[styles.cell, styles.third]}>
                {done && onLongPressWeight && set.weight_value != null ? (
                  // Over the box, so the long press reaches it; a tap
                  // focuses the box as it would have.
                  <Pressable
                    onPress={() => weightInput.current?.focus()}
                    onLongPress={onLongPressWeight}
                    accessibilityRole="button"
                    accessibilityLabel="Weight"
                    accessibilityHint="Long press for the plates"
                    style={[StyleSheet.absoluteFill, styles.overInput]}
                  />
                ) : null}
                <TextInput
                  key={weightKey}
                  ref={(r) => {
                    weightInput.current = r;
                    registerInput('weight', r);
                  }}
                  value={weightText}
                  onFocus={() => onEdit('weight')}
                  onBlur={weight.clear}
                  onChangeText={(t) => {
                    const next = cleanDecimal(t, 2);
                    weight.typed(next, parseDecimal(next));
                    onChange('weight', next);
                  }}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  placeholder={weightPlaceholder}
                  placeholderTextColor={c.text3}
                  style={inputText('weight')}
                />
              </View>

              <View style={[styles.cell, styles.third]}>
                <TextInput
                  key={repsKey}
                  ref={(r) => registerInput('reps', r)}
                  value={set.reps == null ? '' : String(set.reps)}
                  onFocus={() => onEdit('reps')}
                  onChangeText={(t) => onChange('reps', t)}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  placeholder={repsPlaceholder}
                  placeholderTextColor={c.text3}
                  style={inputText('reps')}
                />
              </View>
            </>
          )}

          <View style={[styles.cell, styles.doneCell]}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done }}
              onPress={onToggleDone}
              style={styles.checkTarget}>
              <View
                style={[
                  styles.check,
                  done
                    ? { backgroundColor: c.success, borderColor: c.success }
                    : { backgroundColor: c.checkFill, borderColor: c.checkBorder },
                ]}>
                <Text style={[styles.checkMark, { color: done ? '#FFFFFF' : c.checkGlyph }]}>✓</Text>
              </View>
            </Pressable>
          </View>
        </View>
        {hint ? (
          // Spacers the width of the set and previous columns, then the hint
          // across weight and reps and on over the done column.
          <View style={styles.hintRow}>
            <View style={styles.setCell} />
            <View style={withIncline ? styles.inclinePrev : styles.third} />
            <View style={withIncline ? styles.inclineHintSpan : styles.hintSpan}>
              <Text accessibilityLiveRegion="polite" style={[type.meta, { color: c.accentText }]}>
                {hint}
              </Text>
              {hintLink ? (
                <Pressable
                  onPress={hintLink.onPress}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.hintLink, pressed && styles.hintLinkPressed]}>
                  <Text style={[type.meta, styles.hintLinkText, { color: c.accentText }]}>{hintLink.label}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  // The long-press layer over a done set's weight box.
  overInput: { zIndex: 1 },
  bleed: {
    marginHorizontal: -spacing.card,
  },
  padBack: {
    paddingHorizontal: spacing.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_HEIGHT,
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  setCell: {
    width: COLUMNS.set,
  },
  // The whole cell takes the tap: the row's height by the column's width.
  setTap: {
    alignSelf: 'stretch',
  },
  third: {
    flex: 1,
  },
  inclinePrev: {
    flex: INCLINE_FLEX.previous,
  },
  inclineBox: {
    flex: INCLINE_FLEX.box,
  },
  doneCell: {
    width: COLUMNS.done,
  },
  prevCell: {
    flexDirection: 'row',
    gap: 4,
  },
  hintRow: {
    flexDirection: 'row',
    paddingBottom: spacing.sm,
  },
  // Two thirds wide, plus the done column, which it may run into.
  hintSpan: {
    flex: 2,
    marginRight: -COLUMNS.done,
  },
  // 44 pt tall to tap, the text centred in it, so it reads as the line
  // after the hint.
  hintLink: {
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: -spacing.sm,
  },
  hintLinkText: { fontWeight: '600' },
  hintLinkPressed: { opacity: 0.6 },
  // The same, across the three boxes of an incline row.
  inclineHintSpan: {
    flex: 3 * INCLINE_FLEX.box,
    marginRight: -COLUMNS.done,
  },
  circle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    width: '86%',
    height: INPUT_HEIGHT,
    borderRadius: radius.input,
    textAlign: 'center',
    paddingVertical: 0,
  },
  inclineInput: {
    width: INCLINE_INPUT_WIDTH,
  },
  bold: {
    fontWeight: '700',
  },
  // 44 wide in a 40 column: the 2pt overhang each side lands in the row's
  // padding, which is still inside the row, so the whole target takes taps.
  checkTarget: {
    width: CHECK_TARGET,
    height: CHECK_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    fontSize: 15,
    fontWeight: '700',
  },
  // Full row height with the action centred inside it, so the 44 box lands on
  // the same centreline as the input boxes rather than filling the row. The
  // right padding keeps it off the card edge now that the row bleeds to it.
  actionWrap: {
    height: ROW_HEIGHT,
    justifyContent: 'center',
    marginLeft: spacing.sm,
    paddingRight: spacing.card,
  },
  deleteAction: {
    height: INPUT_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: radius.input,
  },
  deleteLabel: {
    color: '#FFFFFF',
  },
  pressed: { opacity: 0.8 },
});
