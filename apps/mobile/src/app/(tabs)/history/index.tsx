import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { MonthHeader, monthTitle } from '@/components/history/month-header';
import { WorkoutRow } from '@/components/history/workout-row';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import {
  getWorkoutHistory,
  loadHistoryContext,
  type HistoryContext,
  type HistoryWorkout,
} from '@/data/history';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

type MonthSection = { key: string; title: string; data: HistoryWorkout[] };

/** Groups by the `YYYY-MM` of `workout_date`, keeping the newest-first order. */
function groupByMonth(workouts: HistoryWorkout[]): MonthSection[] {
  const sections: MonthSection[] = [];
  let current: MonthSection | null = null;
  for (const w of workouts) {
    const key = w.workoutDate.slice(0, 7);
    if (!current || current.key !== key) {
      current = { key, title: monthTitle(key), data: [] };
      sections.push(current);
    }
    current.data.push(w);
  }
  return sections;
}

/**
 * Finished workouts, newest first, under month headers. Home answers what to
 * train today; this screen answers what has been trained. Tapping a row
 * pushes that workout's detail on the history stack.
 */
export default function HistoryScreen() {
  const { session } = useAuth();
  const c = useColors();
  const { label: unit, unit: weightUnit, loading: unitLoading } = useWeightUnit();
  const userId = session?.user.id;

  // Null until the first page lands, so the empty state cannot flash before
  // the data does.
  const [workouts, setWorkouts] = useState<HistoryWorkout[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Bodyweight and the PR tally, fetched once per screen load and reused by
  // every page. Kept in a ref so the paging callback stays stable.
  const ctxRef = useRef<HistoryContext | null>(null);
  // One load at a time, and a reload started on focus supersedes any page
  // still in flight from before it.
  const inFlight = useRef(false);
  const generation = useRef(0);

  const reload = useCallback(async () => {
    if (!userId || unitLoading) return;
    const gen = ++generation.current;
    inFlight.current = true;
    try {
      const ctx = await loadHistoryContext(userId, weightUnit);
      const page = await getWorkoutHistory(userId, 0, ctx);
      if (gen !== generation.current) return;
      ctxRef.current = ctx;
      setWorkouts(page.workouts);
      setHasMore(page.hasMore);
    } finally {
      if (gen === generation.current) inFlight.current = false;
    }
  }, [userId, weightUnit, unitLoading]);

  // Refetch on focus, the way Home does, so a workout finished since the
  // last visit is at the top without a pull to refresh.
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const loadMore = useCallback(async () => {
    const ctx = ctxRef.current;
    if (!userId || !ctx || !hasMore || inFlight.current || !workouts) return;
    const gen = generation.current;
    inFlight.current = true;
    setLoadingMore(true);
    try {
      const page = await getWorkoutHistory(userId, workouts.length, ctx);
      if (gen !== generation.current) return;
      // A workout finished between two pages shifts every offset by one, so
      // the seam can hand back a row the list already has. Drop those.
      const seen = new Set(workouts.map((w) => w.id));
      const fresh = page.workouts.filter((w) => !seen.has(w.id));
      setWorkouts([...workouts, ...fresh]);
      setHasMore(page.hasMore);
    } finally {
      if (gen === generation.current) {
        inFlight.current = false;
        setLoadingMore(false);
      }
    }
  }, [userId, hasMore, workouts]);

  const sections = useMemo(() => groupByMonth(workouts ?? []), [workouts]);

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      {workouts === null ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : workouts.length === 0 ? (
        <View style={styles.center}>
          <Text style={[type.exerciseName, { color: c.text }]}>No workouts yet</Text>
          <Text style={[type.meta, { color: c.text2 }, styles.centerText]}>
            Finish your first workout and it will show up here.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(w) => w.id}
          renderItem={({ item }) => <WorkoutRow workout={item} unit={unit} />}
          renderSectionHeader={({ section }) => <MonthHeader title={section.title} />}
          ItemSeparatorComponent={Separator}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.footer} /> : <View style={styles.footer} />
          }
          // What lets the native large title collapse on scroll, as on Home.
          contentInsetAdjustmentBehavior="automatic"
          // Off on purpose. React Native pins a sticky header to the top of
          // the scroll view's frame, and under a native large-title header
          // that frame extends up behind the bar (the inset above is what
          // pushes content clear of it). A month header would therefore pin
          // behind the collapsed bar, out of sight, rather than beneath it.
          // Month headers scroll with their rows instead.
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xl },
  separator: { height: spacing.sm },
  footer: { paddingVertical: spacing.lg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.screen,
  },
  centerText: { textAlign: 'center' },
});
