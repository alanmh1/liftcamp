import {
  asWeightUnit,
  effectiveLoad,
  formatSetTarget,
  oneRepMaxNumeric,
  priorSetForPosition,
  tidyWeight,
  weightIsPerDumbbell,
} from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { ExerciseThumb } from '@/components/exercise-media';
import { Text, TextInput } from '@/components/text';
import type { EditField } from '@/components/workout/keypad-accessory';
import { SetRow, type SetState } from '@/components/workout/set-row';
import type { WorkoutExercise, WorkoutSet } from '@/data/workouts';
import { useAppActive } from '@/lib/use-app-active';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, COLUMNS, COLUMNS_BASE_WIDTH, radius, spacing, type } from '@/theme/tokens';

const COLLAPSE_MS = 200;

/**
 * Header thumbnail size. A collapsed header (name plus meta line) is about 42
 * tall and a two-line name is 44, so 40 sits inside both. An expanded card
 * with a one-line name and no target has a shorter header, and the thumb sets
 * its height there. A two-line name over a target line is the tallest case,
 * about 64; the thumb and the ellipsis centre against it.
 */
const THUMB = 40;

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
  const w = b.set.weight_value == null ? '' : `${tidyWeight(b.set.weight_value, asWeightUnit(unit))}${unit}`;
  const r = b.set.reps == null ? '' : String(b.set.reps);
  if (w && r) return `${w} × ${r}`;
  return w || r;
}

export function ExerciseCard({
  we,
  unit,
  bodyweight,
  onOpenSheet,
  onOpenInfo,
  onEditField,
  onChangeField,
  onToggleDone,
  onDeleteSet,
  onAddSet,
  registerInput,
}: {
  we: WorkoutExercise;
  unit: string;
  bodyweight: number | null;
  onOpenSheet: () => void;
  /** Tap on the thumbnail or name. Opens the info sheet for this exercise. */
  onOpenInfo: () => void;
  onEditField: (setId: string, field: EditField) => void;
  onChangeField: (setId: string, field: EditField, raw: string) => void;
  onToggleDone: (set: WorkoutSet) => void;
  onDeleteSet: (set: WorkoutSet) => void;
  onAddSet: () => void;
  registerInput: (setId: string, field: EditField, input: TextInput | null) => void;
}) {
  const { scheme, colors: c } = useTheme();
  const appActive = useAppActive();
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
  const targetLabel = formatSetTarget(we.target);
  // A no-equipment exercise's weight is optional added load, so the column
  // says so: "+LBS" over a field that reads "BW" until something is typed.
  // What is saved and how it scores do not change.
  const bodyOnly = we.exercise.equipment === 'body only';
  // A dumbbell exercise is logged as the weight of one dumbbell, and the
  // column says so: "LBS EACH". Not for a single dumbbell held in both hands.
  const perDumbbell = weightIsPerDumbbell(we.exercise);
  // Unilateral reps are logged per side. "REPS/SIDE" measures 56.5 pt in the
  // label style (Outfit Bold, 10 pt, 0.6 spacing) against a 61 pt column on
  // a 390 pt screen, so it keeps one line.
  const perSide = !!we.exercise.is_unilateral;

  return (
    <Animated.View
      layout={LinearTransition.duration(COLLAPSE_MS)}
      style={[styles.card, cardSurface(scheme, c)]}>
      <View style={styles.head}>
        {/* One target over the thumbnail and the name, stopping short of the
            ellipsis, which is a sibling. On an in-progress card it opens the
            info sheet. On an all-done card the header is the collapse toggle,
            per the spec, so that wins and Exercise Info stays in the menu. */}
        <Pressable
          onPress={allDone ? () => setOpenWhileDone((v) => !v) : onOpenInfo}
          accessibilityRole="button"
          accessibilityLabel={allDone ? (expanded ? 'Collapse' : 'Expand') : `About ${we.exercise.name}`}
          accessibilityState={allDone ? { expanded } : undefined}
          style={({ pressed }) => [styles.headTap, pressed && styles.headTapPressed]}>
          {/* Animated only while the app is foregrounded; a 45-minute session
              should not loop GIFs from a pocket. Falls through gif → photo →
              letter tile like everywhere else. */}
          <ExerciseThumb exercise={we.exercise} size={THUMB} animated={appActive} />
          <View style={styles.headText}>
            <Text style={[type.exerciseName, { color: c.text }]} numberOfLines={expanded ? 2 : 1}>
              {we.exercise.name}
            </Text>
          {/* The routine's target, "3 × 8-10", on its own line under the name
              where the full header width is available. The column label and
              the reps box are both too narrow for "8 each". text2 so it reads
              as information; accent is for actions. Absent for an exercise
              added mid-workout, which keeps that header at its current height. */}
          {expanded && targetLabel ? (
            <Text style={[type.prevNumeral, { color: c.text2 }]} numberOfLines={1}>
              {targetLabel}
            </Text>
          ) : null}
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
        </Pressable>
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
          {/* Vertical ellipsis as an SF Symbol. The catalogue has no bare
              `ellipsis.vertical` (only the `.bubble` variants), so this is the
              real `ellipsis` symbol turned 90°, which keeps its bold weight and
              metrics exactly. Android gets a bold text glyph, already vertical. */}
          <SymbolView
            name="ellipsis"
            size={26}
            weight="bold"
            tintColor={c.text}
            style={styles.ellipsisSymbol}
            fallback={<Text style={[styles.ellipsis, { color: c.text }]}>⋮</Text>}
          />
        </Pressable>
      </View>

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
              {bodyOnly ? `+${unit}` : perDumbbell ? `${unit} each` : unit}
            </Text>
            <Text style={[type.label, { color: c.text3, width: widths.reps }, styles.center]} numberOfLines={1}>
              {perSide ? 'Reps/side' : 'Reps'}
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
                weightPlaceholder={bodyOnly ? 'BW' : undefined}
                isPr={prIds.has(s.id)}
                widths={widths}
                onEdit={(f) => onEditField(s.id, f)}
                onChange={(f, raw) => onChangeField(s.id, f, raw)}
                onToggleDone={() => onToggleDone(s)}
                onDelete={() => onDeleteSet(s)}
                registerInput={(field, input) => registerInput(s.id, field, input)}
              />
            );
          })}

          <Pressable
            onPress={onAddSet}
            style={({ pressed }) => [
              styles.addSet,
              { borderColor: c.border },
              pressed && styles.pressed,
            ]}>
            <Text style={[type.button, { color: c.accentText }]}>+ Add set</Text>
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
    alignItems: 'center',
    gap: spacing.sm,
  },
  headTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // Bleed into the card padding so the pressed tint has room, then pad
    // back, so the content does not move.
    marginLeft: -spacing.sm,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.input,
  },
  headTapPressed: {
    opacity: 0.6,
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  ellipsisButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    // The row centres its children against the thumbnail; this stays pinned
    // to the top so the corner inset below still holds.
    alignSelf: 'flex-start',
    // 14 padding minus 6 puts the box edge 8pt from the card edge, so the
    // glyph centre is at 8 + 22 = 30pt on both axes.
    marginTop: -6,
    marginRight: -6,
    marginBottom: -12,
  },
  ellipsisSymbol: {
    width: 26,
    height: 26,
    transform: [{ rotate: '90deg' }],
  },
  ellipsis: {
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '700',
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
  // Ghost button: no fill, a hairline in the border colour, accent label.
  // The full-width surface2 slab it replaces read as a dead area on the card.
  addSet: {
    borderRadius: radius.input,
    borderWidth: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
});
