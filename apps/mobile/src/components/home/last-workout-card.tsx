import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import type { LastWorkout } from '@/data/home';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';

function dateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function duration(startIso: string, endIso: string): string {
  const mins = Math.max(1, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`;
}

/** Name, date, duration, volume, exercise count. Tap for detail, Repeat to reuse. */
export function LastWorkoutCard({
  workout,
  unit,
  onOpen,
  onRepeat,
  busy,
}: {
  workout: LastWorkout;
  unit: string;
  onOpen: () => void;
  onRepeat: () => void;
  busy: boolean;
}) {
  const { scheme, colors: c } = useTheme();

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, cardSurface(scheme, c), pressed && styles.pressed]}>
      <View style={styles.head}>
        <View style={styles.text}>
          <Text style={[type.label, { color: c.text3 }]}>Last workout</Text>
          <Text style={[type.exerciseName, { color: c.text }]} numberOfLines={1}>
            {workout.name ?? 'Workout'}
          </Text>
          <Text style={[type.meta, { color: c.text2 }]}>{dateLabel(workout.workoutDate)}</Text>
        </View>
        <Pressable
          onPress={onRepeat}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.repeat,
            { borderColor: c.accent },
            (pressed || busy) && styles.pressed,
          ]}>
          <Text style={[type.button, { color: c.accentText }]}>{busy ? '…' : 'Repeat'}</Text>
        </Pressable>
      </View>

      <View style={styles.stats}>
        <Stat label="Duration" value={duration(workout.createdAt, workout.finishedAt)} c={c} />
        <Stat label="Volume" value={`${Math.round(workout.volume).toLocaleString()} ${unit}`} c={c} />
        <Stat label="Exercises" value={String(workout.exerciseCount)} c={c} />
      </View>
    </Pressable>
  );
}

function Stat({ label, value, c }: { label: string; value: string; c: { text: string; text3: string } }) {
  return (
    <View style={styles.stat}>
      <Text style={[type.restTime, { color: c.text }]}>{value}</Text>
      <Text style={[type.label, { color: c.text3 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: spacing.card,
    gap: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  text: { flex: 1, gap: 2 },
  repeat: {
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  stats: { flexDirection: 'row', gap: spacing.lg },
  stat: { gap: 2 },
  pressed: { opacity: 0.8 },
});
