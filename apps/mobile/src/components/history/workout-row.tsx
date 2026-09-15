import { formatDuration } from '@liftcamp/shared';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { PrRibbon } from '@/components/workout/pr-ribbon';
import type { HistoryWorkout } from '@/data/history';
import { useTheme } from '@/theme/theme-provider';
import { listSurface, radius, spacing, type } from '@/theme/tokens';

/** Wide enough for "31" in the set numeral size, so names start in line. */
const DATE_COLUMN = 40;

/** "14" and "Sun". The month header above the row carries the rest. */
function dayParts(iso: string): { day: string; weekday: string } {
  // Local midnight. `new Date(iso)` alone parses as UTC and can land on the
  // previous day west of Greenwich.
  const d = new Date(`${iso}T00:00:00`);
  return {
    day: String(d.getDate()),
    weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
  };
}

/** One finished workout. Tap opens its detail on the history stack. */
export function WorkoutRow({ workout, unit }: { workout: HistoryWorkout; unit: string }) {
  const { scheme, colors: c } = useTheme();
  const router = useRouter();
  const { day, weekday } = dayParts(workout.workoutDate);
  const exercises = `${workout.exerciseCount} ${workout.exerciseCount === 1 ? 'exercise' : 'exercises'}`;
  const prs = workout.prCount ?? 0;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/history/[id]', params: { id: workout.id } })}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, listSurface(scheme, c), pressed && styles.pressed]}>
      <View style={styles.date}>
        <Text style={[type.setNumeral, { color: c.text }]}>{day}</Text>
        <Text style={[type.label, { color: c.text3 }]}>{weekday}</Text>
      </View>

      <View style={styles.body}>
        <Text style={[type.exerciseName, { color: c.text }]} numberOfLines={1}>
          {workout.name?.trim() || 'Workout'}
        </Text>
        <Text style={[type.meta, { color: c.text2 }]} numberOfLines={1}>
          {formatDuration(workout.createdAt, workout.finishedAt)} · {exercises}
        </Text>
      </View>

      <View style={styles.stats}>
        <Text style={[type.restTime, { color: c.text }]}>
          {Math.round(workout.volume).toLocaleString()} {unit}
        </Text>
        {prs > 0 ? (
          <View style={styles.pr}>
            <PrRibbon size={16} />
            <Text style={[type.prevNumeral, { color: c.text2 }]}>{prs}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.bar,
    padding: spacing.card,
  },
  date: { width: DATE_COLUMN, alignItems: 'center', gap: 2 },
  body: { flex: 1, gap: 2 },
  stats: { alignItems: 'flex-end', gap: 2 },
  pr: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pressed: { opacity: 0.8 },
});
