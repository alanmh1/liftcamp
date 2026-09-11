import { canonMuscleList, muscleLabel } from '@liftcamp/shared';
import { forwardRef, useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { ExerciseHero } from '@/components/exercise-media';
import { getExercise, type ExerciseInfo } from '@/data/workouts';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

/**
 * What an exercise is: animation, name, muscles, equipment, description.
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
export const ExerciseInfoSheet = forwardRef<SheetRef, { exercise: ExerciseInfo | string | null }>(
  function ExerciseInfoSheet({ exercise }, ref) {
    const c = useColors();
    const { width } = useWindowDimensions();
    const [loaded, setLoaded] = useState<ExerciseInfo | null>(null);

    useEffect(() => {
      if (exercise == null) {
        setLoaded(null);
        return;
      }
      if (typeof exercise !== 'string') {
        setLoaded(exercise);
        return;
      }
      let cancelled = false;
      setLoaded(null);
      getExercise(exercise).then((row) => {
        if (!cancelled) setLoaded(row);
      });
      return () => {
        cancelled = true;
      };
    }, [exercise]);

    // Full content width. Large on purpose: expo-image on iOS has skipped
    // animation on small animated images, and this is well clear of that.
    const heroSize = Math.min(width - spacing.screen * 2, 360);

    const muscles = loaded
      ? [
          ...(loaded.primary_muscle ? [muscleLabel(loaded.primary_muscle)] : []),
          ...canonMuscleList(loaded.secondary_muscles).map(muscleLabel),
        ].filter((m, i, all) => m && all.indexOf(m) === i)
      : [];

    return (
      <Sheet ref={ref}>
        {loaded ? (
          <View style={styles.body}>
            <View style={styles.heroWrap}>
              <ExerciseHero exercise={loaded} size={heroSize} />
            </View>

            <Text style={[type.screenTitle, { color: c.text }]}>{loaded.name}</Text>

            {muscles.length > 0 ? (
              <Row label="Muscles" value={muscles.join(', ')} c={c} />
            ) : null}
            {loaded.equipment ? <Row label="Equipment" value={loaded.equipment} c={c} /> : null}

            {loaded.description?.trim() ? (
              <Text style={[type.meta, styles.description, { color: c.text }]}>
                {loaded.description.trim()}
              </Text>
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
  row: { gap: 2 },
  description: { fontSize: 15, lineHeight: 22 },
  loading: { paddingVertical: spacing.xl, alignItems: 'center' },
});
