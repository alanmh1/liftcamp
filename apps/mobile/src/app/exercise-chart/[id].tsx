import {
  EXERCISE_CHART_DEFAULT_PRESET,
  isExerciseChartPreset,
  type ExerciseChartMetric,
  type ExerciseChartPreset,
  type ExerciseSession,
} from '@liftcamp/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { ExerciseLineChart } from '@/components/exercises/exercise-line-chart';
import { ChartHeadline, ChartRangeControl, useChartView } from '@/components/exercises/exercise-progress-card';
import { Segmented } from '@/components/exercises/segmented';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { getExerciseProgress } from '@/data/exercise-progress';
import { getBodyweight, getExercise } from '@/data/workouts';
import { peekExerciseChart } from '@/lib/exercise-chart-handoff';
import { useTheme } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

const METRICS: { key: ExerciseChartMetric; label: string }[] = [
  { key: 'estimatedMax', label: 'Est. 1RM' },
  { key: 'heaviest', label: 'Heaviest weight' },
];

/**
 * One exercise's progress chart, full screen, pushed from the History tab's
 * card: the latest value and the change over the range, a toggle between
 * the best estimated max and the heaviest weight per session, a larger
 * chart with press-and-drag scrubbing, and the same range presets.
 *
 * Draws from the sessions the exercise screen handed over
 * (lib/exercise-chart-handoff), so it opens at once. Opened any other way
 * (a deep link, a relaunch onto it) it reads them itself.
 */
export default function ExerciseChartScreen() {
  const { id, range } = useLocalSearchParams<{ id: string; range?: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { colors: c } = useTheme();
  const { unit, label, loading: unitLoading } = useWeightUnit();
  const { height: windowHeight } = useWindowDimensions();

  const handoff = id ? peekExerciseChart(id, unit) : null;
  const [loaded, setLoaded] = useState<{ name: string; sessions: ExerciseSession[] } | null>(handoff);
  const [failed, setFailed] = useState(false);
  const [preset, setPreset] = useState<ExerciseChartPreset>(
    isExerciseChartPreset(range) ? range : EXERCISE_CHART_DEFAULT_PRESET,
  );
  const [metric, setMetric] = useState<ExerciseChartMetric>('estimatedMax');

  useEffect(() => {
    if (loaded || !userId || !id || unitLoading) return;
    let cancelled = false;
    (async () => {
      const exerciseRead = getExercise(id);
      const bodyweightRead = getBodyweight(userId);
      const [exercise, progress] = await Promise.all([
        exerciseRead,
        getExerciseProgress(userId, id, exerciseRead.then((e) => e ?? {}), bodyweightRead, unit),
      ]);
      if (cancelled) return;
      if (!exercise || !progress) {
        setFailed(true);
        return;
      }
      setLoaded({ name: exercise.name, sessions: progress.sessions });
    })();
    return () => {
      cancelled = true;
    };
  }, [loaded, userId, id, unit, unitLoading]);

  const view = useChartView(loaded?.sessions ?? [], metric, preset);
  const chartHeight = Math.round(Math.min(420, Math.max(220, windowHeight * 0.42)));

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ title: loaded?.name ?? '' }} />
      {loaded ? (
        <View style={styles.content}>
          <Segmented segments={METRICS} value={metric} onChange={setMetric} />
          <ChartHeadline view={view} preset={preset} />
          {view.points.length > 0 ? (
            <ExerciseLineChart
              // A new metric is a new line: draw it in again.
              key={metric}
              points={view.points}
              range={view.range}
              unit={unit}
              unitLabel={label}
              height={chartHeight}
              scrub
            />
          ) : (
            <View style={{ height: chartHeight }} />
          )}
          <ChartRangeControl preset={preset} onChange={setPreset} />
          <Text style={[type.meta, styles.hint, { color: c.text3 }]}>Press and drag the chart to see each session.</Text>
        </View>
      ) : failed ? (
        <Text style={[type.meta, styles.failed, { color: c.text2 }]}>Could not load this chart. Check your connection and try again.</Text>
      ) : (
        <ActivityIndicator style={styles.failed} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: spacing.screen, paddingTop: spacing.md, gap: spacing.lg },
  hint: { textAlign: 'center' },
  failed: { textAlign: 'center', paddingTop: spacing.xl, paddingHorizontal: spacing.screen },
});
