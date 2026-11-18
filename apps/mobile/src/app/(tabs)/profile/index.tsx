import {
  compactNumber,
  gapTip,
  isoFromLocalDate,
  localDateFromIso,
  musclesWorked,
  musclesWorkedLabel,
  nextInRotation,
  PR_TIMELINE_PREVIEW,
  PROFILE_PRESETS,
  prTimeline,
  rangeFor,
  rotationRoutines,
  shouldOfferSave,
  sinceStarted,
  splitFollows,
  weekStreak,
  type MedalEarn,
  type ProgressIndex,
} from '@liftcamp/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Image } from 'expo-image';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { Avatar } from '@/components/avatar';
import { ROUTINE_ART } from '@/components/home/routine-art';
import { ProgressChart, type ChartPoint } from '@/components/exercises/progress-chart';
import { MedalShelf } from '@/components/medals/medal-shelf';
import {
  MusclesWorkedCard,
  PrTimelineCard,
  SinceStartedCard,
  StrengthLevelsCard,
  TrendsLockedCard,
  TrendsRow,
} from '@/components/progress/profile-sections';
import { RangeControl } from '@/components/progress/range-control';
import { ScreenHeader } from '@/components/screen-header';
import { useStartGate } from '@/components/start-gate';
import { ListGroup, ListRow, settingsStyles } from '@/components/settings-ui';
import { SkeletonText } from '@/components/skeleton';
import { useNavHref } from '@/components/tab-layout';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import {
  ensureUsername,
  getBodyProfile,
  getStreakWorkoutDates,
  getUserTemplates,
  getWeeklyTarget,
  peekUpNextSkips,
  startFromTemplate,
  type BodyProfile,
} from '@/data/home';
import { buildCabinet, getStoredMedals } from '@/data/medals';
import { useFollowRows, useRefreshFollowsOnFocus } from '@/lib/follows';
import {
  getProfileBasics,
  getProfileStats,
  peekProfileStats,
  type ProfileBasics,
  type ProfileStats,
} from '@/data/profile';
import { getProgressIndex, peekProgressIndex } from '@/data/progress';
import { usePro, useProUpsell } from '@/lib/pro';
import { useRangeChoice } from '@/lib/progress-range';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
import { useSocialOn } from '@/lib/social-access';
import { useColors, useTheme } from '@/theme/theme-provider';
import { cardSurface, flattenAlpha, radius, spacing, type } from '@/theme/tokens';

type Meta = Record<string, unknown> | undefined;

/** The name Google or Apple gave, from the same fields the avatar's initials use. */
function displayName(meta: Meta): string | null {
  for (const v of [meta?.full_name, meta?.name]) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** "September 2026". */
function monthYear(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** "Week of September 8", the chart's readout date. */
function weekOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'long' });
  return `Week of ${d}`;
}

/**
 * Profile: who you are and how training is going. A header with the
 * photo, name and when training started; three stats; workouts per week
 * against the target. Under it, Your progress (docs/profile-progress-spec.md):
 * a range control, muscles worked and the PR timeline for that range, and
 * strength levels and Since you started, which ignore it. Then Trends for
 * Pro, or its locked card where Pro is on sale. All of it derives from the
 * scan through the progress index (data/progress.ts, progress.ts in shared).
 * Everything you set, including the weekly target, experience and
 * equipment, is in Settings behind the gear beside the title. A History
 * row under the medals pushes History on this stack, and the exercise rows
 * open on this stack too (useNavHref). With the social flag, Followers
 * and Following counts sit above it and push their lists.
 *
 * The basics read on every focus. The stats come from the account-wide PR
 * scan, which the session cache in data/scan-cache.ts holds until a set
 * or workout changes, so switching tabs does not rerun it, and a scan any
 * other screen already ran is reused. Pull to refresh forces a rescan.
 */
