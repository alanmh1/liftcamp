import { effectiveLoad, oneRepMaxNumeric, priorSetForPosition } from '@liftcamp/shared';
import { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import type { EditField } from '@/components/workout/keypad-accessory';
import { SetRow, type SetState } from '@/components/workout/set-row';
import type { WorkoutExercise, WorkoutSet } from '@/data/workouts';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, COLUMNS, COLUMNS_BASE_WIDTH, radius, spacing, type } from '@/theme/tokens';

/** Scales the authored column widths to the card's real inner width. */
function scaleColumns(inner: number): Record<keyof typeof COLUMNS, number> {
  const factor = inner > 0 ? inner / COLUMNS_BASE_WIDTH : 1;
  return {
    set: COLUMNS.set * factor,
    previous: COLUMNS.previous * factor,
    weight: COLUMNS.weight * factor,
    reps: COLUMNS.reps * factor,
    done: COLUMNS.done * factor,
  };
}

export function ExerciseCard({
  we,
  expanded,
  unit,
  bodyweight,
  onExpand,
  onOpenSheet,
  onEditField,
  onChangeField,
  onToggleDone,
  onDeleteSet,
  onAddSet,
}: {
  we: WorkoutExercise;
  expanded: boolean;
  unit: string;
  bodyweight: number | null;
  onExpand: () => void;
  onOpenSheet: () => void;
  onEditField: (setId: string, field: EditField) => void;
  onChangeField: (setId: string, field: EditField, raw: string) => void;
  onToggleDone: (set: WorkoutSet) => void;
  onDeleteSet: (set: WorkoutSet) => void;
  onAddSet: () => void;
}) {
  const { scheme, colors: c } = useTheme();
  const [inner, setInner] = useState(0);
  const widths = scaleColumns(inner);

  function onLayout(e: LayoutChangeEvent) {
    setInner(e.nativeEvent.layout.width);
  }

  if (!expanded) {
    return (
      <Pressable onPress={onExpand} style={[styles.card, cardSurface(scheme, c)]}>
        <View style={styles.collapsedRow}>
          <Text style={[type.exerciseName, { color: c.text }]} numberOfLines={1}>
            {we.exercise.name}
          </Text>
          <Text style={[type.meta, { color: c.text2 }]}>
            {we.sets.length} {we.sets.length === 1 ? 'set' : 'sets'}
          </Text>
          <Text style={[type.meta, { color: c.text3 }]}>›</Text>
        </View>
      </Pressable>
    );
  }

  // Exactly one active set: the first that is not done.
  const activeIndex = we.sets.findIndex((s) => !s.completed);

  // PR marks, resolved in one pass so a set has to beat the prior best and
  // every earlier completed set in this workout. Without the running best,
  // every set of a first-ever session would show a ribbon.
  const prIds = new Set<string>();
  let best = we.priorBestOrm;
  for (const s of we.sets) {
    if (!s.completed) continue;
    const load = effectiveLoad({ weight: null, weight_value: s.weight_value }, we.exercise, bodyweight);
    const orm = oneRepMaxNumeric(load, s.reps);
    if (orm == null) continue;
    if (best == null || orm > best) {
      prIds.add(s.id);
      best = orm;
    }
  }

  return (
    <View style={[styles.card, cardSurface(scheme, c)]}>
      <View style={styles.head}>
        <Text style={[type.exerciseName, { color: c.text }]} numberOfLines={2}>
          {we.exercise.name}
        </Text>
        <Pressable onPress={onOpenSheet} hitSlop={10} accessibilityLabel="Exercise options">
          <Text style={[styles.ellipsis, { color: c.text2 }]}>⋮</Text>
        </Pressable>
      </View>

      <View style={styles.columns} onLayout={onLayout}>
        <Text style={[type.label, { color: c.text3, width: widths.set }, styles.center]}>Set</Text>
        <Text style={[type.label, { color: c.text3, width: widths.previous }, styles.center]}>
          Previous
        </Text>
        <Text style={[type.label, { color: c.text3, width: widths.weight }, styles.center]}>
          {unit}
        </Text>
        <Text style={[type.label, { color: c.text3, width: widths.reps }, styles.center]}>
          Reps
        </Text>
        <View style={{ width: widths.done }} />
      </View>

      {we.sets.map((s, i) => {
        const state: SetState = s.completed ? 'done' : i === activeIndex ? 'active' : 'pending';
        return (
          <SetRow
            key={s.id}
            set={s}
            index={i}
            state={state}
            prior={priorSetForPosition(we.prior, i)}
            unit={unit}
            isPr={prIds.has(s.id)}
            widths={widths}
            onEdit={(f) => onEditField(s.id, f)}
            onChange={(f, raw) => onChangeField(s.id, f, raw)}
            onToggleDone={() => onToggleDone(s)}
            onDelete={() => onDeleteSet(s)}
          />
        );
      })}

      <Pressable
        onPress={onAddSet}
        style={({ pressed }) => [
          styles.addSet,
          { backgroundColor: c.surface2 },
          pressed && styles.pressed,
        ]}>
        <Text style={[type.button, { color: c.text2 }]}>+ Add set</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: spacing.card,
    gap: spacing.sm,
  },
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  ellipsis: {
    fontSize: 20,
    lineHeight: 22,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 2,
  },
  center: { textAlign: 'center' },
  addSet: {
    borderRadius: radius.input,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
});
