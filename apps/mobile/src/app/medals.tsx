import type { CabinetRung, MedalCabinet } from '@liftcamp/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { Medal } from '@/components/medals/medal';
import { weeksToGo } from '@/components/medals/medal-shelf';
import { SkeletonCircle, SkeletonText } from '@/components/skeleton';
import { Text } from '@/components/text';
import { getStreakWorkoutDates, getWeeklyTarget } from '@/data/home';
import { buildCabinet, getStoredMedals } from '@/data/medals';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing, tabular, type } from '@/theme/tokens';

const SIZE = 72;
const COLUMNS = 3;

/** "Sep 18, 2026". */
function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * The medal cabinet, pushed from Profile's medal row. Every rung of the
 * ladder through 104 weeks, and past it up to the next one: earned medals
 * with the date first earned and a ×N count when earned more than once,
 * locked ones dimmed, the next one with the weeks it still needs.
 *
 * Reads the same three things as Profile (finished dates, the weekly
 * target, the stored medals) on every focus, so it stands on its own.
 */
export default function MedalsScreen() {
  const { session } = useAuth();
  const { colors: c } = useTheme();
  const userId = session?.user.id;
  const [cabinet, setCabinet] = useState<MedalCabinet | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      void Promise.all([getStreakWorkoutDates(userId), getWeeklyTarget(userId), getStoredMedals(userId)]).then(
        ([dates, target, stored]) => {
          if (!cancelled) setCabinet(buildCabinet(stored, dates, target));
        },
      );
      return () => {
        cancelled = true;
      };
    }, [userId]),
  );

  return (
    <ScrollView
      {...scrollInsetProps}
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.content}>
      <Text style={[type.meta, styles.intro, { color: c.text2 }]}>
        Hit your weekly target week after week to earn these. A streak that breaks can earn them again.
      </Text>
      <View style={styles.grid}>
        {cabinet
          ? cabinet.rungs.map((r) => <Rung key={r.weeks} rung={r} next={cabinet.next} />)
          : Array.from({ length: 9 }, (_, i) => (
              <View key={i} style={styles.cell}>
                <SkeletonCircle size={SIZE} />
                <SkeletonText variant={type.button} width={64} />
              </View>
            ))}
      </View>
    </ScrollView>
  );
}

function Rung({ rung, next }: { rung: CabinetRung; next: MedalCabinet['next'] }) {
  const { colors: c } = useTheme();
  const earned = rung.count > 0;
  const isNext = rung.weeks === next.weeks;
  const sub = earned ? `First ${longDate(rung.firstEarnedOn!)}` : isNext ? weeksToGo(next.toGo) : 'Locked';
  const label = earned
    ? `${rung.weeks}-week medal, earned${rung.count > 1 ? ` ${rung.count} times` : ''}, first on ${longDate(rung.firstEarnedOn!)}`
    : `${rung.weeks}-week medal, locked${isNext ? `, ${weeksToGo(next.toGo)}` : ''}`;

  return (
    <View
      style={[styles.cell, !earned && !isNext && styles.dimmed]}
      accessible
      accessibilityLabel={label}>
      <View>
        <Medal weeks={rung.weeks} size={SIZE} variant={earned ? 'earned' : 'locked'} />
        {rung.count > 1 ? (
          <View style={[styles.count, { backgroundColor: c.accentSoft }]}>
            <Text style={[styles.countText, { color: c.accentText }]}>×{rung.count}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[type.button, styles.title, { color: earned ? c.text : c.text2 }]}>
        {rung.weeks} weeks
      </Text>
      <Text style={[styles.sub, { color: earned ? c.text2 : c.text3 }]} numberOfLines={1}>
        {sub}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screen, gap: spacing.xl, paddingBottom: SCROLL_END_PADDING },
  intro: { fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.xl },
  cell: { width: `${100 / COLUMNS}%`, alignItems: 'center', gap: spacing.xs },
  dimmed: { opacity: 0.5 },
  title: { marginTop: spacing.xs, ...tabular },
  sub: { fontSize: 12, fontWeight: '500', ...tabular },
  count: {
    position: 'absolute',
    right: -6,
    top: -4,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countText: { fontSize: 12, fontWeight: '700', ...tabular },
});
