import {
  bodyHighlights,
  canonMuscleList,
  coldStartAdvice,
  formatEquipmentLabel,
  isCardio,
  muscleLabel,
  parseSteps,
  type BodyView,
} from '@liftcamp/shared';
import type { BottomSheetScrollViewMethods } from '@gorhom/bottom-sheet';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { BodyDiagramCircle, viewHasHighlights } from '@/components/body-diagram';
import { EquipmentIcon } from '@/components/equipment-icon';
import { ExerciseHero } from '@/components/exercise-media';
import { ExerciseSteps } from '@/components/exercise-steps';
import { Paragraphs } from '@/components/exercises/paragraphs';
import { Text } from '@/components/text';
import { getBeginnerNotes } from '@/data/exercises';
import { getExercise, type ExerciseInfo } from '@/data/workouts';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

/**
 * Starting-weight paragraphs read this run, by exercise id. Only notes that
 * exist: a read that finds none (or no signal) is asked again next time.
 */
const startingNotes = new Map<string, string>();

/** A section the sheet can open scrolled to. */
export type InfoSection = 'starting-weight';

/**
 * What an exercise is: animation, name, muscles, starting weight,
 * equipment, description.
 *
 * Starting weight is the exercise's beginner note, the paragraph its
 * /exercises page shows, or without one the generic paragraph for its
 * category (coldStartAdvice in shared). Cardio has no such section. With
 * `scrollTo`, the sheet opens with that section at the top: the workout
 * screen's "How to pick a starting weight" opens it so.
 *
 * Takes either a loaded exercise or just an id; with an id it fetches the row
 * when presented. Reused by the picker's info buttons and the workout card's
 * ellipsis menu.
 *
 * If this is presented from inside a native modal (the picker's RN Modal, the
 * workout's full-screen modal), that modal has to render its own
 * BottomSheetModalProvider, or the sheet portals into the root window and
 * opens behind the modal. Both hosts do.
 */
export const ExerciseInfoSheet = forwardRef<
  SheetRef,
  { exercise: ExerciseInfo | string | null; scrollTo?: InfoSection | null; onDismiss?: () => void }
