import {
  ageFromBirthday,
  compactNumber,
  convertWeight,
  formatSetWeight,
  localDateFromIso,
  strengthLevel,
  strengthThresholds,
  tidyWeight,
} from '@liftcamp/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import { Avatar } from '@/components/avatar';
import { ProgressChart, type ChartPoint } from '@/components/exercises/progress-chart';
import { ListGroup, ListRow, settingsStyles } from '@/components/settings-ui';
import { SkeletonText } from '@/components/skeleton';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { ensureUsername, getBodyProfile, getWeeklyTarget, type BodyProfile } from '@/data/home';
import {
  getProfileBasics,
  getProfileStats,
  peekProfileStats,
  type LiftMax,
  type ProfileBasics,
  type ProfileStats,
  type RecentPr,
} from '@/data/profile';
import { useColors, useTheme } from '@/theme/theme-provider';
import { cardSurface, listSurface, radius, spacing, type } from '@/theme/tokens';

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
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** "9 Sep". */
function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** "Week of 8 September", the chart's readout date. */
function weekOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
  return `Week of ${d}`;
}

/**
 * Profile: who you are and how training is going. A header with the
 * photo, name and when training started; three stats; workouts per week
 * against the target; recent PRs; strength levels for the main lifts.
 * Everything you set, including the weekly target, experience and
 * equipment, is in Settings behind the gear.
 *
 * The basics read on every focus. The stats come from the account-wide PR
 * scan, which the session cache in data/scan-cache.ts holds until a set
 * or workout changes, so switching tabs does not rerun it, and a scan any
 * other screen already ran is reused. Pull to refresh forces a rescan.
 */
