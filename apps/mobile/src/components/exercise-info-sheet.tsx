import {
  canonMuscleList,
  formatEquipmentLabel,
  masksForMuscles,
  muscleLabel,
  parseSteps,
  splitStepParts,
} from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { forwardRef, useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { BodyDiagram } from '@/components/body-diagram';
import { EquipmentIcon } from '@/components/equipment-icon';
import { ExerciseHero } from '@/components/exercise-media';
import { Text } from '@/components/text';
import { getExercise, type ExerciseInfo } from '@/data/workouts';
import { useColors } from '@/theme/theme-provider';
import { spacing, tabular, type } from '@/theme/tokens';

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

    const steps = parseSteps(loaded?.description);

    const muscles = loaded
      ? [
          ...(loaded.primary_muscle ? [muscleLabel(loaded.primary_muscle)] : []),
          ...canonMuscleList(loaded.secondary_muscles).map(muscleLabel),
        ].filter((m, i, all) => m && all.indexOf(m) === i)
      : [];

    // Front and back figures, the same data shape the web diagram takes.
    const bodyData = loaded
      ? [
          { name: 'primary', muscles: masksForMuscles(loaded.primary_muscle), frequency: 2 },
          { name: 'secondary', muscles: masksForMuscles(loaded.secondary_muscles), frequency: 1 },
        ].filter((entry) => entry.muscles.length > 0)
      : [];

    return (
      <Sheet ref={ref} scroll>
        {loaded ? (
          <View style={styles.body}>
            <View style={styles.heroWrap}>
              <ExerciseHero exercise={loaded} size={heroSize} />
            </View>

            <Text style={[type.screenTitle, { color: c.text }]}>{loaded.name}</Text>

            <View style={styles.bodies}>
              <View style={styles.figure}>
                <BodyDiagram type="anterior" data={bodyData} />
              </View>
              <View style={styles.figure}>
                <BodyDiagram type="posterior" data={bodyData} />
              </View>
            </View>

            {muscles.length > 0 ? (
              <Row label="Muscles" value={muscles.join(', ')} c={c} />
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
                <View style={styles.steps}>
                  {steps.map((step, i) => (
                    <View key={i} style={styles.step}>
                      <Text style={[type.prevNumeral, styles.stepNumber, { color: c.text3 }]}>
                        {i + 1}
                      </Text>
                      <View style={styles.stepText}>
                        {splitStepParts(step).map((part, j) => (
                          <View key={j} style={styles.part}>
                            {part.label ? <TipIcon color={c.tip} /> : null}
                            <Text style={[type.meta, styles.partText, { color: c.text }]}>
                              {part.label ? (
                                <Text style={styles.stepLabel}>{part.label}: </Text>
                              ) : null}
                              {part.text}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
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

/** Marks a Tip, Note or Caution aside. Amber `tip` token, never gold. */
function TipIcon({ color }: { color: string }) {
  return (
    <SymbolView
      name="lightbulb"
      size={16}
      tintColor={color}
      style={styles.tipIcon}
      fallback={
        <Svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={styles.tipIcon}>
          <Path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
          <Path d="M9 18h6" />
          <Path d="M10 22h4" />
        </Svg>
      }
    />
  );
}

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
  // Two figures side by side at the width the web uses, centred.
  bodies: { flexDirection: 'row', gap: spacing.md, alignSelf: 'center', width: 260 },
  figure: { flex: 1 },
  row: { gap: 4 },
  equipment: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  steps: { gap: spacing.md, paddingTop: 2 },
  step: { flexDirection: 'row', gap: spacing.md },
  stepNumber: { width: 18, textAlign: 'right', lineHeight: 22, fontWeight: '700', ...tabular },
  stepText: { flex: 1, gap: 4 },
  part: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  partText: { flex: 1, fontSize: 15, lineHeight: 22 },
  stepLabel: { fontWeight: '700' },
  tipIcon: { marginTop: 3 },
  loading: { paddingVertical: spacing.xl, alignItems: 'center' },
});
