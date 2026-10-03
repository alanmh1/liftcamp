import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, SectionList, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { HeaderWorkoutButton } from '@/components/header-workout-button';
import { ScreenHeader } from '@/components/screen-header';
import { MonthCalendar } from '@/components/history/month-calendar';
import { MonthHeader, monthTitle } from '@/components/history/month-header';
import { ROUTINE_ART } from '@/components/home/routine-art';
import { WorkoutRow, WorkoutRowSkeleton } from '@/components/history/workout-row';
import { Reveal, SkeletonText } from '@/components/skeleton';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import {
  getWorkoutHistory,
  loadHistoryContext,
  type HistoryContext,
  type HistoryWorkout,
} from '@/data/history';
import { getStreakWorkoutDates } from '@/data/home';
import { scanCache } from '@/data/scan-cache';
import { markScreen } from '@/lib/launch-timing';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
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

/** Retries of a jump whose row has not been measured yet, before giving up. */
const JUMP_RETRIES = 6;

/**
 * Finished workouts, newest first, under month headers. Home answers what to
 * train today; this screen answers what has been trained. Tapping a row
 * pushes that workout's detail on the history stack.
 *
 * The month calendar heads the list. Its dates are Home's streak read
 * (every finished workout date), loaded with the first page; tapping a
 * day scrolls the list to that day's top row, paging in older workouts
 * first when the day is not loaded yet.
 */
