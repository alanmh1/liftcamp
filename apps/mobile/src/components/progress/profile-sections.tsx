import {
  ageFromBirthday,
  convertWeight,
  formatLoad,
  formatSetWeight,
  isoFromLocalDate,
  roundLoadUp,
  shortDay,
  splitByRecency,
  strengthProgress,
  strengthThresholds,
  tidyWeight,
  type GapTip,
  type MusclesWorked,
  type SinceStarted,
  type TimelineEntry,
} from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { useId, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { BodyDiagram } from '@/components/body-diagram';
import { Sparkline, TrendsGlyph } from '@/components/progress/charts';
import { settingsStyles } from '@/components/settings-ui';
import { SoftPill } from '@/components/soft-pill';
import { Text } from '@/components/text';
import { TipNote } from '@/components/tip-note';
import { useWeightUnit } from '@/components/unit-provider';
import type { BodyProfile } from '@/data/home';
import type { LiftMax } from '@/data/profile';
import { useColors, useTheme } from '@/theme/theme-provider';
import { cardSurface, flattenAlpha, listSurface, radius, spacing, tabular, type } from '@/theme/tokens';

/** Card title in the label style, with an optional right side. */
function CardTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.titleRow}>
      <Text style={[type.label, styles.titleText, { color: c.text3 }]} accessibilityRole="header">
        {title}
      </Text>
      {right}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Muscles worked
// ---------------------------------------------------------------------------

/**
 * The body art's own colours, for the legend: the primary layer's blue, and
 * the secondary layer composited over the clay skin. The figure is one
 * render in both modes (no dark base), so these match it in dark mode too.
 */
const LAYER_PRIMARY = '#496A96';
const LAYER_SECONDARY = '#9AA8B6';

/** Dismissed for the session; it comes back on the next launch. */
let gapTipDismissed = false;

/**
 * Front and back figures with the range's sets painted in (musclesWorked
 * in shared), a legend, and the gap tip when there is one.
 */
