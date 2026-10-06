import {
  asWeightUnit,
  effectiveLoad,
  formatSetTarget,
  oneRepMaxNumeric,
  priorSetForPosition,
  progressionChip,
  tidyWeight,
  weightIsPerDumbbell,
  type SetPlaceholder,
} from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { Fragment, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ExerciseThumb } from '@/components/exercise-media';
import { Skeleton, SkeletonCircle, SkeletonText } from '@/components/skeleton';
import { Text, TextInput } from '@/components/text';
import type { EditField } from '@/components/workout/keypad-accessory';
import { ProgressionChip } from '@/components/workout/progression-chip';
import { SetRow, type SetState } from '@/components/workout/set-row';
import {
  isBodyOnly,
  placeholdersFor,
  progressionFor,
  workoutPrSetIds,
  type WorkoutExercise,
  type WorkoutSet,
} from '@/data/workouts';
import { useProgressionGate } from '@/lib/pro';
import { useAppActive } from '@/lib/use-app-active';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, COLUMNS, radius, spacing, type } from '@/theme/tokens';

/**
 * The body's fade-in when a card expands. Collapsing is instant, and the
 * card's height is never animated: a LinearTransition on the card, with the
 * body fading out on exit, left collapsed cards drawn at their expanded
 * height with a blank body, and the scroll view unable to reach the cards
 * below (Reanimated 4.5.1 kept the view at its last animated frame; fixed
 * upstream in react-native-reanimated#10537). A fade-in starts from the
 * mounted layout, so it is safe.
 */
const EXPAND_FADE_MS = 200;

/** Under a set whose check was refused for an empty box with nothing to fill it. */
const HINTS: Record<EditField, string> = {
  weight: 'Enter the weight you lifted',
  reps: 'Enter the reps you did',
};

/**
 * Header thumbnail size. A collapsed header (name plus meta line) is about 42
 * tall and a two-line name is 44, so 40 sits inside both. An expanded card
 * with a one-line name and no target has a shorter header, and the thumb sets
 * its height there. A two-line name over a target line is the tallest case,
 * about 64; the thumb and the ellipsis centre against it.
 */
const THUMB = 40;

/** The one-dumbbell hint stops showing at this many finished sessions. */
const ONE_DUMBBELL_HINT_SESSIONS = 3;

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

