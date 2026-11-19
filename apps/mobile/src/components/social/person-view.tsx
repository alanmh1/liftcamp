import {
  PROFILE_PAGE,
  appendFeedPage,
  feedCursor,
  socialHandle,
  weekCardState,
  type FeedItem,
  type FollowRow,
} from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import type { SheetRef } from '@/components/BottomSheet';
import { settingsStyles } from '@/components/settings-ui';
import { CopyWorkoutSheet, type CopyWorkoutSheetRef } from '@/components/social/copy-workout-sheet';
import { FeedCard } from '@/components/social/feed-card';
import { PersonMenuSheet, useFollowActions } from '@/components/social/follow-actions';
import { ReportSheet, type ReportSheetRef } from '@/components/social/report-sheet';
import { InitialsAvatar, RowButton } from '@/components/social/person-row';
import { useNavHref } from '@/components/tab-layout';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { DEFAULT_WEEKLY_TARGET, getStreakWorkoutDates, getWeeklyTarget } from '@/data/home';
import { socialFeed, socialProfile, socialStreak, type SocialProfile, type SocialStreak } from '@/data/social';
import { useFollowRows } from '@/lib/follows';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, tabular, type } from '@/theme/tokens';

type Load<T> = T | undefined | null; // undefined loading, null failed or none

/**
 * Another person's profile, pushed on Home (from the feed and the inbox)
 * and on Profile (from Followers and Following). docs/social-spec.md,
 * Profile and streak comparison.
 *
 * - Who they are and where the two stand, with Follow back when it applies
 *   and the ⋯ menu (Unfollow or Remove follower, and Block).
 * - With an accepted follow: their week streak beside the user's, from the
 *   same weekCardState as Home's week card (theirs from social_streak:
 *   dates and weekly target only), then their workouts, any age, ten at a
 *   time, as feed cards.
 * - Someone the user is not connected to, or blocked either way, gets a
 *   short line and nothing else (social_profile answers no row).
 *
 * Every read here fails quiet: a failed read shows its own empty state.
 */
