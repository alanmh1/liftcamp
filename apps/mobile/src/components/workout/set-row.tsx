import type { PriorSet } from '@liftcamp/shared';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrRibbon } from '@/components/workout/pr-ribbon';
import type { EditField } from '@/components/workout/keypad-accessory';
import { useColors } from '@/theme/theme-provider';
import { COLUMNS, radius, spacing, type } from '@/theme/tokens';
import type { WorkoutSet } from '@/data/workouts';

export type SetState = 'pending' | 'active' | 'done';

const ROW_HEIGHT = 60;

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
      friction={2}
      rightThreshold={40}
      renderRightActions={() => (
        <Pressable
          onPress={onDelete}
          style={[styles.deleteAction, { backgroundColor: c.danger }]}>
          <Text style={[type.button, { color: '#FFFFFF' }]}>Delete</Text>
        </Pressable>
      )}>
      <View
        style={[
          styles.row,
          { backgroundColor: state === 'active' ? `${c.text}0A` : 'transparent' },
        ]}>
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
    height: 38,
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
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 96,
    height: ROW_HEIGHT,
    borderRadius: radius.input,
    marginLeft: spacing.sm,
  },
});