>(
  function ExerciseInfoSheet({ exercise, scrollTo = null, onDismiss }, ref) {
    const c = useColors();
    const { width } = useWindowDimensions();
    const [loaded, setLoaded] = useState<ExerciseInfo | null>(null);
    const scrollRef = useRef<BottomSheetScrollViewMethods>(null);

    // The beginner note's starting weight: undefined while it is read, null
    // when there is none. Read when the exercise is set, which is just
    // before the sheet presents.
    const exerciseId = exercise == null ? null : typeof exercise === 'string' ? exercise : exercise.id;
    const [startingNote, setStartingNote] = useState<string | null | undefined>(undefined);
    useEffect(() => {
      if (exerciseId == null) {
        setStartingNote(undefined);
        return;
      }
      const known = startingNotes.get(exerciseId);
      if (known !== undefined) {
        setStartingNote(known);
        return;
      }
      let cancelled = false;
      setStartingNote(undefined);
      getBeginnerNotes(exerciseId).then(
        (notes) => {
          const text = notes?.starting_weight_md?.trim() || null;
          if (text) startingNotes.set(exerciseId, text);
          if (!cancelled) setStartingNote(text);
        },
        () => {
          if (!cancelled) setStartingNote(null);
        },
      );
      return () => {
        cancelled = true;
      };
    }, [exerciseId]);

    useEffect(() => {
      if (exercise == null) {
        setLoaded(null);
        return;
      }
      // A card from a workout started on the phone may not have the
      // description yet (see START_EXERCISE_FIELDS): show what it has and
      // read the rest.
      if (typeof exercise !== 'string' && exercise.description !== undefined) {
        setLoaded(exercise);
        return;
      }
      let cancelled = false;
      setLoaded(typeof exercise === 'string' ? null : exercise);
      const partial = typeof exercise === 'string' ? null : exercise;
      getExercise(typeof exercise === 'string' ? exercise : exercise.id).then((row) => {
        if (!cancelled) setLoaded(row ?? partial);
      });
      return () => {
        cancelled = true;
      };
    }, [exercise]);

    // Full content width. Large on purpose: expo-image on iOS has skipped
    // animation on small animated images, and this is well clear of that.
    const heroSize = Math.min(width - spacing.screen * 2, 360);

    const steps = parseSteps(loaded?.description);

    // Held back until the note's read is in, so the generic paragraph never
    // flashes before the exercise's own.
    const startingWeight =
      !loaded || isCardio(loaded) || startingNote === undefined ? null : (startingNote ?? coldStartAdvice(loaded));

    const muscles = loaded
      ? [
          ...(loaded.primary_muscle ? [muscleLabel(loaded.primary_muscle)] : []),
          ...canonMuscleList(loaded.secondary_muscles).map(muscleLabel),
        ].filter((m, i, all) => m && all.indexOf(m) === i)
      : [];

    // One circle per view with lit muscles, zoomed to them. Front and Back
    // labels only when both show.
    const highlights = loaded ? bodyHighlights(loaded.primary_muscle, loaded.secondary_muscles) : null;
    const views = highlights
      ? (['anterior', 'posterior'] as BodyView[]).filter((v) => viewHasHighlights(highlights, v))
      : [];

    return (
      <Sheet ref={ref} scroll scrollRef={scrollRef} onDismiss={onDismiss}>
        {loaded ? (
          <View style={styles.body}>
            <View style={styles.heroWrap}>
              <ExerciseHero exercise={loaded} size={heroSize} />
            </View>

            <Text style={[type.screenTitle, { color: c.text }]}>{loaded.name}</Text>

            {highlights && views.length > 0 ? (
              <View style={styles.bodies}>
                {views.map((v) => (
                  <View key={v} style={styles.figure}>
                    <BodyDiagramCircle type={v} highlights={highlights} size={BODY_CIRCLE} background={c.surface2} />
                    {views.length > 1 ? (
                      <Text style={[type.label, { color: c.text3 }]}>{v === 'anterior' ? 'Front' : 'Back'}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            {muscles.length > 0 ? (
              <Row label="Muscles" value={muscles.join(', ')} c={c} />
            ) : null}
            {startingWeight ? (
              <View
                style={styles.row}
                // The sheet's content unmounts on dismiss, so this runs on
                // every presentation. Its offset in the body is its offset in
                // the scroll content.
                onLayout={(e) => {
                  if (scrollTo === 'starting-weight') {
                    scrollRef.current?.scrollTo({ y: e.nativeEvent.layout.y, animated: false });
                  }
                }}>
                <Text style={[type.label, { color: c.text3 }]}>Starting weight</Text>
                <Paragraphs text={startingWeight} />
              </View>
            ) : null}
            {loaded.equipment ? (
              <View style={styles.row}>
                <Text style={[type.label, { color: c.text3 }]}>Equipment</Text>
                <View style={styles.equipment}>
                  <EquipmentIcon equipment={loaded.equipment} size={18} color={c.text2} />
                  <Text style={[type.meta, { color: c.text, fontSize: 15 }]}>
                    {formatEquipmentLabel(loaded.equipment)}
                  </Text>
                </View>
              </View>
            ) : null}

            {steps.length > 0 ? (
              <View style={styles.row}>
                <Text style={[type.label, { color: c.text3 }]}>How to do it</Text>
                <ExerciseSteps steps={steps} />
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.loading}>
            <Text style={[type.meta, { color: c.text2 }]}>Loading…</Text>
          </View>
        )}
      </Sheet>
    );
  },
);

/** The body circle's diameter, in points. */
const BODY_CIRCLE = 130;

function Row({ label, value, c }: { label: string; value: string; c: { text: string; text3: string } }) {
  return (
    <View style={styles.row}>
      <Text style={[type.label, { color: c.text3 }]}>{label}</Text>
      <Text style={[type.meta, { color: c.text, fontSize: 15 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  heroWrap: { alignItems: 'center' },
  bodies: { flexDirection: 'row', gap: spacing.lg, alignSelf: 'center' },
  figure: { alignItems: 'center', gap: spacing.xs },
  row: { gap: 4 },
  equipment: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  loading: { paddingVertical: spacing.xl, alignItems: 'center' },
});