export function PersonView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const me = session?.user.id ?? null;
  const router = useRouter();
  const navHref = useNavHref();
  const { scheme, colors: c } = useTheme();
  const { label: unitLabel, unit: viewerUnit } = useWeightUnit();
  const rows = useFollowRows(me);
  const actions = useFollowActions();
  const menuRef = useRef<SheetRef>(null);
  const copyRef = useRef<CopyWorkoutSheetRef>(null);
  const reportRef = useRef<ReportSheetRef>(null);

  const [profile, setProfile] = useState<Load<SocialProfile>>(undefined);
  const [theirs, setTheirs] = useState<Load<SocialStreak>>(undefined);
  const [mine, setMine] = useState<Load<{ dates: string[]; target: number }>>(undefined);
  const [workouts, setWorkouts] = useState<Load<FeedItem[]>>(undefined);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Read on each focus, so a follow approved elsewhere or kudos given on a
  // workout opened from here shows on the way back.
  const load = useCallback(
    async (isCancelled: () => boolean) => {
      if (!id || !me) return;
      try {
        const result = await socialProfile(id);
        if (isCancelled()) return;
        const row = result.ok ? (result.data?.[0] ?? null) : null;
        setProfile(row);
        if (!row?.can_view) return;
        const [streak, page, myDates, myTarget] = await Promise.all([
          socialStreak(id),
          socialFeed({ cursor: null, limit: PROFILE_PAGE, user: id }),
          getStreakWorkoutDates(me).catch(() => null),
          getWeeklyTarget(me).catch(() => DEFAULT_WEEKLY_TARGET),
        ]);
        if (isCancelled()) return;
        setTheirs(streak.ok ? (streak.data?.[0] ?? null) : null);
        setMine(myDates ? { dates: myDates, target: myTarget } : null);
        if (page.ok) {
          setWorkouts(page.data ?? []);
          setMore((page.data ?? []).length >= PROFILE_PAGE);
        } else {
          setWorkouts((held) => held ?? null);
        }
      } catch {
        if (!isCancelled()) setProfile((held) => held ?? null);
      }
    },
    [id, me],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void load(() => cancelled);
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  // Gone from the follow rows (blocked, unfollowed, removed): read again so
  // the screen drops what it may no longer show.
  const connected = !!rows?.some((r) => r.other_id === id);
  useEffect(() => {
    if (rows && !connected && profile) {
      let cancelled = false;
      void load(() => cancelled);
      return () => {
        cancelled = true;
      };
    }
  }, [rows, connected, profile, load]);

  async function showMore() {
    if (!id || !workouts || loadingMore) return;
    const cursor = feedCursor(workouts);
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await socialFeed({ cursor, limit: PROFILE_PAGE, user: id });
      if (page.ok) {
        setWorkouts((held) => appendFeedPage(held ?? [], page.data ?? []));
        setMore((page.data ?? []).length >= PROFILE_PAGE);
      }
    } catch {
      // Show more stays; the next tap tries again.
    } finally {
      setLoadingMore(false);
    }
  }

  const myRow: FollowRow | undefined = rows?.find((r) => r.follower_id === me && r.followee_id === id);
  const theirRow: FollowRow | undefined = rows?.find((r) => r.follower_id === id && r.followee_id === me);
  const username = profile?.username ?? myRow?.other_username ?? theirRow?.other_username ?? null;
  const now = Date.now();

  const relation =
    profile?.i_follow === 'accepted' && profile.follows_me === 'accepted'
      ? 'You follow each other'
      : profile?.i_follow === 'accepted'
        ? 'You follow them'
        : profile?.follows_me === 'accepted'
          ? 'Follows you'
          : profile?.i_follow === 'pending'
            ? 'Requested'
            : null;
  const canFollowBack =
    profile != null && profile.i_follow == null && profile.follows_me === 'accepted' && !!me && !!id;

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ title: profile ? socialHandle(username) : '' }} />
      <ScrollView {...scrollInsetProps} contentContainerStyle={styles.content}>
        {profile === undefined ? (
          <ActivityIndicator style={styles.loading} />
        ) : profile === null ? (
          <Text style={[type.meta, styles.line, { color: c.text2 }]}>
            This profile is not available. You see people here once one of you follows the other.
          </Text>
        ) : (
          <>
            <View style={styles.head}>
              <InitialsAvatar username={username} size={64} />
              <View style={styles.headText}>
                <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
                  {socialHandle(username)}
                </Text>
                {relation ? <Text style={[type.meta, { color: c.text2 }]}>{relation}</Text> : null}
              </View>
              {canFollowBack ? (
                <RowButton label="Follow back" primary onPress={() => void actions.followBack(id!).then(() => load(() => false))} />
              ) : null}
              {myRow || theirRow ? (
                <Pressable
                  onPress={() => menuRef.current?.present()}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`More for ${socialHandle(username)}`}
                  style={({ pressed }) => [styles.menu, pressed && settingsStyles.pressed]}>
                  <SymbolView
                    name={{ ios: 'ellipsis', android: 'more_horiz' }}
                    size={20}
                    tintColor={c.text2}
                    fallback={<Text style={{ color: c.text2, fontSize: 20 }}>⋯</Text>}
                  />
                </Pressable>
              ) : null}
            </View>

            {profile.can_view ? (
              <>
                <View style={styles.streaks}>
                  <StreakColumn title="You" data={mine} />
                  <StreakColumn
                    title={socialHandle(username)}
                    data={theirs === undefined ? undefined : theirs ? { dates: theirs.dates, target: theirs.weekly_target } : null}
                  />
                </View>

                <Text style={[type.label, styles.heading, { color: c.text3 }]}>Workouts</Text>
                {workouts === undefined ? (
                  <ActivityIndicator />
                ) : workouts === null ? (
                  <Text style={[type.meta, styles.line, { color: c.text2 }]}>Could not load their workouts. Check your connection and open this again.</Text>
                ) : workouts.length === 0 ? (
                  <Text style={[type.meta, styles.line, { color: c.text2 }]}>No finished workouts yet.</Text>
                ) : (
                  workouts.map((item) => (
                    <FeedCard
                      key={item.workout_id}
                      item={item}
                      viewerUnit={viewerUnit}
                      unitLabel={unitLabel}
                      now={now}
                      onOpen={() => router.push(navHref({ kind: 'friendWorkout', id: item.workout_id }))}
                      onCopy={() => copyRef.current?.open(item.workout_id)}
                      onReport={() =>
                        reportRef.current?.open({ userId: item.user_id, username: item.username, workoutId: item.workout_id })
                      }
                    />
                  ))
                )}
                {workouts && more ? (
                  <Pressable
                    onPress={() => void showMore()}
                    disabled={loadingMore}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.more, (pressed || loadingMore) && settingsStyles.pressed]}>
                    {loadingMore ? <ActivityIndicator /> : <Text style={[type.button, { color: c.accentText }]}>Show more</Text>}
                  </Pressable>
                ) : null}
              </>
            ) : (
              <View style={[styles.card, cardSurface(scheme, c)]}>
                <Text style={[type.meta, { color: c.text2, fontSize: 15 }]}>
                  {profile.i_follow === 'pending'
                    ? 'Once they approve your request, their streak and workouts show here.'
                    : 'Follow them to see their streak and workouts.'}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <CopyWorkoutSheet ref={copyRef} />
      <ReportSheet ref={reportRef} onBlocked={() => void load(() => false)} />
      <PersonMenuSheet
        ref={menuRef}
        username={username}
        kind={myRow ? 'following' : 'follower'}
        onAction={(action) => {
          menuRef.current?.dismiss();
          // Each confirms first; the follow rows change after, and the
          // effect above reads this screen again.
          if (action === 'unfollow' && myRow) actions.unfollow(myRow);
          else if (action === 'remove' && theirRow) actions.removeFollower(theirRow);
          else if (action === 'report' && id) reportRef.current?.open({ userId: id, username, workoutId: null });
          else if (action === 'block' && id) actions.block(id, username);
        }}
      />
    </View>
  );
}