export default function HistoryScreen() {
  const { session } = useAuth();
  const c = useColors();
  const { label: unit, unit: weightUnit, loading: unitLoading } = useWeightUnit();
  const userId = session?.user.id;

  // Null until the first page lands, so the empty state cannot flash before
  // the data does.
  const [workouts, setWorkouts] = useState<HistoryWorkout[] | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Bodyweight and the PR tally, fetched once per screen load and reused by
  // every page. Kept in a ref so the paging callback stays stable.
  const ctxRef = useRef<HistoryContext | null>(null);
  // One load at a time, and a reload started on focus supersedes any page
  // still in flight from before it.
  const inFlight = useRef(false);
  const generation = useRef(0);
  // Whether a list has been on screen yet, for the load timing marks.
  const shown = useRef(false);
  // What the list on screen was built from: the account, the unit, and the
  // scan cache's generation when the load started. While all three still
  // match, nothing the list shows can have changed, because every set and
  // workout write bumps that generation.
  const builtFrom = useRef<{ key: string; scanGeneration: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef<SectionList<HistoryWorkout, MonthSection>>(null);
  // The day a calendar tap asked for, scrolled to once the list has drawn
  // the rows it needs. `n` makes a second tap on the same day a new jump.
  const [jump, setJump] = useState<{ iso: string; n: number } | null>(null);
  const jumpRetries = useRef(0);

  const reload = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      if (!userId || unitLoading) return;
      const gen = ++generation.current;
      const key = `${userId}|${weightUnit}`;
      const scanGeneration = scanCache.generation;
      inFlight.current = true;
      try {
        const [ctx, allDates] = await Promise.all([
          loadHistoryContext(userId, weightUnit, { force }),
          getStreakWorkoutDates(userId),
        ]);
        const page = await getWorkoutHistory(userId, 0, ctx);
        if (gen !== generation.current) return;
        ctxRef.current = ctx;
        builtFrom.current = { key, scanGeneration };
        setDates(allDates);
        setWorkouts(page.workouts);
        setHasMore(page.hasMore);
        markScreen('history', shown.current ? 'fresh' : 'content');
        shown.current = true;
      } finally {
        if (gen === generation.current) inFlight.current = false;
      }
    },
    [userId, weightUnit, unitLoading],
  );

  // On focus, the list stays as it is unless something was written since
  // it loaded (a workout finished or edited, a bodyweight change) or the
  // unit or account changed. Then it refreshes behind the list already
  // showing.
  useFocusEffect(
    useCallback(() => {
      markScreen('history', 'open');
      if (shown.current) markScreen('history', 'content');
      const b = builtFrom.current;
      const fresh = b != null && b.key === `${userId}|${weightUnit}` && b.scanGeneration === scanCache.generation;
      if (!fresh) void reload();
    }, [reload, userId, weightUnit]),
  );

  async function refresh() {
    setRefreshing(true);
    await reload({ force: true });
    setRefreshing(false);
  }

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

  /**
   * A tap on a calendar day. When the day is older than the oldest row
   * loaded, pages are read until it is in, then the effect below scrolls.
   * The list is newest first, so once the oldest loaded day is before the
   * one asked for, more pages cannot hold it.
   */
  const jumpTo = useCallback(
    async (iso: string) => {
      const ctx = ctxRef.current;
      if (!userId || !ctx || !workouts) return;
      const has = (list: HistoryWorkout[]) => list.some((w) => w.workoutDate === iso);
      const pastIt = (list: HistoryWorkout[]) => list.length > 0 && list[list.length - 1].workoutDate < iso;
      if (!has(workouts) && hasMore && !pastIt(workouts)) {
        if (inFlight.current) return;
        const gen = generation.current;
        inFlight.current = true;
        setLoadingMore(true);
        try {
          let list = workouts;
          let more: boolean = hasMore;
          while (more && !has(list) && !pastIt(list)) {
            const page = await getWorkoutHistory(userId, list.length, ctx);
            if (gen !== generation.current) return;
            const seen = new Set(list.map((w) => w.id));
            const fresh = page.workouts.filter((w) => !seen.has(w.id));
            list = [...list, ...fresh];
            more = page.hasMore && fresh.length > 0;
          }
          setWorkouts(list);
          setHasMore(more);
        } finally {
          if (gen === generation.current) {
            inFlight.current = false;
            setLoadingMore(false);
          }
        }
      }
      jumpRetries.current = 0;
      setJump((j) => ({ iso, n: (j?.n ?? 0) + 1 }));
    },
    [userId, workouts, hasMore],
  );

  const sections = useMemo(() => groupByMonth(workouts ?? []), [workouts]);
  // Read through refs so the scroll runs once per jump, not again each
  // time a later page changes the sections.
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const jumpRef = useRef(jump);
  jumpRef.current = jump;

  const scrollToJump = useCallback(() => {
    const jump = jumpRef.current;
    const sections = sectionsRef.current;
    if (!jump) return;
    const sectionIndex = sections.findIndex((s) => s.key === jump.iso.slice(0, 7));
    const row = sectionIndex < 0 ? -1 : sections[sectionIndex].data.findIndex((w) => w.workoutDate === jump.iso);
    if (row < 0) return;
    // Within a section, index 0 is the month header and row k is k + 1.
    // The month's first row scrolls to its header, so the month shows too.
    listRef.current?.scrollToLocation({
      sectionIndex,
      itemIndex: row === 0 ? 0 : row + 1,
      viewPosition: 0,
      viewOffset: row === 0 ? 0 : spacing.sm,
      animated: true,
    });
  }, []);

  useEffect(() => {
    scrollToJump();
  }, [jump, scrollToJump]);

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScreenHeader title="History" trailing={<HeaderWorkoutButton />} />
      <Reveal ready={workouts !== null} skeleton={<HistorySkeleton />} style={styles.fill}>
        {() =>
          workouts?.length === 0 ? (
            <View style={styles.center}>
              {/* The same clay dumbbells as Profile's empty state. */}
              <Image
                source={ROUTINE_ART.dumbbells}
                style={styles.emptyArt}
                contentFit="contain"
                cachePolicy="memory-disk"
                accessibilityIgnoresInvertColors
              />
              <Text style={[type.exerciseName, { color: c.text }]}>No workouts yet</Text>
              <Text style={[type.meta, { color: c.text2 }, styles.centerText]}>
                Finish your first workout and it will show up here.
              </Text>
            </View>
          ) : (
            <SectionList
              ref={listRef}
              sections={sections}
              ListHeaderComponent={<MonthCalendar dates={dates} onSelectDay={(iso) => void jumpTo(iso)} />}
              // A row the list has not drawn yet has no position. Scroll to
              // where it should be, so the rows around it draw, and try
              // again.
              onScrollToIndexFailed={(info) => {
                listRef.current
                  ?.getScrollResponder()
                  ?.scrollTo({ y: info.averageItemLength * info.index, animated: false });
                if (jumpRetries.current >= JUMP_RETRIES) return;
                jumpRetries.current += 1;
                setTimeout(scrollToJump, 50);
              }}
              keyExtractor={(w) => w.id}
              renderItem={({ item }) => <WorkoutRow workout={item} unit={unit} />}
              renderSectionHeader={({ section }) => <MonthHeader title={section.title} />}
              ItemSeparatorComponent={Separator}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
              onEndReached={() => void loadMore()}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                loadingMore ? <ActivityIndicator style={styles.footer} /> : <View style={styles.footer} />
              }
              // What lets the native large title collapse on scroll, as on Home.
              {...scrollInsetProps}
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
          )
        }
      </Reveal>
    </View>
  );
}

const SKELETON_NAMES = ['55%', '40%', '62%', '48%', '58%', '44%'] as const;

/**
 * The first page's shape: a month header and a column of rows. In a
 * scroll view with the same inset as the list, so it sits under the large
 * title exactly where the rows will land.
 */
function HistorySkeleton() {
  return (
    <ScrollView
      scrollEnabled={false}
      {...scrollInsetProps}
      contentContainerStyle={styles.list}>
      <View style={styles.skeletonHeader}>
        <SkeletonText variant={type.label} width={72} />
      </View>
      <View style={styles.skeletonRows}>
        {SKELETON_NAMES.map((w, i) => (
          <WorkoutRowSkeleton key={i} nameWidth={w} />
        ))}
      </View>
    </ScrollView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { paddingHorizontal: spacing.screen, paddingBottom: SCROLL_END_PADDING },
  separator: { height: spacing.sm },
  footer: { paddingVertical: spacing.lg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.screen,
  },
  // Profile's size, so the two empty states match.
  emptyArt: { width: 112, height: 112 },
  centerText: { textAlign: 'center' },
  // MonthHeader's padding, so the skeleton rows start where the real ones do.
  skeletonHeader: { paddingTop: spacing.lg, paddingBottom: spacing.sm },
  skeletonRows: { gap: spacing.sm },
});
