import { formatSetWeight } from '@liftcamp/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { PrRibbon } from '@/components/workout/pr-ribbon';
import { useColors } from '@/theme/theme-provider';
import { COLUMNS, COLUMNS_BASE_WIDTH, radius, spacing, type } from '@/theme/tokens';

export type TableSet = {
  id: string;
  weight: string | null;
  weight_value: number | null;
  reps: number | null;
  completed: boolean;
  note: string | null;
};

/** Dims a set the user left unchecked. It happened, it just was not done. */
const INCOMPLETE_OPACITY = 0.45;

/**
 * A read-only set table: set number, weight and reps, a PR ribbon on the
 * sets whose ids are in `prSetIds`, and the note under a row when there is
 * one. The set column is the active screen's `COLUMNS.set` scaled to the
 * table's width, so the numbers sit where they did while logging; the
 * ribbon cell is the width of that screen's done column. Weight and reps
 * share the middle. `repsOnly` drops the weight for a rep-based exercise.
 */
export function SetTable({
  sets,
  weightType,
  unit,
  prSetIds,
  repsOnly = false,
}: {
  sets: TableSet[];
  weightType: string | null;
  unit: string;
  prSetIds: Set<string> | null;
  repsOnly?: boolean;
}) {
  const c = useColors();
  const [inner, setInner] = useState(0);
  const factor = inner > 0 ? inner / COLUMNS_BASE_WIDTH : 1;
  const setWidth = COLUMNS.set * factor;
  const prWidth = COLUMNS.done * factor;

  return (
    <View style={styles.table} onLayout={(e) => setInner(e.nativeEvent.layout.width)}>
      <View style={styles.columns}>
        <Text style={[type.label, styles.centerText, { color: c.text3, width: setWidth }]}>Set</Text>
        <Text style={[type.label, styles.fill, { color: c.text3 }]}>{repsOnly ? 'Reps' : 'Weight & reps'}</Text>
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
              <Text style={[type.prevNumeral, styles.centerText, { color: c.text3, width: setWidth }]}>
                {i + 1}
              </Text>
              <Text style={[type.setNumeral, styles.fill, { color: c.text }]} numberOfLines={1}>
                {repsOnly ? reps : formatSetWeight(s, weightType, unit)}
                {!repsOnly && reps ? <Text style={[type.setNumeral, { color: c.text2 }]}> {reps}</Text> : null}
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