/** A placeholder weight as its box prints it, rounded like a typed one. */
function placeholderWeight(p: SetPlaceholder | undefined, unit: string): string {
  const v = tidyWeight(p?.weight?.value ?? null, asWeightUnit(unit));
  return v == null ? '' : String(v);
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
  fieldHint = null,
  editing = null,
  onOpenProgression,
  introChip = false,
  onIntroDone,
}: {
  we: WorkoutExercise;
  unit: string;
  bodyweight: number | null;
  onOpenSheet: () => void;
  /** Tap on the thumbnail or name. Opens the info sheet for this exercise. */
  onOpenInfo: () => void;
  onEditField: (setId: string, field: EditField) => void;
  onChangeField: (setId: string, field: EditField, raw: string) => void;
  /** `weighted` is false for a body-only exercise, whose weight is optional. */
  onToggleDone: (set: WorkoutSet, placeholder: SetPlaceholder | null, weighted: boolean) => void;
  onDeleteSet: (set: WorkoutSet) => void;
  onAddSet: () => void;
  registerInput: (setId: string, field: EditField, input: TextInput | null) => void;
  /** The set whose check was refused for want of a value; it shows the hint. */
  fieldHint?: { setId: string; field: EditField } | null;
  /** The box with the cursor, which alone gets the focus outline. */
  editing?: { setId: string; field: EditField } | null;
  /** Pro: the progression chip was tapped. */
  onOpenProgression?: () => void;
  /** Pro: this card's chip plays the first-appearance moment. */
  introChip?: boolean;
  onIntroDone?: () => void;
}) {
  const { scheme, colors: c } = useTheme();
  const appActive = useAppActive();
  const progressionOpen = useProgressionGate();

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

  // Exactly one active set: the first that is not done.
  const activeIndex = we.sets.findIndex((s) => !s.completed);

  // PR marks, the same rule the PR haptic uses (see workoutPrSetIds).
  const prIds = workoutPrSetIds(we, bodyweight);

  const setCount = `${we.sets.length} ${we.sets.length === 1 ? 'set' : 'sets'}`;
  const targetLabel = formatSetTarget(we.target);
  // A no-equipment exercise's weight is optional added load, so the column
  // says so: "+LBS" over a field that reads "BW" until something is typed.
  // What is saved and how it scores do not change.
  const bodyOnly = isBodyOnly(we.exercise);
  // Pro progression, null for everyone else. Read from the history the
  // workout loaded, so it stays put while sets are logged.
  const progression = progressionFor(we, asWeightUnit(unit), progressionOpen);
  // Gray values for the empty boxes, from the sets above, the suggestion
  // (Pro), the last session, then the routine's reps. Worked out every
  // render so they follow typing.
  const placeholders = placeholdersFor(we, progression);
  // The chip under the name; null for a first session or an exercise the
  // engine has no rule for.
  const chip = progression ? progressionChip(progression, we.exercise, asWeightUnit(unit)) : null;
  // A dumbbell exercise is logged as the weight of one dumbbell. Until the
  // user has three finished sessions of it, a muted line under the name says
  // so. Not for a single dumbbell held in both hands.
  const oneDumbbellHint = weightIsPerDumbbell(we.exercise) && we.finishedSessions < ONE_DUMBBELL_HINT_SESSIONS;
  // Unilateral reps are logged per side. "REPS/SIDE" measures 56.5 pt in the
  // label style (Outfit Bold, 10 pt, 0.6 spacing) against an 80 pt column
  // (a third of what the set and done columns leave) on a 390 pt screen, so
  // it keeps one line.
  const perSide = !!we.exercise.is_unilateral;

  return (
    <View style={[styles.card, cardSurface(scheme, c)]}>
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
          {expanded && chip && onOpenProgression ? (
            <ProgressionChip chip={chip} intro={introChip} onPress={onOpenProgression} onIntroDone={onIntroDone} />
          ) : null}
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
          {expanded && oneDumbbellHint ? (
            <Text style={[type.meta, { color: c.text3 }]} numberOfLines={1}>
              Log the weight of one dumbbell
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
        <Animated.View entering={FadeIn.duration(EXPAND_FADE_MS)} style={styles.body}>
          <View style={styles.columns}>
            <Text style={[type.label, { color: c.text3 }, styles.setCol, styles.center]}>
              Set
            </Text>
            <Text style={[type.label, { color: c.text3 }, styles.third, styles.center]}>
              Previous
            </Text>
            <Text style={[type.label, { color: c.text3 }, styles.third, styles.center]}>
              {bodyOnly ? `+${unit}` : unit}
            </Text>
            <Text style={[type.label, { color: c.text3 }, styles.third, styles.center]} numberOfLines={1}>
              {perSide ? 'Reps/side' : 'Reps'}
            </Text>
            <View style={styles.doneCol} />
          </View>

          {/* The rows touch, so a done set's band and the hairlines between
              the others run edge to edge; the body's gap is for what sits
              above and below them. */}
          <View>
            {we.sets.map((s, i) => {
              const state: SetState = s.completed
                ? 'done'
                : i === activeIndex
                  ? 'active'
                  : 'pending';
              // A hairline between two rows that are not done. Next to a done
              // row the green band is the separator.
              const divider = i > 0 && !s.completed && !we.sets[i - 1].completed;
              return (
                <Fragment key={s.id}>
                  {divider ? <View style={[styles.divider, { backgroundColor: c.divider }]} /> : null}
                  <SetRow
                    set={s}
                    index={i}
                    state={state}
                    prior={priorSetForPosition(we.prior, i)}
                    unit={unit}
                    weightPlaceholder={bodyOnly ? 'BW' : placeholderWeight(placeholders[i], unit)}
                    repsPlaceholder={placeholders[i]?.reps != null ? String(placeholders[i].reps) : ''}
                    isPr={prIds.has(s.id)}
                    onEdit={(f) => onEditField(s.id, f)}
                    onChange={(f, raw) => onChangeField(s.id, f, raw)}
                    onToggleDone={() => onToggleDone(s, placeholders[i] ?? null, !bodyOnly)}
                    onDelete={() => onDeleteSet(s)}
                    registerInput={(field, input) => registerInput(s.id, field, input)}
                    hint={s.id === fieldHint?.setId ? HINTS[fieldHint.field] : null}
                    focusedField={s.id === editing?.setId ? editing.field : null}
                  />
                </Fragment>
              );
            })}
          </View>

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
    </View>
  );
}

/** SetRow's height and its input boxes, so skeleton rows match real ones. */
const SET_ROW_HEIGHT = 60;
const SET_INPUT_HEIGHT = 44;
/** The Add set button: 15pt button text inside 12pt of padding each side. */
const ADD_SET_HEIGHT = 43;

/**
 * A card's shape before the workout loads: the thumbnail and name, the real
 * column labels, `rows` set rows (number circle, previous, weight and reps
 * boxes, done box), and the Add set button.
 */
export function ExerciseCardSkeleton({
  rows,
  unit,
  nameWidth,
}: {
  rows: number;
  unit: string;
  nameWidth: `${number}%`;
}) {
  const { scheme, colors: c } = useTheme();

  return (
    <View style={[styles.card, cardSurface(scheme, c)]}>
      <View style={[styles.head, styles.headTap]}>
        <Skeleton width={THUMB} height={THUMB} radius={radius.input} />
        <View style={styles.headText}>
          <SkeletonText variant={type.exerciseName} width={nameWidth} />
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.columns}>
          <Text style={[type.label, { color: c.text3 }, styles.setCol, styles.center]}>Set</Text>
          <Text style={[type.label, { color: c.text3 }, styles.third, styles.center]}>Previous</Text>
          <Text style={[type.label, { color: c.text3 }, styles.third, styles.center]}>{unit}</Text>
          <Text style={[type.label, { color: c.text3 }, styles.third, styles.center]}>Reps</Text>
          <View style={styles.doneCol} />
        </View>
        {Array.from({ length: rows }, (_, i) => (
          <View key={i} style={styles.skeletonRow}>
            <View style={[styles.skeletonCell, styles.setCol]}>
              <SkeletonCircle size={26} />
            </View>
            <View style={[styles.skeletonCell, styles.third]}>
              <SkeletonText variant={type.prevNumeral} width="64%" />
            </View>
            <View style={[styles.skeletonCell, styles.third]}>
              <Skeleton width="86%" height={SET_INPUT_HEIGHT} />
            </View>
            <View style={[styles.skeletonCell, styles.third]}>
              <Skeleton width="86%" height={SET_INPUT_HEIGHT} />
            </View>
            <View style={[styles.skeletonCell, styles.doneCol]}>
              <Skeleton width={25} height={25} radius={7} />
            </View>
          </View>
        ))}
        <Skeleton height={ADD_SET_HEIGHT} />
      </View>
    </View>
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
  setCol: { width: COLUMNS.set },
  third: { flex: 1 },
  doneCol: { width: COLUMNS.done },
  // Card edge to card edge, through the padding.
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: -spacing.card },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', height: SET_ROW_HEIGHT },
  skeletonCell: { alignItems: 'center', justifyContent: 'center' },
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
