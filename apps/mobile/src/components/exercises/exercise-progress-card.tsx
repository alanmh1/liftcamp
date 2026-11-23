import {
  chartChangeLabel,
  chartValueLabel,
  EXERCISE_CHART_DEFAULT_PRESET,
  EXERCISE_CHART_PRESETS,
  exerciseChartView,
  isExerciseChartPreset,
  sessionSeries,
  type ExerciseChartMetric,
  type ExerciseChartPreset,
  type ExerciseChartView,
  type ExerciseSession,
} from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ExerciseLineChart } from '@/components/exercises/exercise-line-chart';
import { RangeControl } from '@/components/progress/range-control';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, pressedFlat, radius, spacing, tabular, type } from '@/theme/tokens';

const CARD_CHART_HEIGHT = 120;

/**
 * The header over an exercise progress chart: the latest value, large,
 * and the change over the range under it ("+12.4 kg in 6 months").
 */
export function ChartHeadline({ view, preset }: { view: ExerciseChartView; preset: ExerciseChartPreset }) {
  const { colors: c } = useTheme();
  const { label } = useWeightUnit();
  const change = chartChangeLabel(view.change, preset, label);
  return (
    <View style={styles.headline}>
      <Text style={[styles.value, { color: c.text }]}>{view.current != null ? chartValueLabel(view.current, label) : ' '}</Text>
      <Text style={[type.meta, tabular, { color: c.text2 }]}>{change ?? 'Nothing in this range yet'}</Text>
    </View>
  );
}

/** The range's points and numbers for a metric, from the sessions the exercise screen read. */
export function useChartView(
  sessions: readonly ExerciseSession[],
  metric: ExerciseChartMetric,
  preset: ExerciseChartPreset,
): ExerciseChartView {
  const series = useMemo(() => sessionSeries(sessions, metric), [sessions, metric]);
  // Keyed on today's date only through `preset`; a screen left open past
  // midnight keeps yesterday's range until the next change, which is fine.
  return useMemo(() => exerciseChartView(series, preset, new Date()), [series, preset]);
}

/** The preset row under a chart: Trends' segmented track, presets only. */
export function ChartRangeControl({
  preset,
  onChange,
}: {
  preset: ExerciseChartPreset;
  onChange: (next: ExerciseChartPreset) => void;
}) {
  return (
    <RangeControl
      presets={EXERCISE_CHART_PRESETS}
      choice={preset}
      onChange={(next) => {
        if (isExerciseChartPreset(next)) onChange(next);
      }}
      firstWorkoutDate={null}
      custom={false}
    />
  );
}

/**
 * The History tab's progress card: the best estimated max per session as
 * a line over 3M, 6M (the default), 1Y or All. Tapping anywhere but the
 * range opens the fullscreen chart on the same range. The caller decides
 * whether it shows (showsExerciseChart in shared). Free for everyone.
 */
export function ExerciseProgressCard({
  sessions,
  onOpen,
}: {
  sessions: readonly ExerciseSession[];
  onOpen: (preset: ExerciseChartPreset) => void;
}) {
  const { scheme, colors: c } = useTheme();
  const { unit, label } = useWeightUnit();
  const [preset, setPreset] = useState<ExerciseChartPreset>(EXERCISE_CHART_DEFAULT_PRESET);
  const view = useChartView(sessions, 'estimatedMax', preset);
  const change = chartChangeLabel(view.change, preset, label);

  return (
    <View style={[styles.card, cardSurface(scheme, c)]}>
      <Pressable
        onPress={() => onOpen(preset)}
        accessibilityRole="button"
        accessibilityLabel={`Estimated max${view.current != null ? `, ${chartValueLabel(view.current, label)}` : ''}${change ? `, ${change}` : ''}`}
        accessibilityHint="Opens the full chart"
        style={({ pressed }) => [styles.tapArea, pressed && [styles.pressed, pressedFlat]]}>
        <View style={styles.titleRow}>
          <Text style={[type.label, styles.flex, { color: c.text3 }]}>Estimated max</Text>
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right' }}
            size={16}
            tintColor={c.text3}
            fallback={<Text style={[type.meta, { color: c.text3 }]}>›</Text>}
          />
        </View>
        <ChartHeadline view={view} preset={preset} />
        <View pointerEvents="none">
          {view.points.length > 0 ? (
            <ExerciseLineChart points={view.points} range={view.range} unit={unit} unitLabel={label} height={CARD_CHART_HEIGHT} />
          ) : (
            <View style={[styles.empty, { height: CARD_CHART_HEIGHT }]} />
          )}
        </View>
      </Pressable>
      <ChartRangeControl preset={preset} onChange={setPreset} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, padding: spacing.card, gap: spacing.md },
  tapArea: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
  headline: { gap: 2 },
  value: { fontSize: 28, fontWeight: '600', letterSpacing: -0.4, ...tabular },
  empty: { alignSelf: 'stretch' },
  pressed: { opacity: 0.7 },
});
