import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  APP_STORAGE_PREFIX,
  estimatedMaxTrend,
  formatLoad,
  formatPerWeek,
  gainPercentLabel,
  GROWTH_BAND,
  isoFromLocalDate,
  localDateFromIso,
  newBestsLabel,
  rangeFor,
  sessionCountInRange,
  setsBand,
  strengthGains,
  togglePin,
  TRENDS_LIMIT,
  TRENDS_PRESETS,
  trendSelection,
  weeklySetsByGroup,
  weightedExercisesByUse,
  type EstimatedMaxTrend,
  type ProgressIndex,
} from '@liftcamp/shared';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { StepChart } from '@/components/progress/charts';
import { TrendsLockedCard } from '@/components/progress/profile-sections';
import { RangeControl } from '@/components/progress/range-control';
import { settingsStyles } from '@/components/settings-ui';
import { SoftPill } from '@/components/soft-pill';
import { useNavHref } from '@/components/tab-layout';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { getProgressIndex, peekProgressIndex } from '@/data/progress';
import { usePro, useProUpsell } from '@/lib/pro';
import { useRangeChoice } from '@/lib/progress-range';
import { SCROLL_END_PADDING } from '@/lib/scroll-insets';
import { useColors, useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, tabular, type } from '@/theme/tokens';

/** The weekly sets bars' label and value columns, so the guides line up with the tracks. */
const WEEKLY_LABEL_W = 82;
const WEEKLY_VALUE_W = 32;
const WEEKLY_GUIDES = [GROWTH_BAND.low, GROWTH_BAND.high] as const;

function pinsKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}trends-pins:${userId}`;
}

/**
 * Trends, Pro only (spec P2): strength gain, estimated max step charts for
 * four exercises (pinnable), and weekly sets per muscle, over a range of
 * its own. A non-Pro deep link sees the locked card and nothing else. All
 * numbers come from the progress index in shared.
 */
export default function TrendsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { colors: c } = useTheme();
  const { unit, label, loading: unitLoading } = useWeightUnit();
  const router = useRouter();
  const navHref = useNavHref();
  const isPro = usePro();
  const upsell = useProUpsell();
  const [choice, setChoice] = useRangeChoice('trends');
  const [index, setIndex] = useState<ProgressIndex | null | undefined>(() =>
    userId && !unitLoading ? peekProgressIndex(userId, unit) : undefined,
  );
  const [pins, setPins] = useState<string[]>([]);
  const editRef = useRef<SheetRef>(null);
  const [draftPins, setDraftPins] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!userId || unitLoading || !isPro) return;
      let cancelled = false;
      void getProgressIndex(userId, unit).then((i) => {
        if (!cancelled) setIndex(i);
      });
      return () => {
        cancelled = true;
      };
    }, [userId, unit, unitLoading, isPro]),
  );

  useEffect(() => {
    if (!userId) return;
    AsyncStorage.getItem(pinsKey(userId))
      .then((v) => {
        const parsed: unknown = v ? JSON.parse(v) : [];
        if (Array.isArray(parsed)) setPins(parsed.filter((p): p is string => typeof p === 'string'));
      })
      .catch(() => {
        // No pins: the four most-logged show.
      });
  }, [userId]);

  const todayIso = isoFromLocalDate(new Date());
  const data = useMemo(() => {
    if (!index) return null;
    const range = rangeFor(choice, localDateFromIso(todayIso) ?? new Date(), index.firstWorkoutDate);
    const selection = trendSelection(index, range, pins);
    const cards = selection.ids.map((id) => ({
      id,
      name: index.exercises.get(id)?.name ?? '',
      sessions: sessionCountInRange(index, id, range),
      trend: estimatedMaxTrend(index, id, range),
    }));
    const gains = strengthGains(cards.flatMap((card) => (card.trend ? [card.trend] : [])));
    return {
      range,
      selection,
      cards,
      gains,
      weekly: weeklySetsByGroup(index, range),
      choices: weightedExercisesByUse(index),
    };
  }, [index, choice, pins, todayIso]);

  function openEdit() {
    setDraftPins(data?.selection.pinned ? data.selection.ids : []);
    editRef.current?.present();
  }

  function savePins() {
    setPins(draftPins);
    if (userId) {
      AsyncStorage.setItem(pinsKey(userId), JSON.stringify(draftPins)).catch(() => {
        // Kept for this visit; the next one shows the most-logged.
      });
    }
    editRef.current?.dismiss();
  }

  const header = (
    <Stack.Screen
      options={{
        headerTitle: () => (
          <View style={styles.headerTitle}>
            <Text style={[styles.headerText, { color: c.text }]}>Trends</Text>
            <View style={[styles.proBadge, { backgroundColor: c.text }]}>
              <Text style={[styles.proText, { color: c.bg }]}>PRO</Text>
            </View>
          </View>
        ),
      }}
    />
  );

  if (!isPro) {
    return (
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content}>
        {header}
        {upsell.available ? <TrendsLockedCard onUnlock={() => upsell.open('trends')} /> : null}
      </ScrollView>
    );
  }

  const openExercise = (id: string) => router.push(navHref({ kind: 'exercise', id }));
  const maxGain = data ? Math.max(0, ...data.gains.map((g) => g.gainPercent)) : 0;

  return (
    <>
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content}>
        {header}
        {index === undefined ? (
          <ActivityIndicator style={styles.loading} color={c.text3} />
        ) : !index || !data ? (
          <Text style={[type.meta, { color: c.text2 }]}>Trends could not load. Pull to refresh on Profile and try again.</Text>
        ) : (
          <>
            <RangeControl presets={TRENDS_PRESETS} choice={choice} onChange={setChoice} firstWorkoutDate={index.firstWorkoutDate} />

            <Section title="Strength gain">
              {data.gains.length === 0 ? (
                <Text style={[type.meta, { color: c.text2 }]}>Log an exercise three times in this range to see its trend.</Text>
              ) : (
                data.gains.map((g) => (
                  <GainRow key={g.exerciseId} trend={g} maxGain={maxGain} unitLabel={label} onPress={() => openExercise(g.exerciseId)} />
                ))
              )}
            </Section>

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={[type.label, styles.flex, { color: c.text3 }]} accessibilityRole="header">
                  Estimated max
                </Text>
                <SoftPill label="Edit" accessibilityLabel="Choose exercises" onPress={openEdit} />
              </View>
              <Text style={[type.meta, styles.sub, { color: c.text2 }]}>
                {data.selection.pinned
                  ? 'Your pinned exercises.'
                  : 'Your four most-logged exercises. Each step up is a new best.'}
              </Text>
              <View style={styles.grid}>
                {data.cards.map((card) => (
                  <MaxCard
                    key={card.id}
                    name={card.name}
                    trend={card.sessions >= 2 ? card.trend : null}
                    range={data.range}
                    unitLabel={label}
                    onPress={() => openExercise(card.id)}
                  />
                ))}
              </View>
              {!data.selection.pinned && data.cards.length < TRENDS_LIMIT ? (
                <Text style={[type.meta, styles.sub, { color: c.text2 }]}>
                  Log an exercise three times in this range to see its trend.
                </Text>
              ) : null}
            </View>

            <Section title="Weekly sets per muscle" right="Average per week">
              <WeeklyChart rows={data.weekly} />
              <View style={styles.legend}>
                {(
                  [
                    ['Under 10', c.accentMuted],
                    ['10 to 20', c.accent],
                    ['Over 20', c.accentDeep],
                  ] as const
                ).map(([text, color]) => (
                  <View key={text} style={styles.legendRow}>
                    <View style={[styles.legendBand, { backgroundColor: color }]} />
                    <Text style={[type.meta, { color: c.text2 }]}>{text}</Text>
                  </View>
                ))}
              </View>
            </Section>
          </>
        )}
      </ScrollView>

      <Sheet ref={editRef} scroll>
        <View style={styles.sheetHead}>
          <Text style={[type.exerciseName, styles.flex, { color: c.text }]}>Choose up to four</Text>
          <Pressable onPress={savePins} accessibilityRole="button" hitSlop={10}>
            <Text style={[type.button, { color: c.accentText }]}>Done</Text>
          </Pressable>
        </View>
        <Text style={[type.meta, styles.sheetSub, { color: c.text2 }]}>
          Pinned exercises replace your four most-logged. Clear them all to go back.
        </Text>
        {(data?.choices ?? []).map((e) => {
          const checked = draftPins.includes(e.id);
          const full = !checked && draftPins.length >= TRENDS_LIMIT;
          return (
            <Pressable
              key={e.id}
              onPress={() => setDraftPins((p) => togglePin(p, e.id))}
              disabled={full}
              accessibilityRole="checkbox"
              accessibilityState={{ checked, disabled: full }}
              style={({ pressed }) => [styles.pinRow, { borderColor: c.divider }, full && styles.disabled, pressed && settingsStyles.pressed]}>
              <View style={styles.flex}>
                <Text style={[styles.rowText, { color: c.text }]} numberOfLines={1}>
                  {e.name}
                </Text>
                <Text style={[type.meta, { color: c.text2 }]}>
                  {e.sessions} {e.sessions === 1 ? 'session' : 'sessions'}
                </Text>
              </View>
              <View
                style={[
                  styles.check,
                  checked ? { backgroundColor: c.accent, borderColor: c.accent } : { borderColor: c.checkBorder },
                ]}>
                {checked ? (
                  <SymbolView
                    name={{ ios: 'checkmark', android: 'check' }}
                    size={13}
                    weight="bold"
                    tintColor="#FFFFFF"
                    fallback={<Text style={styles.checkGlyph}>✓</Text>}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </Sheet>
    </>
  );
}

function Section({ title, right, children }: { title: string; right?: string; children: React.ReactNode }) {
  const { scheme, colors: c } = useTheme();
  return (
    <View style={[styles.card, cardSurface(scheme, c)]}>
      <View style={styles.sectionHead}>
        <Text style={[type.label, styles.flex, { color: c.text3 }]} accessibilityRole="header">
          {title}
        </Text>
        {right ? <Text style={[type.meta, { color: c.text3 }]}>{right}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function GainRow({
  trend,
  maxGain,
  unitLabel,
  onPress,
}: {
  trend: EstimatedMaxTrend;
  maxGain: number;
  unitLabel: string;
  onPress: () => void;
}) {
  const c = useColors();
  const positive = trend.gainPercent > 0;
  const width = positive && maxGain > 0 ? Math.max(4, (trend.gainPercent / maxGain) * 100) : 0;
  const pct = gainPercentLabel(trend.gainPercent);
  const sub = `${formatLoad(Math.round(trend.start))} → ${formatLoad(Math.round(trend.end))} ${unitLabel} estimated max`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${trend.name}, ${pct}. ${sub}`}
      style={({ pressed }) => [styles.gainRow, pressed && settingsStyles.pressed]}>
      <View style={styles.gainHead}>
        <Text style={[styles.rowText, styles.flex, { color: c.text }]} numberOfLines={1}>
          {trend.name}
        </Text>
        <Text style={[styles.gainPct, { color: positive ? c.accentText : c.text2 }]}>{pct}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: c.surface2 }]}>
        {width > 0 ? <View style={[styles.trackFill, { width: `${width}%`, backgroundColor: c.accent }]} /> : null}
      </View>
      <Text style={[type.meta, tabular, { color: c.text2 }]}>{sub}</Text>
    </Pressable>
  );
}