export default function ProfileScreen() {
  const { guardStart } = useStartGate();
  const { session } = useAuth();
  const { scheme, colors: c } = useTheme();
  const { unit, label: unitLabel, loading: unitLoading } = useWeightUnit();
  const router = useRouter();
  const navHref = useNavHref();
  const user = session?.user;
  const userId = user?.id;
  const anonymous = !!user?.is_anonymous;
  // Social only, as this run latched it. The rows are read by the tabs
  // layout (lib/follows.ts); null until they are in.
  const socialOn = useSocialOn() === true;
  const followRows = useFollowRows(socialOn ? userId : null);
  // An approval on the other person's phone shows on the next focus.
  useRefreshFollowsOnFocus(socialOn ? (userId ?? null) : null);
  const follows = followRows && userId ? splitFollows(followRows, userId, Date.now()) : null;

  const [username, setUsername] = useState<string | null>(null);
  const [basics, setBasics] = useState<ProfileBasics | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [body, setBody] = useState<BodyProfile | null>(null);
  // Every finished date, for the week streak and the medals. Null until read.
  const [streakDates, setStreakDates] = useState<string[] | null>(null);
  // The medals stored on the server. Null until read, or when the read failed.
  const [storedMedals, setStoredMedals] = useState<MedalEarn[] | null>(null);
  // From the scan cache when another screen already ran the scan, so the
  // volume shows on the first frame. Undefined until the first read.
  const [stats, setStats] = useState<ProfileStats | null | undefined>(() =>
    userId && !unitLoading ? peekProfileStats(userId, unit) : undefined,
  );
  // The progress sections' index (data/progress.ts), from the same scan.
  const [index, setIndex] = useState<ProgressIndex | null | undefined>(() =>
    userId && !unitLoading ? peekProgressIndex(userId, unit) : undefined,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [rangeChoice, setRangeChoice] = useRangeChoice('profile');
  const isPro = usePro();
  const upsell = useProUpsell();

  const load = useCallback(
    async (force: boolean) => {
      // Volume and PR weights are converted to the unit, so wait for it.
      if (!userId || unitLoading) return;
      // Minted here if the account has none yet, as Settings does, so a
      // new guest's avatar has an initial.
      const [name, b, t, bp, sd, medals] = await Promise.all([
        ensureUsername(user!),
        getProfileBasics(userId),
        getWeeklyTarget(userId),
        getBodyProfile(userId),
        getStreakWorkoutDates(userId),
        getStoredMedals(userId),
      ]);
      setUsername(name);
      setBasics(b);
      setTarget(t);
      setBody(bp);
      setStreakDates(sd);
      if (medals) setStoredMedals(medals);
      setStats(await getProfileStats(userId, bp.bodyweight, unit, { force }));
      // The scan is cached by now, so this only builds (or reuses) the index.
      setIndex(await getProgressIndex(userId, unit));
    },
    [userId, unit, unitLoading],
  );

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }

  const openExercise = (id: string) => router.push(navHref({ kind: 'exercise', id }));

  /**
   * The empty state's button: the routine Home offers as Next up, or the
   * routines list when the rotation is empty. The
   * start goes through the start gate, like every other.
   */
  const [starting, setStarting] = useState(false);
  async function startFirstWorkout() {
    if (!userId || starting) return;
    setStarting(true);
    const mine = await getUserTemplates(userId);
    const next = nextInRotation(rotationRoutines(mine), peekUpNextSkips(userId));
    if (!next) {
      setStarting(false);
      router.push(navHref({ kind: 'routines' }));
      return;
    }
    await guardStart(async () => {
      setStarting(true);
      const id = await startFromTemplate(userId, next, unit);
      setStarting(false);
      if (id) router.push({ pathname: '/workout/[id]', params: { id } });
      else Alert.alert('Could not start that workout.', 'Try again.');
    }, next.id);
    setStarting(false);
  }
  const openSettings = () => router.push('/settings');

  const name = anonymous ? 'Guest' : displayName(user?.user_metadata);
  // The month of the first finished workout, and nothing before there is
  // one: an account's creation date is not when anyone started training.
  const trainingSince = basics && basics.finishedCount > 0 ? localDateFromIso(basics.firstWorkoutDate) : null;
  const thisWeek = basics?.weeks[basics.weeks.length - 1]?.days ?? 0;
  const streak = streakDates && target != null ? weekStreak(streakDates, target) : null;
  const cabinet = streakDates && target != null ? buildCabinet(storedMedals, streakDates, target) : null;
  const empty = basics != null && basics.finishedCount === 0;
  // Only the first load shows skeletons; the tab keeps its state after that.
  const basicsLoading = basics == null;

  // Per range, memoised on the index (one per scan generation) and the
  // range, so a range switch never rescans.
  const todayIso = isoFromLocalDate(new Date());
  const progress = useMemo(() => {
    if (!index) return null;
    const today = localDateFromIso(todayIso) ?? new Date();
    const range = rangeFor(rangeChoice, today, index.firstWorkoutDate);
    const muscles = musclesWorked(index, range);
    const prs = prTimeline(index, range);
    return {
      muscles,
      muscleLabel: musclesWorkedLabel(muscles),
      tip: gapTip(index, range, today),
      prs,
    };
  }, [index, rangeChoice, todayIso]);
  const sinceLifts = useMemo(() => (index ? sinceStarted(index) : []), [index]);

  const points: ChartPoint[] = (basics?.weeks ?? []).map((w) => ({
    date: w.weekStart,
    value: w.days,
    workoutId: w.weekStart,
  }));

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScreenHeader
        title="Profile"
        trailing={
          <Pressable
            onPress={openSettings}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            style={({ pressed }) => [styles.gear, pressed && settingsStyles.pressed]}>
            {/* A 36 pt filled circle inside the 44 pt tap target. */}
            <View style={[styles.gearCircle, { backgroundColor: c.surface2 }]}>
              <SymbolView
                name={{ ios: 'gearshape', android: 'settings' }}
                size={20}
                tintColor={c.text2}
                fallback={<Text style={[styles.gearFallback, { color: c.text2 }]}>⚙</Text>}
              />
            </View>
          </Pressable>
        }
      />
      {/* ScreenHeader takes the top inset; the scroll view takes the tab
          bar's inset at the bottom. */}
      <ScrollView
        {...scrollInsetProps}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View style={styles.header}>
          <Avatar meta={user?.user_metadata} username={username} size={64} guest={anonymous} />
          <View style={styles.identity}>
            {name == null && basicsLoading ? (
              <SkeletonText variant={type.screenTitle} width="70%" />
            ) : (
              <Text style={[type.screenTitle, { color: c.text }]} numberOfLines={1}>
                {name ?? (username ? `@${username}` : '')}
              </Text>
            )}
            {!anonymous && name && username ? (
              <Text style={[type.meta, styles.subline, { color: c.text2 }]} numberOfLines={1}>
                @{username}
              </Text>
            ) : null}
            {trainingSince ? (
              <Text style={[type.meta, styles.subline, { color: c.text2 }]}>Training since {monthYear(trainingSince)}</Text>
            ) : basicsLoading ? (
              <SkeletonText variant={styles.subline} width="60%" />
            ) : null}
          </View>
        </View>

        {/* Same rule as Home: a guest is asked to save once there is a
            finished workout to save. Settings offers it at all times. */}
        {basics && shouldOfferSave({ isAnonymous: anonymous, finishedCount: basics.finishedCount }) ? (
          <Pressable
            onPress={() => router.push('/link-account')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.outline, { borderColor: c.accent }, pressed && settingsStyles.pressed]}>
            <Text style={[type.button, { color: c.accentText }]}>Create free account</Text>
          </Pressable>
        ) : null}

        <View style={[styles.stats, cardSurface(scheme, c)]}>
          <Stat label="Workouts" value={basics ? String(basics.finishedCount) : null} />
          <Stat label="This week" value={basics && target != null ? `${thisWeek} of ${target}` : null} />
          <Stat
            label="Total volume"
            value={
              stats
                ? `${compactNumber(stats.totalVolume)} ${unitLabel}`
                : empty
                  ? `0 ${unitLabel}`
                  : stats === undefined
                    ? null
                    : ''
            }
          />
        </View>

        {/* The week streak, the same rule as Home's card (weekStreak in
            shared): current and longest, in weeks. Digits, it is a stat. */}
        {!empty ? (
          <View style={[styles.stats, cardSurface(scheme, c)]}>
            <Stat label="Week streak" value={streak ? weeksLabel(streak.current) : null} />
            <Stat label="Longest streak" value={streak ? weeksLabel(streak.longest) : null} />
          </View>
        ) : null}

        {/* Medals for streak lengths (medals.ts in shared): the ones earned,
            then the next. Opens the cabinet. */}
        {!empty && cabinet ? <MedalShelf cabinet={cabinet} onPress={() => router.push('/medals')} /> : null}

        {socialOn ? (
          <ListGroup>
            <ListRow
              label="Followers"
              value={
                follows
                  ? follows.requests.length > 0
                    ? `${follows.followers.length} · ${requestsLabel(follows.requests.length)}`
                    : String(follows.followers.length)
                  : ''
              }
              loading={!follows}
              onPress={() => router.push(navHref({ kind: 'followers' }))}
            />
            <ListRow
              label="Following"
              value={follows ? String(follows.following.length) : ''}
              loading={!follows}
              onPress={() => router.push(navHref({ kind: 'following' }))}
            />
          </ListGroup>
        ) : null}

        {/* History is pushed from here, on this stack. */}
        {!empty ? (
          <ListGroup>
            <ListRow
              label="History"
              value={basics ? workoutsLabel(basics.finishedCount) : ''}
              onPress={() => router.push(navHref({ kind: 'history' }))}
            />
          </ListGroup>
        ) : null}

        {empty ? (
          <>
            <View style={styles.empty}>
              <Image
                source={ROUTINE_ART.dumbbells}
                style={styles.emptyArt}
                contentFit="contain"
                cachePolicy="memory-disk"
                accessibilityIgnoresInvertColors
              />
              <Text style={[type.meta, styles.emptyLine, { color: c.text2 }]}>
                Log your first workout. Your progress will show up here.
              </Text>
              <Pressable
                onPress={() => void startFirstWorkout()}
                disabled={starting}
                accessibilityRole="button"
                style={({ pressed }) => [styles.primary, { backgroundColor: c.accent }, (pressed || starting) && settingsStyles.pressed]}>
                <Text style={[type.button, styles.primaryLabel]}>
                  {starting ? 'Starting…' : 'Start your first workout'}
                </Text>
              </Pressable>
              {/* The History row is hidden until a workout is finished, so
                  the import is offered here as well as in empty History. */}
              <Pressable
                onPress={() => router.push({ pathname: '/import', params: { entry: 'profile' } })}
                accessibilityRole="button"
                hitSlop={8}
                style={({ pressed }) => [styles.importButton, pressed && settingsStyles.pressed]}>
                <Text style={[type.button, { color: c.accentText }]}>Import from another app</Text>
              </Pressable>
            </View>
            <EmptyPreview target={target ?? 3} weekStarts={points.map((p) => p.date)} unitLabel={unitLabel} unit={unit} />
          </>
        ) : null}

        {basics && !empty && target != null ? (
          <View style={[styles.card, cardSurface(scheme, c)]}>
            <Text style={[type.label, { color: c.text3 }]}>Workouts per week</Text>
            <ProgressChart
              points={points}
              kind="bar"
              format={(v) => `${v} of ${target}`}
              axisFormat={String}
              dateLabel={weekOf}
              reference={target}
            />
          </View>
        ) : null}

        {!empty && index && progress ? (
          <>
            <View style={styles.progressHead}>
              <Text style={[styles.sectionTitle, { color: c.text }]} accessibilityRole="header">
                Your progress
              </Text>
              <RangeControl
                presets={PROFILE_PRESETS}
                choice={rangeChoice}
                onChange={setRangeChoice}
                firstWorkoutDate={index.firstWorkoutDate}
              />
              <Text style={[type.meta, styles.progressNote, { color: c.text2 }]}>
                Applies to muscles worked and the PR timeline
              </Text>
            </View>

            <MusclesWorkedCard
              muscles={progress.muscles}
              tip={progress.tip}
              label={progress.muscleLabel}
              onOpenExercise={openExercise}
            />

            {stats && stats.liftMaxes.length > 0 && body ? (
              <StrengthLevelsCard lifts={stats.liftMaxes} body={body} onOpen={openExercise} onSettings={openSettings} />
            ) : null}

            {sinceLifts.length > 0 && index.firstWorkoutDate ? (
              <SinceStartedCard lifts={sinceLifts} firstWorkoutDate={index.firstWorkoutDate} onOpen={openExercise} />
            ) : null}

            <PrTimelineCard
              entries={progress.prs.slice(0, PR_TIMELINE_PREVIEW)}
              total={progress.prs.length}
              onOpen={openExercise}
              onSeeAll={() => router.push('/profile/prs')}
            />

            {isPro ? (
              <TrendsRow onPress={() => router.push('/profile/trends')} />
            ) : upsell.available ? (
              <TrendsLockedCard onUnlock={() => upsell.open('trends')} />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * A faded, non-interactive preview of what the tab fills in with: the
 * weekly chart with sample weeks, and two sample PR rows. Hidden from
 * VoiceOver, which reads the empty state's line instead.
 */
function EmptyPreview({
  target,
  weekStarts,
  unitLabel,
  unit,
}: {
  target: number;
  weekStarts: string[];
  unitLabel: string;
  unit: 'lb' | 'kg';
}) {
  const { scheme, colors: c } = useTheme();
  const sample = [1, 2, 2, 3, 2, 3, 3, 2];
  const points: ChartPoint[] = weekStarts.map((date, i) => ({
    date,
    value: Math.min(sample[i % sample.length], target),
    workoutId: date,
  }));
  const rows = [
    { name: 'Barbell Squat', set: `${unit === 'kg' ? 60 : 135} ${unitLabel} × 5` },
    { name: 'Barbell Bench Press', set: `${unit === 'kg' ? 40 : 95} ${unitLabel} × 8` },
  ];
  return (
    <View
      style={styles.preview}
      {...flattenAlpha}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {points.length > 0 ? (
        <View style={[styles.card, cardSurface(scheme, c)]}>
          <Text style={[type.label, { color: c.text3 }]}>Workouts per week</Text>
          <ProgressChart
            points={points}
            kind="bar"
            format={(v) => `${v} of ${target}`}
            axisFormat={String}
            dateLabel={weekOf}
            reference={target}
          />
        </View>
      ) : null}
      <ListGroup title="Recent PRs">
        {rows.map((r) => (
          <View key={r.name} style={styles.prRow}>
            <View style={styles.prText}>
              <Text style={[styles.rowText, { color: c.text }]} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={[type.restTime, { color: c.text2 }]}>{r.set}</Text>
            </View>
          </View>
        ))}
      </ListGroup>
    </View>
  );
}

/** "1 workout", "12 workouts". */
function workoutsLabel(n: number): string {
  return `${n} ${n === 1 ? 'workout' : 'workouts'}`;
}

/** "1 request", "3 requests". */
function requestsLabel(n: number): string {
  return `${n} ${n === 1 ? 'request' : 'requests'}`;
}

/** "1 week", "5 weeks". */
function weeksLabel(n: number): string {
  return `${n} ${n === 1 ? 'week' : 'weeks'}`;
}

/** A null value has not loaded yet and shows a skeleton line. */
function Stat({ label, value }: { label: string; value: string | null }) {
  const c = useColors();
  return (
    <View style={styles.stat}>
      {value == null ? (
        <SkeletonText variant={styles.statValue} width="70%" />
      ) : (
        <Text style={[styles.statValue, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      )}
      <Text style={[type.label, { color: c.text3 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.xl, paddingBottom: SCROLL_END_PADDING },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identity: { flex: 1, gap: 2 },
  subline: { fontSize: 15 },
  // 44 pt square, the minimum iOS hit target. Pulled right by the 4 pt
  // between it and the 36 pt circle, so the circle's edge sits on the
  // screen gutter.
  gear: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -4,
  },
  gearCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearFallback: { fontSize: 20 },
  outline: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: radius.bar,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  stats: { flexDirection: 'row', borderRadius: radius.card, paddingVertical: spacing.card },
  stat: { flex: 1, alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xs },
  statValue: { fontSize: 22, fontWeight: '600', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  empty: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm },
  emptyArt: { width: 112, height: 112 },
  emptyLine: { fontSize: 15, textAlign: 'center', maxWidth: 280 },
  primary: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    marginTop: spacing.xs,
  },
  primaryLabel: { color: '#FFFFFF', fontSize: 17 },
  // The small gap under Start your first workout, on top of the column's own.
  importButton: { marginTop: spacing.xs, paddingVertical: spacing.sm },
  // What the tab will hold, faded and inert.
  preview: { opacity: 0.35, gap: spacing.xl },
  card: { borderRadius: radius.card, padding: spacing.card, gap: spacing.md },
  prRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.card,
    paddingVertical: spacing.sm,
  },
  prText: { flex: 1, gap: 2 },
  rowText: { fontSize: 16 },
  progressHead: { gap: spacing.sm, marginTop: spacing.sm },
  sectionTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, paddingHorizontal: spacing.xs },
  progressNote: { paddingHorizontal: spacing.xs },
});
