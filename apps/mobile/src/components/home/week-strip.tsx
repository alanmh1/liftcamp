import { Pressable, StyleSheet, Text, View } from 'react-native';

import { localDateIso, startOfWeek } from '@/data/home';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * `This week`, seven weekday dots, and `N of target` in DM Mono, where N is
 * distinct days trained. Accent fill for a day with a finished workout, border
 * for the rest, today ringed. Weeks start Monday. Tapping opens History.
 */
export function WeekStrip({
  dates,
  target,
  onPress,
}: {
  dates: string[];
  target: number;
  onPress: () => void;
}) {
  const { scheme, colors: c } = useTheme();
  const monday = startOfWeek();
  const todayIso = localDateIso();
  // Days, not rows. The data layer already dedupes, and counting the Set here
  // keeps the number honest even if a caller passes raw dates.
  const done = new Set(dates);
  const count = done.size;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`This week: ${count} of ${target} workouts. Open history.`}
      style={({ pressed }) => [styles.card, cardSurface(scheme, c), pressed && styles.pressed]}>
      <Text style={[type.label, { color: c.text3 }]}>This week</Text>
      <View style={styles.row}>
        <View style={styles.dots}>
          {DAY_LETTERS.map((letter, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const iso = localDateIso(d);
            const trained = done.has(iso);
            const isToday = iso === todayIso;
            return (
              <View key={i} style={styles.day}>
                <View
                  style={[
                    styles.dot,
                    trained
                      ? { backgroundColor: c.accent, borderColor: c.accent }
                      : { borderColor: c.border },
                    isToday && { borderColor: c.accentText, borderWidth: 2 },
                  ]}
                />
                <Text style={[styles.letter, { color: isToday ? c.text : c.text3 }]}>{letter}</Text>
              </View>
            );
          })}
        </View>
        <Text style={[type.restTime, { color: c.text }]}>
          {count} of {target}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: spacing.card,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  dots: { flexDirection: 'row', gap: spacing.sm },
  day: { alignItems: 'center', gap: 4 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  letter: { fontSize: 10, fontWeight: '600' },
  pressed: { opacity: 0.8 },
});
