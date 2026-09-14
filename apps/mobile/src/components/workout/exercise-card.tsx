import { effectiveLoad, oneRepMaxNumeric, priorSetForPosition } from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import type { EditField } from '@/components/workout/keypad-accessory';
import { SetRow, type SetState } from '@/components/workout/set-row';
import type { WorkoutExercise, WorkoutSet } from '@/data/workouts';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, COLUMNS, COLUMNS_BASE_WIDTH, radius, spacing, type } from '@/theme/tokens';

const COLLAPSE_MS = 200;

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

/**
 * The completed set with the highest estimated 1RM. Ties go to the heavier
 * set, so a 5×135 beats a 10×100 even though Epley rates them close.
 */
function bestSet(
  we: WorkoutExercise,
  bodyweight: number | null,
): { set: WorkoutSet; orm: number } | null {
  let best: { set: WorkoutSet; orm: number } | null = null;
  for (const s of we.sets) {
    if (!s.completed) continue;
    const load = effectiveLoad({ weight: null, weight_value: s.weight_value }, we.exercise, bodyweight);
    const orm = oneRepMaxNumeric(load, s.reps);
    if (orm == null) continue;
    if (
      !best ||
      orm > best.orm ||
      (orm === best.orm && (s.weight_value ?? 0) > (best.set.weight_value ?? 0))
    ) {
      best = { set: s, orm };
    }
  }
  return best;
}

function bestSetLabel(we: WorkoutExercise, bodyweight: number | null, unit: string): string {
  const b = bestSet(we, bodyweight);
  if (!b) return '';
  const w = b.set.weight_value == null ? '' : `${b.set.weight_value}${unit}`;
  const r = b.set.reps == null ? '' : String(b.set.reps);
  if (w && r) return `${w} × ${r}`;
  return w || r;
}

export function ExerciseCard({
  we,
  unit,
  bodyweight,
  onOpenSheet,
  onEditField,
  onChangeField,
  onToggleDone,
  onDeleteSet,
  onAddSet,
}: {
  we: WorkoutExercise;
  unit: string;
  bodyweight: number | null;
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

  // Collapse is local UI state. A card with any incomplete set is always
  // expanded. A card whose every set is done collapses to a summary row, and
  // tapping its header toggles it open. The moment it stops being all-done
  // (a set added, a set un-completed) it expands again and forgets the toggle,
  // so it collapses cleanly the next time the last set is finished.
  const allDone = we.sets.length > 0 && we.sets.every((s) => s.completed);
  const [openWhileDone, setOpenWhileDone] = useState(false);
  useEffect(() => {
    if (!allDone) setOpenWhileDone(false);
  }, [allDone]);
  const expanded = !allDone || openWhileDone;

  function onLayout(e: LayoutChangeEvent) {
    setInner(e.nativeEvent.layout.width);
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

  const setCount = `${we.sets.length} ${we.sets.length === 1 ? 'set' : 'sets'}`;

  return (
    <Animated.View
      layout={LinearTransition.duration(COLLAPSE_MS)}
      style={[styles.card, cardSurface(scheme, c)]}>
      <Pressable
        onPress={allDone ? () => setOpenWhileDone((v) => !v) : undefined}
        disabled={!allDone}
        accessibilityRole={allDone ? 'button' : undefined}
        accessibilityState={allDone ? { expanded } : undefined}
        style={styles.head}>
        <View style={styles.headText}>
          <Text style={[type.exerciseName, { color: c.text }]} numberOfLines={expanded ? 2 : 1}>
            {we.exercise.name}
          </Text>
          {!expanded ? (
            <Text style={[type.meta, { color: c.text2 }]} numberOfLines={1}>
              {setCount}
              {bestSetLabel(we, bodyweight, unit) ? (
                <>
                  {'  ·  '}
                  <Text style={[type.prevNumeral, { color: c.text2 }]}>
                    {bestSetLabel(we, bodyweight, unit)}
                  </Text>
                </>
              ) : null}
            </Text>
          ) : null}
        </View>
        {/* A 44pt target whose glyph sits further in from the card corner.
            Before, the bare glyph hugged the 14pt padding edge, centred about
            20pt in from the right and 25 from the top, which read as crowded
            against a 20pt corner radius. The negative margins let the 44 box
            overlap the padding so its centre lands 30pt in on both axes. */}
        <Pressable
          onPress={onOpenSheet}
          accessibilityRole="button"
          accessibilityLabel="Exercise options"
          style={({ pressed }) => [styles.ellipsisButton, pressed && styles.pressed]}>
          {/* SF Symbol on iOS at bold, in `text` rather than `text2`. SF Symbols
              has no vertical ellipsis, so this is the horizontal one, which is
              the standard iOS "more" glyph anyway. Android gets a bold text
              glyph of the same orientation. */}
          <SymbolView
            name="ellipsis"
            size={26}
            weight="bold"
            tintColor={c.text}
            fallback={<Text style={[styles.ellipsis, { color: c.text }]}>⋯</Text>}
          />
        </Pressable>
      </Pressable>

      {expanded ? (
        <Animated.View
          entering={FadeIn.duration(COLLAPSE_MS)}
          exiting={FadeOut.duration(COLLAPSE_MS)}
          style={styles.body}>
          <View style={styles.columns} onLayout={onLayout}>
            <Text style={[type.label, { color: c.text3, width: widths.set }, styles.center]}>
              Set
            </Text>
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
            const state: SetState = s.completed
              ? 'done'
              : i === activeIndex
                ? 'active'
                : 'pending';
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
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: spacing.card,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headText: {
    flexShrink: 1,
    gap: 2,
  },
  ellipsisButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    // 14 padding minus 6 puts the box edge 8pt from the card edge, so the
    // glyph centre is at 8 + 22 = 30pt on both axes.
    marginTop: -6,
    marginRight: -6,
    marginBottom: -12,
  },
  ellipsis: {
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '800',
  },
  body: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
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