function MaxCard({
  name,
  trend,
  range,
  unitLabel,
  onPress,
}: {
  name: string;
  trend: EstimatedMaxTrend | null;
  range: { start: string; end: string };
  unitLabel: string;
  onPress: () => void;
}) {
  const { scheme, colors: c } = useTheme();
  const value = trend ? formatLoad(Math.round(trend.end)) : '';
  const gain = trend ? Math.round(trend.gain) : 0;
  const holding = gain <= 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        !trend
          ? `${name}, not enough sessions in this range`
          : holding
            ? `${name}, holding at ${value} ${unitLabel} estimated max`
            : `${name}, estimated max ${value} ${unitLabel}, up ${formatLoad(gain)}, ${newBestsLabel(trend.newBests)}`
      }
      style={({ pressed }) => [styles.maxCard, cardSurface(scheme, c), pressed && settingsStyles.pressed]}>
      <Text style={[styles.maxName, { color: c.text }]} numberOfLines={1} ellipsizeMode="tail">
        {name}
      </Text>
      {trend ? (
        <>
          <View style={styles.maxValueRow}>
            <Text style={[styles.maxValue, { color: c.text }]}>
              {value}
              <Text style={[type.meta, { color: c.text2 }]}> {unitLabel}</Text>
            </Text>
            {holding ? null : (
              <Text style={[styles.maxGain, { color: c.accentText, backgroundColor: c.accentSoft }]}>+{formatLoad(gain)}</Text>
            )}
          </View>
          <StepChart points={trend.points} start={trend.start} range={range} unitLabel={unitLabel} holding={holding} />
          <Text style={[type.meta, { color: c.text2 }]}>
            {holding ? `Holding at ${value} ${unitLabel}` : newBestsLabel(trend.newBests)}
          </Text>
        </>
      ) : (
        <Text style={[type.meta, styles.notEnough, { color: c.text2 }]}>Not enough sessions in this range</Text>
      )}
    </Pressable>
  );
}

