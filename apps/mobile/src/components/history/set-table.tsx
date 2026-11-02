import { asWeightUnit, formatCardioSet, formatSetWeight, isWarmupSet, setBadges, tidyWeight } from '@liftcamp/shared';
import { StyleSheet, View } from 'react-native';

import { SkeletonText } from '@/components/skeleton';
import { Text } from '@/components/text';
import { PrRibbon } from '@/components/workout/pr-ribbon';
import { useColors } from '@/theme/theme-provider';
import { COLUMNS, radius, spacing, type } from '@/theme/tokens';

export type TableSet = {
  id: string;
  weight: string | null;
  weight_value: number | null;
  reps: number | null;
  /** Cardio only. */
  duration_seconds?: number | null;
  distance_meters?: number | null;
  incline_percent?: number | null;
  completed: boolean;
  note: string | null;
  /** 'warmup' for a Pro warm-up row: badged W, and the working sets after it number from 1. */
  set_type?: string | null;
};

/** Dims a set the user left unchecked. It happened, it just was not done. */
const INCOMPLETE_OPACITY = 0.45;

/**
 * A read-only set table: set number ("W" for a warm-up, then the working
 * sets from 1, as the live card numbers them), weight and reps, a PR ribbon on the
 * sets whose ids are in `prSetIds`, and the note under a row when there is
 * one. The set column is the active screen's `COLUMNS.set`, so the numbers
 * sit where they did while logging; the ribbon cell is the width of that
 * screen's done column. Weight and reps
 * share the middle. `repsOnly` drops the weight for a rep-based exercise.
 * `cardio` prints each set's time and distance instead, "25:00 · 3.2 km".
 */
export function SetTable({
  sets,
  weightType,
  unit,
  prSetIds,
  repsOnly = false,
  cardio = false,
}: {
  sets: TableSet[];
  weightType: string | null;
  unit: string;
  prSetIds: Set<string> | null;
  repsOnly?: boolean;
  cardio?: boolean;
}) {
  const c = useColors();
  const setWidth = COLUMNS.set;
  const prWidth = COLUMNS.done;
  const badges = setBadges(sets);

  return (
    <View style={styles.table}>
      <View style={styles.columns}>
        <Text style={[type.label, styles.centerText, { color: c.text3, width: setWidth }]}>Set</Text>
        <Text style={[type.label, styles.fill, { color: c.text3 }]}>{cardio ? 'Time & distance' : repsOnly ? 'Reps' : 'Weight & reps'}</Text>
        <View style={{ width: prWidth }} />
      </View>

      {sets.map((s, i) => {
        const isPr = s.completed && prSetIds != null && prSetIds.has(s.id);
        const reps = s.reps == null ? '' : repsOnly ? String(s.reps) : `× ${s.reps}`;
        return (
          <View
            key={s.id}
            style={[
              styles.setRow,
              i % 2 === 1 && { backgroundColor: c.surface2 },
              !s.completed && styles.incomplete,
            ]}>
            <View style={styles.setLine}>
              <Text
                style={[type.prevNumeral, styles.centerText, { color: c.text3, width: setWidth }]}
                accessibilityLabel={isWarmupSet(s) ? 'Warm-up set' : undefined}>
                {badges[i]}
              </Text>
              <Text style={[type.setNumeral, styles.fill, { color: c.text }]} numberOfLines={1}>
                {cardio
                  ? (formatCardioSet(s, asWeightUnit(unit)) ?? '—')
                  : repsOnly
                    ? reps
                    : formatSetWeight(
                        { ...s, weight_value: tidyWeight(s.weight_value, asWeightUnit(unit)) },
                        weightType,
                        unit,
                      )}
                {!cardio && !repsOnly && reps ? <Text style={[type.setNumeral, { color: c.text2 }]}> {reps}</Text> : null}
              </Text>
              <View style={[styles.prCell, { width: prWidth }]}>
                {isPr ? <PrRibbon size={18} /> : null}
              </View>
            </View>
            {s.note?.trim() ? (
              <Text style={[type.meta, styles.setNote, { color: c.text2, marginLeft: setWidth }]}>
                {s.note.trim()}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** The table's shape while it loads: the column labels and `rows` rows. */
export function SetTableSkeleton({ rows }: { rows: number }) {
  const c = useColors();
  const setWidth = COLUMNS.set;

  return (
    <View style={styles.table}>
      <View style={styles.columns}>
        <Text style={[type.label, styles.centerText, { color: c.text3, width: setWidth }]}>Set</Text>
        <Text style={[type.label, styles.fill, { color: c.text3 }]}>Weight & reps</Text>
      </View>
      {Array.from({ length: rows }, (_, i) => (
        // Unstriped: a surface2 bar on a surface2 stripe would not show.
        <View key={i} style={styles.setRow}>
          <View style={styles.setLine}>
            <Text style={[type.prevNumeral, styles.centerText, { color: c.text3, width: setWidth }]}>
              {i + 1}
            </Text>
            <SkeletonText variant={type.setNumeral} width={96} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centerText: { textAlign: 'center' },
  table: { gap: 2 },
  columns: { flexDirection: 'row', alignItems: 'center', paddingBottom: 2 },
  setRow: { borderRadius: radius.input, paddingVertical: spacing.sm },
  setLine: { flexDirection: 'row', alignItems: 'center' },
  prCell: { alignItems: 'center' },
  setNote: { paddingTop: spacing.xs, paddingRight: spacing.sm },
  incomplete: { opacity: INCOMPLETE_OPACITY },
});