/** One side of the comparison: the week streak, this week against the target, and the longest run. */
function StreakColumn({ title, data }: { title: string; data: Load<{ dates: string[]; target: number }> }) {
  const { scheme, colors: c } = useTheme();
  const state = data ? weekCardState({ dates: data.dates, target: data.target, finishedCount: data.dates.length }) : null;
  return (
    <View style={[styles.streak, cardSurface(scheme, c)]}>
      <Text style={[type.label, { color: c.text3 }]} numberOfLines={1}>
        {title}
      </Text>
      {data === undefined ? (
        <ActivityIndicator style={styles.streakLoading} />
      ) : !state ? (
        <Text style={[type.meta, { color: c.text2 }]}>Not available</Text>
      ) : (
        <>
          <Text style={[styles.streakNumber, { color: c.text }]}>{state.streak.current}</Text>
          <Text style={[type.meta, { color: c.text2 }]}>week streak</Text>
          <Text style={[type.meta, styles.streakMeta, { color: c.text2 }]}>
            {`This week ${state.done} of ${state.target}`}
          </Text>
          <Text style={[type.meta, { color: c.text2 }]}>{`Longest ${state.streak.longest}`}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.lg, paddingBottom: SCROLL_END_PADDING },
  loading: { marginTop: spacing.xl },
  line: { fontSize: 15 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headText: { flex: 1, gap: 2 },
  name: { fontSize: 20, fontWeight: '700' },
  menu: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  streaks: { flexDirection: 'row', gap: spacing.md },
  streak: { flex: 1, borderRadius: radius.card, padding: spacing.card, gap: 2 },
  streakLoading: { marginVertical: spacing.md },
  streakNumber: { fontSize: 34, fontWeight: '700', ...tabular },
  streakMeta: { marginTop: spacing.xs, ...tabular },
  heading: { marginTop: spacing.sm, paddingHorizontal: spacing.xs },
  card: { borderRadius: radius.card, padding: spacing.card },
  more: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
});