/**
 * Average weekly sets per muscle group as bars on a 0 to 24 scale, with
 * guide lines at 10 and 20 through every row, labelled once above.
 */
function WeeklyChart({ rows }: { rows: readonly { group: string; label: string; perWeek: number }[] }) {
  const c = useColors();
  const columns = { marginLeft: WEEKLY_LABEL_W + spacing.sm, marginRight: WEEKLY_VALUE_W + spacing.sm };
  return (
    <View style={styles.weekly}>
      <View style={[styles.guideLabels, columns]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {WEEKLY_GUIDES.map((g) => (
          <Text key={g} style={[styles.guideLabel, { left: weeklyPct(g), color: c.text3 }]}>
            {g}
          </Text>
        ))}
      </View>
      <View style={styles.weeklyRows}>
        {rows.map((w) => (
          <WeeklyRow key={w.group} label={w.label} value={w.perWeek} />
        ))}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, columns]}>
          {WEEKLY_GUIDES.map((g) => (
            <View key={g} style={[styles.guideLine, { left: weeklyPct(g), backgroundColor: c.border }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

function weeklyPct(v: number): `${number}%` {
  return `${Math.min(100, (v / GROWTH_BAND.scale) * 100)}%`;
}

function WeeklyRow({ label, value }: { label: string; value: number }) {
  const c = useColors();
  const band = setsBand(value);
  const fill = band === 'in' ? c.accent : band === 'under' ? c.accentMuted : c.accentDeep;
  const spoken = value > 0 && value < 1 ? 'under 1 set a week' : `${formatPerWeek(value)} sets a week`;
  return (
    <View style={styles.weeklyRow} accessible accessibilityLabel={`${label}, ${spoken}`}>
      <Text style={[type.meta, styles.weeklyLabel, { color: c.text }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.weeklyTrack, { backgroundColor: c.surface2 }]}>
        {value > 0 ? <View style={[styles.weeklyFill, { width: weeklyPct(value), backgroundColor: fill }]} /> : null}
      </View>
      <Text style={[type.meta, styles.weeklyValue, { color: c.text }]}>{formatPerWeek(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screen, gap: spacing.xl, paddingBottom: SCROLL_END_PADDING },
  loading: { marginTop: spacing.xl },
  flex: { flex: 1 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerText: { fontSize: 17, fontWeight: '600' },
  proBadge: { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  proText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  card: { borderRadius: radius.card, padding: spacing.card, gap: spacing.md },
  section: { gap: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 20 },
  sub: { paddingHorizontal: spacing.xs },
  rowText: { fontSize: 16 },
  gainRow: { gap: 6 },
  gainHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  gainPct: { fontSize: 15, fontWeight: '600', ...tabular },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  trackFill: { height: 10, borderRadius: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
  maxCard: { width: '47%', flexGrow: 1, borderRadius: radius.card, padding: spacing.card, gap: spacing.sm },
  maxName: { fontSize: 14, fontWeight: '600' },
  maxValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  maxValue: { fontSize: 24, fontWeight: '700', letterSpacing: -0.4, ...tabular },
  maxGain: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    overflow: 'hidden',
    ...tabular,
  },
  notEnough: { minHeight: 120, paddingTop: spacing.sm },
  weekly: { gap: spacing.xs },
  guideLabels: { height: 14 },
  guideLabel: { position: 'absolute', width: 24, marginLeft: -12, textAlign: 'center', fontSize: 11, lineHeight: 14, ...tabular },
  weeklyRows: { gap: spacing.md },
  guideLine: { position: 'absolute', top: 0, bottom: 0, width: 1, marginLeft: -0.5 },
  weeklyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  weeklyLabel: { width: WEEKLY_LABEL_W, fontSize: 14 },
  weeklyTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  weeklyFill: { height: 10, minWidth: 6, borderRadius: 5 },
  weeklyValue: { width: WEEKLY_VALUE_W, textAlign: 'right', fontSize: 14, fontWeight: '600', ...tabular },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.xs },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendBand: { width: 18, height: 10, borderRadius: 3 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.xs },
  sheetSub: { paddingBottom: spacing.sm },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkGlyph: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.4 },
});
