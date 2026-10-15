import {
  addMonths,
  calendarRange,
  calendarTitle,
  isoFromLocalDate,
  monthCountLine,
  monthGrid,
  workoutsByDay,
  workoutsInMonth,
} from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, tabular, type } from '@/theme/tokens';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
/** The filled circle behind a day number. Seven fit across the narrowest iPhone. */
const DAY_SIZE = 34;
/** A swipe changes month past this distance, or a flick past this speed. */
const SWIPE_DISTANCE = 50;
const SWIPE_VELOCITY = 500;

/**
 * The month calendar at the top of History: a Monday-first grid, the same
 * week as the week card, with every day that has a finished workout filled
 * in accent (they are tappable) and today outlined the way the week card
 * outlines it. Chevrons or a horizontal swipe change month, from the month
 * of the first workout up to this one, never a future month. The line
 * under the grid counts the month's workouts.
 *
 * `dates` are finished workout dates, one per workout (Home's streak
 * read); the rules are in packages/shared month-calendar.ts. `onSelectDay`
 * gets the YYYY-MM-DD of a tapped workout day. The month shown is the
 * calendar's own; `initialMonth` (YYYY-MM) sets where it opens, this
 * month when not given.
 */
export function MonthCalendar({
  dates,
  today = new Date(),
  initialMonth,
  onSelectDay,
}: {
  dates: readonly string[];
  today?: Date;
  initialMonth?: string;
  onSelectDay?: (iso: string) => void;
}) {
  const { scheme, colors: c } = useTheme();
  const todayIso = isoFromLocalDate(today);
  const { first, last } = calendarRange(dates, today);
  const [picked, setPicked] = useState(() => initialMonth ?? todayIso.slice(0, 7));
  // Held inside the range as it moves: a new day's first workout moves
  // `last`, a deleted history moves `first`.
  const month = picked < first ? first : picked > last ? last : picked;

  const byDay = useMemo(() => workoutsByDay(dates), [dates]);
  const weeks = useMemo(() => monthGrid(month), [month]);
  const count = workoutsInMonth(byDay, month);
  const canBack = month > first;
  const canForward = month < last;

  function step(n: number) {
    setPicked(addMonths(month, n));
  }

  // Horizontal drags only, so a vertical drag still scrolls the list.
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      if ((e.translationX < -SWIPE_DISTANCE || e.velocityX < -SWIPE_VELOCITY) && canForward) step(1);
      else if ((e.translationX > SWIPE_DISTANCE || e.velocityX > SWIPE_VELOCITY) && canBack) step(-1);
    });

  return (
    <GestureDetector gesture={swipe}>
      <View style={[styles.card, cardSurface(scheme, c)]}>
        <View style={styles.header}>
          <Text style={[type.exerciseName, styles.title, { color: c.text }]} accessibilityRole="header">
            {calendarTitle(month)}
          </Text>
          <Chevron direction="left" enabled={canBack} onPress={() => step(-1)} />
          <Chevron direction="right" enabled={canForward} onPress={() => step(1)} />
        </View>

        <View style={styles.week}>
          {DAY_LETTERS.map((letter, i) => (
            <Text key={i} style={[styles.letter, { color: c.text3 }]} importantForAccessibility="no">
              {letter}
            </Text>
          ))}
        </View>

        <Animated.View key={month} entering={FadeIn.duration(180)} style={styles.grid}>
          {weeks.map((week, w) => (
            <View key={w} style={styles.week}>
              {week.map((iso, d) => {
                if (!iso) return <View key={d} style={styles.cell} />;
                const workouts = byDay.get(iso) ?? 0;
                const isToday = iso === todayIso;
                const dayNumber = String(Number(iso.slice(8)));
                const circle = [
                  styles.day,
                  workouts > 0 && { backgroundColor: c.accent },
                  isToday && { borderColor: c.accentText },
                ];
                const numberStyle = [
                  styles.number,
                  { color: workouts > 0 ? '#FFFFFF' : iso > todayIso ? c.text3 : c.text },
                  (workouts > 0 || isToday) && styles.numberStrong,
                ];
                if (workouts === 0) {
                  return (
                    <View key={d} style={styles.cell} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                      <View style={circle}>
                        <Text style={numberStyle}>{dayNumber}</Text>
                      </View>
                    </View>
                  );
                }
                return (
                  <Pressable
                    key={d}
                    onPress={() => onSelectDay?.(iso)}
                    accessibilityRole="button"
                    accessibilityLabel={`${dayLabel(iso)}, ${workouts} ${workouts === 1 ? 'workout' : 'workouts'}`}
                    hitSlop={2}
                    style={({ pressed }) => [styles.cell, pressed && styles.pressed]}>
                    <View style={circle}>
                      <Text style={numberStyle}>{dayNumber}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </Animated.View>

        <Text style={[type.meta, { color: c.text2 }]}>{monthCountLine(count, month)}</Text>
      </View>
    </GestureDetector>
  );
}

/** "Monday, September 14". */
function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function Chevron({ direction, enabled, onPress }: { direction: 'left' | 'right'; enabled: boolean; onPress: () => void }) {
  const { colors: c } = useTheme();
  const tint = enabled ? c.accentText : c.text3;
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={direction === 'left' ? 'Previous month' : 'Next month'}
      accessibilityState={{ disabled: !enabled }}
      hitSlop={6}
      style={({ pressed }) => [styles.chevron, !enabled && styles.disabled, pressed && styles.pressed]}>
      <SymbolView
        name={
          direction === 'left'
            ? { ios: 'chevron.left', android: 'chevron_left' }
            : { ios: 'chevron.right', android: 'chevron_right' }
        }
        size={17}
        weight="semibold"
        tintColor={tint}
        fallback={<Text style={[styles.chevronText, { color: tint }]}>{direction === 'left' ? '‹' : '›'}</Text>}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: spacing.card,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { flex: 1 },
  chevron: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  chevronText: { fontSize: 22, lineHeight: 24 },
  disabled: { opacity: 0.4 },
  week: { flexDirection: 'row' },
  grid: { gap: 2 },
  letter: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '600' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', height: DAY_SIZE + 4 },
  // One border width on every day, so today's outline shifts nothing.
  day: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: { fontSize: 15, fontWeight: '400', ...tabular },
  numberStrong: { fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
