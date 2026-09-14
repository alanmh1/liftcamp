import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ExerciseThumb } from '@/components/exercise-media';
import type { ExerciseInfo } from '@/data/workouts';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/**
 * The empty workout's starting point: the user's recent exercises with a
 * one-tap add, the same idea the web picker opens on. Laid out as a grouped
 * list to match the picker. `+ Add exercise` below it still opens the full
 * picker.
 */
export function RecentExercises({
  exercises,
  busyId,
  onAdd,
}: {
  exercises: ExerciseInfo[];
  busyId: string | null;
  onAdd: (exercise: ExerciseInfo) => void;
}) {
  const c = useColors();

  if (exercises.length === 0) {
    return (
      <Text style={[type.meta, styles.empty, { color: c.text2 }]}>
        Add an exercise to get started. Ones you log will show up here for quick adding.
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={[type.label, styles.heading, { color: c.text3 }]}>Your recent exercises</Text>
      <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.border }]}>
        {exercises.map((ex, i) => (
          <View key={ex.id}>
            {/* The whole row adds. The plus at the right is an affordance, not
                the target, so it is quiet: white disc, light border, grey glyph. */}
            <Pressable
              onPress={() => onAdd(ex)}
              disabled={busyId !== null}
              accessibilityRole="button"
              accessibilityLabel={`Add ${ex.name}`}
              accessibilityState={{ busy: busyId === ex.id, disabled: busyId !== null }}
              style={({ pressed }) => [
                styles.row,
                (pressed || busyId === ex.id) && { backgroundColor: c.surface2 },
              ]}>
              <ExerciseThumb exercise={ex} size={40} />
              <Text style={[type.exerciseName, styles.name, { color: c.text }]} numberOfLines={2}>
                {ex.name}
              </Text>
              <View style={[styles.plus, { borderColor: c.border }]}>
                <SymbolView
                  name="plus"
                  size={14}
                  weight="semibold"
                  tintColor={c.text3}
                  fallback={<Text style={[styles.plusFallback, { color: c.text3 }]}>+</Text>}
                />
              </View>
            </Pressable>
            {i < exercises.length - 1 ? (
              <View style={[styles.separator, { backgroundColor: c.border }]} />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  heading: { paddingHorizontal: spacing.xs },
  group: {
    borderRadius: radius.bar,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.sm,
  },
  name: { flex: 1 },
  plus: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  plusFallback: { fontSize: 16, fontWeight: '600', lineHeight: 18 },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.md + 40 + spacing.md,
  },
  empty: { textAlign: 'center', paddingVertical: spacing.xl },
});
