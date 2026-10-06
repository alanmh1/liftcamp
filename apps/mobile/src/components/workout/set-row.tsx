import { asWeightUnit, tidyWeight, type PriorSet } from '@liftcamp/shared';
import { useState } from 'react';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
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
 * its own. Neither confirms; the undo toast is the safety net.
 */
function DeleteAction({
  translation,
  rowWidth,
  color,
  onDelete,
}: {
  translation: SharedValue<number>;
  rowWidth: number;
  color: string;
  onDelete: () => void;
}) {
  // Guards against firing twice while the finger is still down.
  const fired = useSharedValue(false);

  useAnimatedReaction(
    () => translation.value,
    (t) => {
      if (fired.value || rowWidth <= 0) return;
      if (-t >= rowWidth * FULL_SWIPE) {
        fired.value = true;
        runOnJS(onDelete)();
      }
    },
  );

  return (
    <View style={styles.actionWrap}>
      <Pressable
        accessibilityRole="button"
        onPress={onDelete}
        style={({ pressed }) => [
          styles.deleteAction,
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

/** "140 × 10". The unit is in the column header, so it is left off here. */
function previousLabel(prior: PriorSet | null, unit: string): string {
  if (!prior || (prior.weight_value == null && prior.reps == null)) return '—';
  const w = fmt(prior.weight_value, unit);
  const r = prior.reps == null ? '' : `${prior.reps}`;
  if (w && r) return `${w} × ${r}`;
  return w || r || '—';
}

export function SetRow({
  set,
  index,
  state,
  prior,
  unit,
  weightPlaceholder = '',
  repsPlaceholder = '',
  isPr,
  onEdit,
  onChange,
  onToggleDone,
  onDelete,
  registerInput,
  hint = null,
  focusedField = null,
}: {
  set: WorkoutSet;
  index: number;
  state: SetState;
  prior: PriorSet | null;
  unit: string;
  /**
   * What an empty weight box shows in gray: the placeholder weight, "BW" for
   * a no-equipment exercise, or nothing.
   */
  weightPlaceholder?: string;
  /** What an empty reps box shows in gray, or nothing. */
  repsPlaceholder?: string;
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
  /** The box in this row with the cursor, if any. Only it gets the outline. */
  focusedField?: EditField | null;
}) {
  const c = useColors();
  const [rowWidth, setRowWidth] = useState(0);
  const done = state === 'done';

  // Pending: gray badge, text2 number. Active: accent badge. Done: green
  // badge. Active and done both print the number in white; the tick lives in
  // the check box only.
  const badgeFill = state === 'pending' ? c.surface2 : state === 'active' ? c.accent : c.success;
  const numberColor = state === 'pending' ? c.text2 : '#FFFFFF';

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
  const inputText = (field: EditField) => [
    styles.input,
    type.setNumeral,
    focusedField === field ? focusStyle : restingStyle,
    { color: state === 'pending' ? c.text2 : c.text },
    done && styles.bold,
  ];

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
          <View style={[styles.cell, styles.setCell]}>
            <View style={[styles.circle, { backgroundColor: badgeFill }]}>
              <Text style={[type.prevNumeral, { color: numberColor }, state !== 'pending' && styles.bold]}>
                {index + 1}
              </Text>
            </View>
          </View>

          <View style={[styles.cell, styles.third, styles.prevCell]}>
            <Text style={[type.prevNumeral, { color: c.text3 }]} numberOfLines={1}>
              {previousLabel(prior, unit)}
            </Text>
            {isPr ? <PrRibbon size={18} /> : null}
          </View>

          <View style={[styles.cell, styles.third]}>
            <TextInput
              ref={(r) => registerInput('weight', r)}
              value={fmt(set.weight_value, unit)}
              onFocus={() => onEdit('weight')}
              onChangeText={(t) => onChange('weight', t)}
              keyboardType="decimal-pad"
              selectTextOnFocus
              placeholder={weightPlaceholder}
              placeholderTextColor={c.text3}
              style={inputText('weight')}
            />
          </View>

          <View style={[styles.cell, styles.third]}>
            <TextInput
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
            <View style={styles.third} />
            <View style={styles.hintSpan}>
              <Text accessibilityLiveRegion="polite" style={[type.meta, { color: c.accentText }]}>
                {hint}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
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
  third: {
    flex: 1,
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