export default function ProfileScreen() {
  const { session } = useAuth();
  const { scheme, colors: c } = useTheme();
  const { unit, label: unitLabel, loading: unitLoading } = useWeightUnit();
  const router = useRouter();
  const user = session?.user;
  const userId = user?.id;
  const anonymous = !!user?.is_anonymous;

  const [username, setUsername] = useState<string | null>(null);
  const [basics, setBasics] = useState<ProfileBasics | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [body, setBody] = useState<BodyProfile | null>(null);
  // From the scan cache when another screen already ran the scan, so the
  // volume shows on the first frame. Undefined until the first read.
  const [stats, setStats] = useState<ProfileStats | null | undefined>(() =>
    userId && !unitLoading ? peekProfileStats(userId, unit) : undefined,
  );
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (force: boolean) => {
      // Volume and PR weights are converted to the unit, so wait for it.
      if (!userId || unitLoading) return;
      // Minted here if the account has none yet, as Settings does, so a
      // new guest's avatar has an initial.
      const [name, b, t, bp] = await Promise.all([
        ensureUsername(userId),
        getProfileBasics(userId),
        getWeeklyTarget(userId),
        getBodyProfile(userId),
      ]);
      setUsername(name);
      setBasics(b);
      setTarget(t);
      setBody(bp);
      setStats(await getProfileStats(userId, bp.bodyweight, unit, { force }));
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

  const openExercise = (id: string) => router.push({ pathname: '/exercises/[id]', params: { id } });
  const openSettings = () => router.push('/settings');

  const name = anonymous ? 'Guest' : displayName(user?.user_metadata);
  // The first finished workout, else the day the account was made. Waits
  // for the basics so the line does not jump from one to the other.
  const since = basics
    ? (localDateFromIso(basics.firstWorkoutDate) ?? (user?.created_at ? new Date(user.created_at) : null))
    : null;
  const thisWeek = basics?.weeks[basics.weeks.length - 1]?.days ?? 0;
  const empty = basics != null && basics.finishedCount === 0;
  // Only the first load shows skeletons; the tab keeps its state after that.
  const basicsLoading = basics == null;

  const points: ChartPoint[] = (basics?.weeks ?? []).map((w) => ({
    date: w.weekStart,
    value: w.days,
    workoutId: w.weekStart,
  }));

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
          <View style={styles.header}>
            <Avatar meta={user?.user_metadata} username={username} size={64} />
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
              {since ? (
                <Text style={[type.meta, styles.subline, { color: c.text2 }]}>Training since {monthYear(since)}</Text>
              ) : basicsLoading ? (
                <SkeletonText variant={styles.subline} width="60%" />
              ) : null}
            </View>
            <Pressable
              onPress={openSettings}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              style={({ pressed }) => [styles.gear, pressed && settingsStyles.pressed]}>
              {/* A 36 pt filled circle inside the 44 pt tap target. */}
              <View style={[styles.gearCircle, { backgroundColor: c.surface2 }]}>
                <SymbolView
                  name="gearshape"
                  size={20}
                  tintColor={c.text2}
                  fallback={<Text style={[styles.gearFallback, { color: c.text2 }]}>⚙</Text>}
                />
              </View>
            </Pressable>
          </View>

          {anonymous ? (
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

          {empty ? (
            <Text style={[type.meta, styles.emptyLine, { color: c.text2 }]}>
              Finish a workout to see your progress here.
            </Text>
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

          {!empty && stats && stats.recentPrs.length > 0 ? (
            <ListGroup title="Recent PRs">
              {stats.recentPrs.map((pr) => (
                <PrRow key={pr.setId} pr={pr} onPress={() => openExercise(pr.exerciseId)} />
              ))}
            </ListGroup>
          ) : null}

          {!empty && stats && stats.liftMaxes.length > 0 && body ? (
            <StrengthLevels lifts={stats.liftMaxes} body={body} onOpen={openExercise} onSettings={openSettings} />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
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

/** Exercise name over weight × reps, the date on the right. Opens the exercise. */
function PrRow({ pr, onPress }: { pr: RecentPr; onPress: () => void }) {
  const c = useColors();
  const { unit, label } = useWeightUnit();
  // A reps-only exercise has no weight at all; show its reps alone rather
  // than formatSetWeight's placeholder.
  const hasWeight = pr.weight_value != null || !!pr.weight?.trim();
  const weight = hasWeight
    ? formatSetWeight({ ...pr, weight_value: tidyWeight(pr.weight_value, unit) }, pr.weightType, label)
    : null;
  const reps = pr.reps == null ? '' : weight ? ` × ${pr.reps}` : `${pr.reps} reps`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.prRow, pressed && settingsStyles.pressed]}>
      <View style={styles.prText}>
        <Text style={[styles.rowText, { color: c.text }]} numberOfLines={1}>
          {pr.exerciseName}
        </Text>
        <Text style={[type.restTime, { color: c.text2 }]}>
          {weight ?? ''}
          {reps}
        </Text>
      </View>
      <Text style={[type.restTime, { color: c.text2 }]}>{shortDate(pr.workoutDate)}</Text>
    </Pressable>
  );
}

/**
 * One row per main lift the user has logged, with its level. Same rules
 * as the exercise screen's section: Other gets the reason instead, and sex
 * plus bodyweight are required. Birthday is optional; without it the
 * thresholds use no age adjustment.
 */
function StrengthLevels({
  lifts,
  body,
  onOpen,
  onSettings,
}: {
  lifts: LiftMax[];
  body: BodyProfile;
  onOpen: (id: string) => void;
  onSettings: () => void;
}) {
  const { scheme, colors: c } = useTheme();
  const { unit } = useWeightUnit();
  const title = <Text style={[type.label, styles.groupTitle, { color: c.text3 }]}>Strength levels</Text>;

  if (body.sex === 'other') {
    return (
      <View style={styles.group}>
        {title}
        <View style={[styles.card, cardSurface(scheme, c)]}>
          <Text style={[type.meta, { color: c.text2 }]}>
            Strength levels use male and female lifting data, so they don't show for Other.
          </Text>
          <Pressable
            onPress={onSettings}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => pressed && settingsStyles.pressed}>
            <Text style={[type.button, { color: c.accentText }]}>Change in Settings</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (body.sex == null || body.bodyweight == null) {
    return (
      <View style={styles.group}>
        {title}
        <Pressable
          onPress={onSettings}
          accessibilityRole="button"
          style={({ pressed }) => [styles.card, listSurface(scheme, c), pressed && settingsStyles.pressed]}>
          <Text style={[styles.rowText, { color: c.text }]}>Add your body details to see your strength level</Text>
          <Text style={[type.button, { color: c.accentText }]}>Add details</Text>
        </Pressable>
      </View>
    );
  }

  const sex = body.sex;
  const bodyweightKg = convertWeight(body.bodyweight, unit, 'kg');
  const age = ageFromBirthday(body.birthday);
  const rows = lifts.flatMap((lift) => {
    const thresholds = strengthThresholds(lift.exerciseId, sex, bodyweightKg, age);
    if (!thresholds) return [];
    return [{ ...lift, level: strengthLevel(convertWeight(lift.estimatedMax, unit, 'kg'), thresholds).level }];
  });
  if (rows.length === 0) return null;
  return (
    <ListGroup title="Strength levels">
      {rows.map((r) => (
        <ListRow key={r.exerciseId} label={r.exerciseName} value={r.level} onPress={() => onOpen(r.exerciseId)} />
      ))}
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.xl, paddingBottom: 48 },
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
    alignSelf: 'flex-start',
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
  emptyLine: { fontSize: 15, textAlign: 'center' },
  card: { borderRadius: radius.card, padding: spacing.card, gap: spacing.md },
  group: { gap: spacing.sm },
  groupTitle: { paddingHorizontal: spacing.xs },
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
});
