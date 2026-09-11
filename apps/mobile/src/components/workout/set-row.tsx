import type { PriorSet } from '@liftcamp/shared';
import { useState } from 'react';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

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

function fmt(n: number | null): string {
  if (n == null) return '';
  return Number.isInteger(n) ? String(n) : String(n);
}

function previousLabel(prior: PriorSet | null, unit: string): string {
  if (!prior || (prior.weight_value == null && prior.reps == null)) return '—';
  const w = prior.weight_value == null ? '' : `${prior.weight_value}${unit}`;
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
  isPr,
  widths,
  onEdit,
  onChange,
  onToggleDone,
  onDelete,
}: {
  set: WorkoutSet;
  index: number;
  state: SetState;
  prior: PriorSet | null;
  unit: string;
  isPr: boolean;
  widths: Record<keyof typeof COLUMNS, number>;
  onEdit: (field: EditField) => void;
  onChange: (field: EditField, raw: string) => void;
  onToggleDone: () => void;
  onDelete: () => void;
}) {
  const c = useColors();
  const [rowWidth, setRowWidth] = useState(0);

  const numberCircle =
    state === 'done'
      ? { backgroundColor: c.accent }
      : { backgroundColor: c.surface2 };
  const numberColor = state === 'done' ? '#FFFFFF' : state === 'active' ? c.text : c.text2;

  const inputStyle =
    state === 'done'
      ? { backgroundColor: c.surface2, borderColor: 'transparent', borderWidth: 1.5 }
      : state === 'active'
        ? { backgroundColor: c.inputFill, borderColor: c.accentText, borderWidth: 1.5 }
        : { backgroundColor: c.inputFill, borderColor: c.border, borderWidth: 1 };
  const inputColor = state === 'pending' ? c.text2 : c.text;

  return (
    <Swipeable
      // friction 1 means the row tracks the finger exactly. At 2 the row moves
      // half as far as the drag, so reaching 60% of the row width would take a
      // 120% drag and the full swipe could never fire.
      friction={1}
      rightThreshold={40}
      renderRightActions={(_progress, translation) => (
        <DeleteAction
          translation={translation}
          rowWidth={rowWidth}
          color={c.danger}
          onDelete={onDelete}
        />
      )}>
      <View
        onLayout={(e: LayoutChangeEvent) => setRowWidth(e.nativeEvent.layout.width)}
        style={styles.row}>
        {/* The current set is marked by a 3pt bar on the row's left edge rather
            than a tinted fill. The row already sits inside the card's padding,
            so left: 0 lands on the padding edge. accentText rather than accent:
            on graphite the darker plate blue has too little contrast, and
            accentText is the lifted variant chosen for exactly that. */}
        {state === 'active' ? (
          <View style={[styles.activeBar, { backgroundColor: c.accentText }]} />
        ) : null}
        <View style={[styles.cell, { width: widths.set }]}>
          <View style={[styles.circle, numberCircle]}>
            <Text style={[type.prevNumeral, { color: numberColor }]}>{index + 1}</Text>
          </View>
        </View>

        <View style={[styles.cell, styles.prevCell, { width: widths.previous }]}>
          <Text style={[type.prevNumeral, { color: c.text3 }]} numberOfLines={1}>
            {previousLabel(prior, unit)}
          </Text>
          {isPr ? <PrRibbon size={18} /> : null}
        </View>

        <View style={[styles.cell, { width: widths.weight }]}>
          <TextInput
            value={fmt(set.weight_value)}
            onFocus={() => onEdit('weight')}
            onChangeText={(t) => onChange('weight', t)}
            keyboardType="decimal-pad"
            selectTextOnFocus
            placeholder="—"
            placeholderTextColor={c.text3}
            style={[styles.input, type.setNumeral, inputStyle, { color: inputColor }]}
          />
        </View>

        <View style={[styles.cell, { width: widths.reps }]}>
          <TextInput
            value={fmt(set.reps)}
            onFocus={() => onEdit('reps')}
            onChangeText={(t) => onChange('reps', t)}
            keyboardType="number-pad"
            selectTextOnFocus
            placeholder="—"
            placeholderTextColor={c.text3}
            style={[styles.input, type.setNumeral, inputStyle, { color: inputColor }]}
          />
        </View>

        <View style={[styles.cell, { width: widths.done }]}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: state === 'done' }}
            onPress={onToggleDone}
            hitSlop={8}
            style={[
              styles.check,
              state === 'done'
                ? { backgroundColor: c.accent, borderColor: c.accent }
                : { borderColor: c.border },
            ]}>
            {state === 'done' ? <Text style={styles.checkMark}>✓</Text> : null}
          </Pressable>
        </View>
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_HEIGHT,
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 1.5,
    borderBottomLeftRadius: 1.5,
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevCell: {
    flexDirection: 'row',
    gap: 4,
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
  check: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  // Full row height with the action centred inside it, so the 44 box lands on
  // the same centreline as the input boxes rather than filling the row.
  actionWrap: {
    height: ROW_HEIGHT,
    justifyContent: 'center',
    marginLeft: spacing.sm,
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