export function MusclesWorkedCard({
  muscles,
  tip,
  label,
  onOpenExercise,
}: {
  muscles: MusclesWorked;
  tip: GapTip | null;
  label: string;
  onOpenExercise: (id: string) => void;
}) {
  const { scheme, colors: c } = useTheme();
  const [dismissed, setDismissed] = useState(gapTipDismissed);
  const showTip = tip && !dismissed;
  return (
    <View style={[styles.card, cardSurface(scheme, c)]}>
      <CardTitle title="Muscles worked" />
      <View style={styles.figures} accessible accessibilityRole="image" accessibilityLabel={label}>
        <View style={styles.figure} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <BodyDiagram type="anterior" highlights={muscles.highlights} />
        </View>
        <View style={styles.figure} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <BodyDiagram type="posterior" highlights={muscles.highlights} />
        </View>
      </View>
      <View style={styles.legend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <LegendItem color={LAYER_PRIMARY} label="10+ sets a week" />
        <LegendItem color={LAYER_SECONDARY} label="1 to 9" />
        <LegendItem color={c.surface2} label="None" border={c.border} />
      </View>
      {showTip ? (
        <TipNote
          onDismiss={() => {
            gapTipDismissed = true;
            setDismissed(true);
          }}>
          No {tip.muscle} work in 14 days.{' '}
          <Text style={[styles.tipLink, { color: c.accentText }]} onPress={() => onOpenExercise(tip.exercises[0].id)} accessibilityRole="link">
            {tip.exercises[0].name}
          </Text>{' '}
          and{' '}
          <Text style={[styles.tipLink, { color: c.accentText }]} onPress={() => onOpenExercise(tip.exercises[1].id)} accessibilityRole="link">
            {tip.exercises[1].name}
          </Text>{' '}
          cover it.
        </TipNote>
      ) : null}
    </View>
  );
}

function LegendItem({ color, label, border }: { color: string; label: string; border?: string }) {
  const c = useColors();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }, border ? { borderWidth: 1, borderColor: border } : null]} />
      <Text style={[type.meta, { color: c.text2 }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Strength levels
// ---------------------------------------------------------------------------

/**
 * One row per main lift with a level: the lift, how far to the next level
 * ("27.5 kg to Elite"), a bar filled within the current level, and the
 * current and next level under its ends. Same rules as before for Other
 * and missing details.
 *
 * Only lifts with a working set in the last STRENGTH_RECENT_DAYS show, the
 * most recently trained first. Older ones wait behind Show all, muted.
 * The caller hides the card when no lift is recent.
 */
export function StrengthLevelsCard({
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
  const { unit, label } = useWeightUnit();
  const infoRef = useRef<SheetRef>(null);
  const [showAll, setShowAll] = useState(false);

  if (body.sex === 'other') {
    return (
      <View style={[styles.card, cardSurface(scheme, c)]}>
        <CardTitle title="Strength levels" />
        <Text style={[type.meta, { color: c.text2 }]}>
          Strength levels use male and female lifting data, so they don't show for Other.
        </Text>
        <Pressable onPress={onSettings} accessibilityRole="button" hitSlop={8} style={({ pressed }) => pressed && settingsStyles.pressed}>
          <Text style={[type.button, { color: c.accentText }]}>Change in Settings</Text>
        </Pressable>
      </View>
    );
  }

  if (body.sex == null || body.bodyweight == null) {
    return (
      <View style={styles.group}>
        <Text style={[type.label, styles.groupTitle, { color: c.text3 }]}>Strength levels</Text>
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
    return [{ ...lift, progress: strengthProgress(convertWeight(lift.estimatedMax, unit, 'kg'), thresholds) }];
  });
  const { recent, older } = splitByRecency(rows, isoFromLocalDate(new Date()));
  if (recent.length === 0) return null;
  const shown = showAll ? [...recent.map((r) => ({ r, muted: false })), ...older.map((r) => ({ r, muted: true }))] : recent.map((r) => ({ r, muted: false }));

  return (
    <View style={[styles.card, cardSurface(scheme, c)]}>
      <View style={styles.titleRow}>
        <Text style={[type.label, { color: c.text3 }]} accessibilityRole="header">
          Strength levels
        </Text>
        <Pressable onPress={() => infoRef.current?.present()} hitSlop={10} accessibilityRole="button" accessibilityLabel="About strength levels">
          <SymbolView
            name={{ ios: 'info.circle', android: 'info' }}
            size={16}
            tintColor={c.text3}
            fallback={<Text style={[type.meta, { color: c.text3 }]}>ⓘ</Text>}
          />
        </Pressable>
      </View>
      {shown.map(({ r, muted }) => {
        const p = r.progress;
        const toGo = p.toNextKg == null ? null : roundLoadUp(convertWeight(p.toNextKg, 'kg', unit), unit);
        const right = toGo == null || p.next == null ? 'Top level' : `${toGo} ${label} to ${p.next}`;
        return (
          <Pressable
            key={r.exerciseId}
            onPress={() => onOpen(r.exerciseId)}
            accessibilityRole="button"
            accessibilityLabel={`${r.exerciseName}, ${p.level}, ${right}${muted ? ', not trained recently' : ''}`}
            style={({ pressed }) => [styles.levelRow, muted && styles.muted, pressed && settingsStyles.pressed]}>
            <View style={styles.levelHead}>
              <Text style={[styles.rowText, styles.flex, { color: c.text }]} numberOfLines={1}>
                {r.exerciseName}
              </Text>
              <Text style={[type.meta, tabular, { color: c.text2 }]}>{right}</Text>
            </View>
            <View style={[styles.levelTrack, { backgroundColor: c.accentSoft }]}>
              <View style={[styles.levelFill, { width: `${Math.max(4, p.fill * 100)}%`, backgroundColor: muted ? c.text3 : c.accent }]} />
            </View>
            <View style={styles.levelHead}>
              <Text style={[styles.levelName, { color: c.text2 }]}>{p.level}</Text>
              {p.next ? <Text style={[styles.levelName, { color: c.text3 }]}>{p.next}</Text> : null}
            </View>
          </Pressable>
        );
      })}
      {older.length > 0 ? (
        <Pressable
          onPress={() => setShowAll((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showAll }}
          hitSlop={8}
          style={({ pressed }) => [styles.showAll, pressed && settingsStyles.pressed]}>
          <Text style={[type.button, { color: c.accentText }]}>{showAll ? 'Show less' : 'Show all'}</Text>
        </Pressable>
      ) : null}

      <Sheet ref={infoRef}>
        <Text style={[type.exerciseName, styles.centered, { color: c.text }]}>Strength levels</Text>
        <Text style={[type.meta, styles.sheetBody, styles.centered, { color: c.text }]}>
          Your level is based on your estimated one-rep max, calculated from your best set. The number
          shows how much your estimated max needs to grow to reach the next level.
        </Text>
      </Sheet>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Since you started
// ---------------------------------------------------------------------------

export function SinceStartedCard({
  lifts,
  firstWorkoutDate,
  onOpen,
}: {
  lifts: SinceStarted[];
  firstWorkoutDate: string;
  onOpen: (id: string) => void;
}) {
  const { scheme, colors: c } = useTheme();
  const { label } = useWeightUnit();
  return (
    <View style={[styles.card, cardSurface(scheme, c)]}>
      <CardTitle
        title="Since you started"
        right={
          <Text style={[type.meta, { color: c.text3 }]}>
            {shortDay(firstWorkoutDate, new Date().getFullYear())} to now
          </Text>
        }
      />
      {lifts.map((l) => (
        <Pressable
          key={l.exerciseId}
          onPress={() => onOpen(l.exerciseId)}
          accessibilityRole="button"
          accessibilityLabel={`${l.name}, ${formatLoad(l.first)} to ${formatLoad(l.best)} ${label}`}
          style={({ pressed }) => [styles.sinceRow, pressed && settingsStyles.pressed]}>
          <View style={styles.flex}>
            <Text style={[styles.rowText, { color: c.text }]} numberOfLines={1}>
              {l.name}
            </Text>
            <Text style={[type.restTime, { color: c.text2 }]}>
              {formatLoad(l.first)} → {formatLoad(l.best)} {label}
            </Text>
          </View>
          <Sparkline values={l.series} />
          <View style={[styles.gainPill, { backgroundColor: c.accentSoft }]}>
            <Text style={[styles.gainText, { color: c.accentText }]}>+{formatLoad(Math.max(0, l.gain))}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// PR timeline
// ---------------------------------------------------------------------------

/** The gold star a milestone gets on the timeline. */
function Star({ size = 14 }: { size?: number }) {
  const c = useColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
        fill={c.gold}
        stroke={c.goldDeep}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** "155 lbs × 5", or the reps alone for a reps-only set. */
export function useTimelineSet(): (e: TimelineEntry) => string {
  const { unit, label } = useWeightUnit();
  return (e) => {
    const hasWeight = e.weight_value != null || !!e.weight?.trim();
    const weight = hasWeight ? formatSetWeight({ ...e, weight_value: tidyWeight(e.weight_value, unit) }, e.weightType, label) : null;
    const reps = e.reps == null ? '' : weight ? ` × ${e.reps}` : `${e.reps} reps`;
    return `${weight ?? ''}${reps}`;
  };
}

/** "Nov 9", the row's eyebrow. */
function eyebrow(iso: string): string {
  return shortDay(iso, new Date().getFullYear());
}

/**
 * One timeline row: a marker in the left gutter with a line down to the
 * next row, the date, the exercise (or the milestone), and the set.
 */
export function TimelineRow({
  entry,
  last,
  onPress,
}: {
  entry: TimelineEntry;
  last: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const setText = useTimelineSet();
  const milestone = entry.milestone;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${eyebrow(entry.date)}. ${milestone ? `${milestone}, milestone` : entry.exerciseName}. ${setText(entry)}`}
      style={({ pressed }) => [styles.tlRow, pressed && settingsStyles.pressed]}>
      <View style={styles.tlGutter}>
        <View style={styles.tlMarker}>
          {milestone ? <Star /> : <View style={[styles.tlDot, { backgroundColor: c.text3 }]} />}
        </View>
        {!last ? <View style={[styles.tlLine, { backgroundColor: c.border }]} /> : null}
      </View>
      <View style={styles.tlBody}>
        <Text style={[type.label, { color: c.text3 }]}>
          {eyebrow(entry.date)}
          {milestone ? ' · Milestone' : ''}
        </Text>
        <Text style={[styles.rowText, { color: c.text }]} numberOfLines={2}>
          {milestone ?? entry.exerciseName}
        </Text>
        <Text style={[type.restTime, { color: c.text2 }]}>{setText(entry)}</Text>
      </View>
    </Pressable>
  );
}

export function PrTimelineCard({
  entries,
  total,
  onOpen,
  onSeeAll,
}: {
  entries: TimelineEntry[];
  total: number;
  onOpen: (exerciseId: string) => void;
  onSeeAll: () => void;
}) {
  const { scheme, colors: c } = useTheme();
  return (
    <View style={[styles.card, cardSurface(scheme, c)]}>
      <CardTitle title="PR timeline" right={total > entries.length ? <SoftPill label="See All" onPress={onSeeAll} /> : null} />
      {entries.length === 0 ? (
        <Text style={[type.meta, { color: c.text2 }]}>No PRs in this range yet. Pick a longer range to see more.</Text>
      ) : (
        <View>
          {entries.map((e, i) => (
            <TimelineRow key={e.setId} entry={e} last={i === entries.length - 1} onPress={() => onOpen(e.exerciseId)} />
          ))}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Trends row
// ---------------------------------------------------------------------------

/** For Pro: the row that pushes Trends. */
export function TrendsRow({ onPress }: { onPress: () => void }) {
  const { scheme, colors: c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Trends, estimated max and weekly sets"
      style={({ pressed }) => [styles.trendsRow, cardSurface(scheme, c), pressed && settingsStyles.pressed]}>
      <TrendsGlyph />
      <View style={styles.flex}>
        <Text style={[type.exerciseName, { color: c.text }]}>Trends</Text>
        <Text style={[type.meta, { color: c.text2 }]}>Estimated max and weekly sets</Text>
      </View>
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right' }}
        size={14}
        weight="semibold"
        tintColor={c.text3}
        fallback={<Text style={{ color: c.text3 }}>›</Text>}
      />
    </Pressable>
  );
}

/** The sample chart's values, 0 to 1, left to right: a steady climb with one dip. */
const SAMPLE = [0.12, 0.3, 0.44, 0.36, 0.6, 0.86] as const;
const SAMPLE_HEIGHT = 72;
/** Room at the edges so the round caps and the last dot don't clip. */
const SAMPLE_INSET = 6;

/**
 * An SVG path through `pts` as a monotone cubic (Fritsch-Carlson, as in
 * d3's curveMonotoneX): smooth, and never overshoots a point.
 */
function monotonePath(pts: readonly (readonly [number, number])[]): string {
  const n = pts.length;
  if (n < 2) return '';
  const h: number[] = [];
  const s: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(pts[i + 1]![0] - pts[i]![0]);
    s.push((pts[i + 1]![1] - pts[i]![1]) / h[i]!);
  }
  const m: number[] = [s[0]!];
  for (let i = 1; i < n - 1; i++) {
    const a = s[i - 1]!;
    const b = s[i]!;
    const p = (a * h[i]! + b * h[i - 1]!) / (h[i - 1]! + h[i]!);
    m.push((Math.sign(a) + Math.sign(b)) * Math.min(Math.abs(a), Math.abs(b), 0.5 * Math.abs(p)));
  }
  m.push(s[n - 2]!);
  let d = `M${pts[0]![0]},${pts[0]![1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    const t = h[i]! / 3;
    d += `C${x0 + t},${y0 + m[i]! * t} ${x1 - t},${y1 - m[i + 1]! * t} ${x1},${y1}`;
  }
  return d;
}

/** The locked Trends card's preview: a rising line over a soft fill and three gridlines. */
function SampleChart() {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const top = SAMPLE_INSET;
  const bottom = SAMPLE_HEIGHT - SAMPLE_INSET;
  const left = SAMPLE_INSET;
  const right = width - SAMPLE_INSET;
  const pts = SAMPLE.map(
    (v, i) => [left + ((right - left) * i) / (SAMPLE.length - 1), bottom - (bottom - top) * v] as const,
  );
  const line = monotonePath(pts);
  const last = pts[pts.length - 1]!;
  return (
    <View style={{ height: SAMPLE_HEIGHT }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={SAMPLE_HEIGHT}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.accent} stopOpacity={0.1} />
              <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {[0, 0.5, 1].map((k) => {
            const y = top + (bottom - top) * k;
            return <Line key={k} x1={0} y1={y} x2={width} y2={y} stroke={c.border} strokeWidth={1} />;
          })}
          <Path d={`${line}L${last[0]},${bottom}L${left},${bottom}Z`} fill={`url(#${id})`} />
          <Path d={line} fill="none" stroke={c.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {pts.map(([x, y], i) => (
            <Circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 4 : 2.5} fill={c.accent} />
          ))}
        </Svg>
      )}
    </View>
  );
}

/**
 * For a free user who could buy Pro: a faded sample chart, the pitch, and
 * Unlock with Pro, which opens the paywall.
 */
export function TrendsLockedCard({ onUnlock }: { onUnlock: () => void }) {
  const { scheme, colors: c } = useTheme();
  return (
    <View style={[styles.card, cardSurface(scheme, c)]}>
      <View
        style={[styles.sample, { backgroundColor: c.surface2 }]}
        {...flattenAlpha}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <SampleChart />
      </View>
      <Text style={[type.exerciseName, { color: c.text }]}>See where your lifts are heading</Text>
      <Text style={[type.meta, styles.pitch, { color: c.text2 }]}>
        Estimated max over time and weekly sets for every muscle.
      </Text>
      <Pressable
        onPress={onUnlock}
        accessibilityRole="button"
        style={({ pressed }) => [styles.unlock, { backgroundColor: c.accent }, pressed && settingsStyles.pressed]}>
        <Text style={[type.button, styles.unlockLabel]}>Unlock with Pro</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, padding: spacing.card, gap: spacing.md },
  group: { gap: spacing.sm },
  groupTitle: { paddingHorizontal: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 20 },
  titleText: { flex: 1 },
  flex: { flex: 1 },
  rowText: { fontSize: 16 },
  figures: { flexDirection: 'row', gap: spacing.sm },
  figure: { flex: 1 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  tipLink: { fontWeight: '600' },
  levelRow: { gap: 6, paddingVertical: spacing.xs },
  levelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  levelTrack: { height: 10, borderRadius: 5, overflow: 'hidden' },
  levelFill: { height: 10, borderRadius: 5 },
  levelName: { fontSize: 12, fontWeight: '500' },
  muted: { opacity: 0.55 },
  showAll: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  sheetBody: { fontSize: 15, lineHeight: 22, paddingTop: spacing.sm },
  // The info sheet shows information only, so it centres (apps/mobile/CLAUDE.md, Sheets).
  centered: { textAlign: 'center' },
  sinceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  gainPill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3, minWidth: 44, alignItems: 'center' },
  gainText: { fontSize: 13, fontWeight: '600', ...tabular },
  tlRow: { flexDirection: 'row', gap: spacing.md },
  tlGutter: { width: 16, alignItems: 'center' },
  tlMarker: { height: 18, justifyContent: 'center', alignItems: 'center' },
  tlDot: { width: 8, height: 8, borderRadius: 4 },
  tlLine: { width: 2, flex: 1, borderRadius: 1, marginTop: 2 },
  tlBody: { flex: 1, gap: 2, paddingBottom: spacing.lg },
  trendsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.card,
    padding: spacing.card,
  },
  sample: { borderRadius: radius.input, padding: spacing.sm, opacity: 0.7 },
  pitch: { fontSize: 15, lineHeight: 21 },
  unlock: { alignSelf: 'stretch', alignItems: 'center', borderRadius: radius.bar, paddingVertical: spacing.md, marginTop: spacing.xs },
  unlockLabel: { color: '#FFFFFF' },
});
