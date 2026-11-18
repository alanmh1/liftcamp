import { isoFromLocalDate, localDateFromIso, prTimeline, rangeFor, rangeLabel, type ProgressIndex } from '@liftcamp/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { TimelineRow } from '@/components/progress/profile-sections';
import { useNavHref } from '@/components/tab-layout';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { getProgressIndex, peekProgressIndex } from '@/data/progress';
import { useRangeChoice } from '@/lib/progress-range';
import { SCROLL_END_PADDING } from '@/lib/scroll-insets';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/**
 * Every PR and milestone in Profile's selected range, newest first, the
 * same rows as the timeline on Profile. A FlatList, so a long history
 * renders as it scrolls.
 */
export default function PrsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { scheme, colors: c } = useTheme();
  const { unit, loading: unitLoading } = useWeightUnit();
  const router = useRouter();
  const navHref = useNavHref();
  const [choice] = useRangeChoice('profile');
  const [index, setIndex] = useState<ProgressIndex | null | undefined>(() =>
    userId && !unitLoading ? peekProgressIndex(userId, unit) : undefined,
  );

  useFocusEffect(
    useCallback(() => {
      if (!userId || unitLoading) return;
      let cancelled = false;
      void getProgressIndex(userId, unit).then((i) => {
        if (!cancelled) setIndex(i);
      });
      return () => {
        cancelled = true;
      };
    }, [userId, unit, unitLoading]),
  );

  const todayIso = isoFromLocalDate(new Date());
  const { entries, label } = useMemo(() => {
    if (!index) return { entries: [], label: '' };
    const today = localDateFromIso(todayIso) ?? new Date();
    const range = rangeFor(choice, today, index.firstWorkoutDate);
    return { entries: prTimeline(index, range), label: rangeLabel(range, today) };
  }, [index, choice, todayIso]);

  if (index === undefined) {
    return (
      <View style={[styles.fill, { backgroundColor: c.bg }]}>
        <ActivityIndicator style={styles.loading} color={c.text3} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.content}
      data={entries}
      keyExtractor={(e) => e.setId}
      initialNumToRender={15}
      windowSize={7}
      ListHeaderComponent={
        <Text style={[type.meta, styles.label, { color: c.text2 }]}>
          {label}
          {entries.length > 0 ? ` · ${entries.length} ${entries.length === 1 ? 'PR' : 'PRs'}` : ''}
        </Text>
      }
      ListEmptyComponent={
        <Text style={[type.meta, { color: c.text2 }]}>No PRs in this range yet.</Text>
      }
      renderItem={({ item, index: i }) => (
        <View
          style={[
            styles.item,
            { backgroundColor: c.surface },
            scheme === 'dark' && { borderLeftWidth: 1, borderRightWidth: 1, borderColor: c.border },
            i === 0 && styles.first,
            i === 0 && scheme === 'dark' && { borderTopWidth: 1 },
            i === entries.length - 1 && scheme === 'dark' && { borderBottomWidth: 1 },
            i === entries.length - 1 && styles.last,
          ]}>
          <TimelineRow
            entry={item}
            last={i === entries.length - 1}
            onPress={() => router.push(navHref({ kind: 'exercise', id: item.exerciseId }))}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  loading: { marginTop: spacing.xl },
  content: { padding: spacing.screen, paddingBottom: SCROLL_END_PADDING },
  label: { paddingHorizontal: spacing.xs, paddingBottom: spacing.md },
  // One card made of rows: each row is a slice of it, so the connector
  // line runs unbroken from row to row.
  item: { paddingHorizontal: spacing.card },
  first: { borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, paddingTop: spacing.card },
  last: { borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
});
