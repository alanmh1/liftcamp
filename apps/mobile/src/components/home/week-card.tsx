import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  heatColor,
  medalProgress,
  streakShare,
  weekCardLine,
  weekCardState,
  weekMedal,
  type StreakShare,
  type WeekCardState,
} from '@liftcamp/shared';
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { AppState, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Medal } from '@/components/medals/medal';
import { Skeleton, SkeletonCircle, SkeletonText } from '@/components/skeleton';
import { FIRST_MEDAL_TITLE, MedalRow } from '@/components/streak/medal-row';
import { chipLabel, DAY_CIRCLE, DayRow, RestToken, restWeekShowing, StreakChip } from '@/components/streak/streak-parts';
import { Text } from '@/components/text';
import { celebrate, reward } from '@/lib/haptics';
import { useColors, useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, tabular, type, type ColorScheme, type Palette } from '@/theme/tokens';

/**
 * The Workouts this week card on Home: the count, one segment per workout
 * of the target warming from ice to ember as the week fills, the day row,
 * a line of encouragement keyed to where the week stands, the streak chip,
 * and the next medal as the goal. The rules and the copy are in
 * packages/shared (week-card.ts, medals.ts, heat.ts); the spec is
 * docs/week-card-v2-spec.md, over docs/week-card-spec.md. Tapping opens
 * History; the chip opens the streak sheet.
 *
 * States: normal; at risk (ember-tinted fill, ember border, hot chip, ember
 * now-segment and today ring); hit (ember border, the count in
 * streakBig); a rest week covering last week (ice fill and border, ice
 * chip and today ring); and a medal week, which draws the medal hero in
 * place of the whole card: chip, medal, its name and line, then a footer
 * with this week's count and Share. One border width (1.5) in every state,
 * so nothing shifts.
 *
 * Two animations. A segment filled since the card last drew this week pops
 * in. And once per week, on the first Home visit after the app was opened
 * or came back from the background following the week being hit, the card
 * celebrates: the segments pulse, the count pops, the chip lands, the
 * border turns ember, a medal lands on a medal week, and a soft glow
 * passes behind it, with the celebrate and reward haptics. Not on the
 * return from the summary, where confetti just ran. Reduce Motion shows
 * the end state with no motion; haptics still run.
 *
 * Home decides whether the celebration plays before it draws the card
 * (checkWeekCelebration), since a celebrating card sits higher on Home,
 * and passes the decision in as `celebrate`.
 *
 * For VoiceOver, which reads the card as one element, the chip is an
 * "Open streak" action on the card.
 *
 * `WeekCard` is Home's: it reads the dates, the clock and the stored flags.
 * `WeekCardView` draws a given state and line and plays the animations
 * when told, which is what the dev gallery (app/dev/week-card.tsx) renders.
 */

const MEDAL_SIZE = 132;
/** Segments that animate: a fixed set of hooks. A target past this draws the rest still. */
const MAX_SEGMENTS = 7;
const SPRING = { damping: 12, stiffness: 180 };

/** Under the `liftcamp:` prefix, so deleting an account and Start fresh clear them. */
const KEYS = {
  resetShown: 'liftcamp:week-reset-shown',
  celebrated: 'liftcamp:week-celebrated',
  armed: 'liftcamp:week-celebrate-armed',
};

// When the app was last opened: launch, or a return from the background.
// Module level, so it survives Home remounts.
let openedAt = Date.now();
let lastAppState = AppState.currentState;
AppState.addEventListener('change', (next) => {
  if (lastAppState === 'background' && next === 'active') openedAt = Date.now();
  lastAppState = next;
});

// Whether the celebration has played since launch, for Home's What's new
// card, which never shares a launch with it. `celebrationCheck` is the
// latest check in flight, so the card can wait for it instead of racing it.
let celebratedThisLaunch = false;
let celebrationCheck: Promise<unknown> = Promise.resolve();
const celebrationListeners = new Set<() => void>();

/** True once the celebration has played this launch, after any check in flight. */
export async function weekCelebratedThisLaunch(): Promise<boolean> {
  await celebrationCheck;
  return celebratedThisLaunch;
}

/** Calls `listener` when the celebration plays. Returns the unsubscribe. */
export function subscribeWeekCelebration(listener: () => void): () => void {
  celebrationListeners.add(listener);
  return () => {
    celebrationListeners.delete(listener);
  };
}

// The done count each week was last drawn with, so only segments filled
// since then pop in. Module level so a remount does not replay them.
const drawnDone = new Map<string, number>();

// The last celebration a card played (WeekCard's `celebrate`), so a card
// remounted in its other place on Home does not play it again.
let playedToken = 0;

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Whether to celebrate now, and records it when so. A hit week is armed on
 * the first Home visit that sees it (right after the summary, most often)
 * and plays on the first visit after the next open. Once per week.
 */
async function shouldCelebrate(weekStart: string): Promise<boolean> {
  const celebrated = await AsyncStorage.getItem(KEYS.celebrated).catch(() => null);
  if (celebrated === weekStart) return false;
  const armed = await readJson<{ weekStart: string; at: number }>(KEYS.armed);
  if (!armed || armed.weekStart !== weekStart) {
    await AsyncStorage.setItem(KEYS.armed, JSON.stringify({ weekStart, at: Date.now() })).catch(() => {});
    return false;
  }
  if (armed.at >= openedAt) return false;
  await AsyncStorage.setItem(KEYS.celebrated, weekStart).catch(() => {});
  return true;
}

function isHit(state: WeekCardState): boolean {
  return state.phase === 'hit' || state.phase === 'over';
}

/**
 * Home's celebration check for one focus: arms a hit week, or says the
 * celebration plays now (and records it). False at once when the week is
 * not hit. What's new waits on the same check (weekCelebratedThisLaunch).
 */
export function checkWeekCelebration(state: WeekCardState): Promise<boolean> {
  if (!isHit(state)) return Promise.resolve(false);
  const check = shouldCelebrate(state.weekStart).then((go) => {
    if (go) {
      celebratedThisLaunch = true;
      celebrationListeners.forEach((listener) => listener());
    }
    return go;
  });
  celebrationCheck = check.catch(() => {});
  return check.catch(() => false);
}

/** "Text." from "Text" or "Text.", for joining lines into one label. */
function sentence(s: string): string {
  const t = s.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

export function WeekCard({
  dates,
  target,
  finishedCount,
  celebrate: celebrateToken,
  onPress,
  onOpenStreak,
  onShareStreak,
}: {
  /** Every finished workout date, raw. */
  dates: string[];
  target: number;
  finishedCount: number;
  /**
   * Goes up each time Home's check says the celebration plays
   * (checkWeekCelebration). 0 is never. The card plays each value once.
   */
  celebrate: number;
  onPress: () => void;
  /** Opens the streak sheet. */
  onOpenStreak: () => void;
  /** Opens the streak card preview with the streak's weeks and strip. */
  onShareStreak: (share: StreakShare) => void;
}) {
  const state = useMemo(() => weekCardState({ dates, target, finishedCount }), [dates, target, finishedCount]);
  // The share card's numbers, from the same dates and target as the streak.
  const share = useMemo(() => streakShare(dates, target), [dates, target]);
  const { done, weekStart } = state;
  const view = useRef<WeekCardHandle>(null);

  // The reset line shows once a week. Blank until the stored week is read,
  // rather than a line that might then change.
  const [resetShownFor, setResetShownFor] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    AsyncStorage.getItem(KEYS.resetShown).then(setResetShownFor, () => setResetShownFor(null));
  }, []);
  const line = resetShownFor === undefined ? null : weekCardLine(state, { resetShownFor });
  const showingReset = line === 'Streak reset. New one starts now.';
  useEffect(() => {
    if (showingReset) void AsyncStorage.setItem(KEYS.resetShown, weekStart).catch(() => {});
  }, [showingReset, weekStart]);

  // Segments filled since this week was last drawn pop in, staggered.
  useEffect(() => {
    const prev = drawnDone.get(weekStart);
    drawnDone.set(weekStart, done);
    if (prev === undefined || done <= prev) return;
    view.current?.popIn(prev);
  }, [weekStart, done]);

  useEffect(() => {
    if (celebrateToken <= playedToken) return;
    playedToken = celebrateToken;
    view.current?.play();
  }, [celebrateToken]);

  return (
    <WeekCardView
      ref={view}
      state={state}
      line={line}
      dates={dates}
      onPress={onPress}
      onOpenStreak={onOpenStreak}
      onShareStreak={share ? () => onShareStreak(share) : undefined}
    />
  );
}

/** What `WeekCardView` plays on demand. */
export type WeekCardHandle = {
  /** The once-a-week celebration: pulse, pop, chip, border, glow, haptics. */
  play: () => void;
  /** Pops the segments from index `from` up to the done count, staggered. */
  popIn: (from: number) => void;
};

/**
 * The card's fill, its border when not lit, and whether it is lit (an
 * ember border: at risk, hit, or a medal week).
 */
function cardTone(state: WeekCardState, medal: number | null, scheme: ColorScheme, c: Palette) {
  // No border in light mode until the card is lit; dark cards keep theirs.
  const plain = scheme === 'dark' ? c.border : `${c.accent}00`;
  if (medal != null) return { fill: c.streakHitBg, border: plain, lit: true };
  if (state.atRisk) return { fill: c.streakRiskBg, border: plain, lit: true };
  if (isHit(state)) return { fill: c.surface, border: plain, lit: true };
  if (restWeekShowing(state)) return { fill: c.iceBg, border: c.iceBorder, lit: false };
  return { fill: c.surface, border: plain, lit: false };
}

/**
 * The card drawn from a computed state and line, with no reads of its own.
 * `line` null holds the line's height blank. `today` places the day row;
 * it defaults to now, as on Home.
 */
export function WeekCardView({
  state,
  line,
  dates,
  today,
  onPress,
  onOpenStreak,
  onShareStreak,
  ref,
}: {
  state: WeekCardState;
  line: string | null;
  /** Finished workout dates, YYYY-MM-DD; the ones in this week fill the day row. */
  dates: readonly string[];
  today?: Date;
  onPress: () => void;
  /** Opens the streak sheet. Without it the chip opens what the card does. */
  onOpenStreak?: () => void;
  /** Opens the streak card preview, from a medal week's Share. Without it there is no Share. */
  onShareStreak?: () => void;
  ref?: Ref<WeekCardHandle>;
}) {
  const { scheme, colors: c } = useTheme();
  const reduceMotion = useReducedMotion();
  const { done, target, streak } = state;
  const hit = isHit(state);
  const medal = weekMedal(state);
  const progress = medalProgress(state);
  const tone = cardTone(state, medal, scheme, c);

  // Seven segments' scales, a fixed set of hooks.
  const s0 = useSharedValue(1);
  const s1 = useSharedValue(1);
  const s2 = useSharedValue(1);
  const s3 = useSharedValue(1);
  const s4 = useSharedValue(1);
  const s5 = useSharedValue(1);
  const s6 = useSharedValue(1);
  const scales: SharedValue<number>[] = [s0, s1, s2, s3, s4, s5, s6];

  const countScale = useSharedValue(1);
  const chipOpacity = useSharedValue(1);
  const chipY = useSharedValue(0);
  const chipScale = useSharedValue(1);
  const border = useSharedValue(tone.lit ? 1 : 0);
  const glow = useSharedValue(0);
  const medalScale = useSharedValue(1);
  const celebrating = useRef(false);

  useEffect(() => {
    if (!celebrating.current) border.set(tone.lit ? 1 : 0);
  }, [tone.lit, border]);

  function popIn(from: number) {
    if (reduceMotion) return;
    for (let i = from; i < Math.min(done, target, MAX_SEGMENTS); i += 1) {
      scales[i].set(0.6);
      scales[i].set(withDelay((i - from) * 60, withSequence(withSpring(1.12, SPRING), withSpring(1, SPRING))));
    }
  }

  function play() {
    celebrating.current = true;
    celebrate();
    setTimeout(reward, 550);
    setTimeout(() => {
      celebrating.current = false;
    }, 1500);
    if (reduceMotion) {
      border.set(1);
      medalScale.set(1);
      return;
    }
    const filled = Math.min(done, target, MAX_SEGMENTS);
    for (let i = 0; i < filled; i += 1) {
      scales[i].set(withDelay(i * 80, withSequence(withSpring(1.25, SPRING), withSpring(1, SPRING))));
    }
    countScale.set(withDelay(350, withSequence(withTiming(1.15, { duration: 150 }), withTiming(1, { duration: 150 }))));
    if (streak.current === 1) {
      // A one-week streak is new this week: the chip lands.
      chipOpacity.set(0);
      chipY.set(6);
      chipOpacity.set(withDelay(550, withTiming(1, { duration: 250 })));
      chipY.set(withDelay(550, withTiming(0, { duration: 250 })));
    } else {
      chipScale.set(withDelay(550, withSequence(withTiming(1.2, { duration: 125 }), withTiming(1, { duration: 125 }))));
    }
    if (medal != null) {
      // The medal lands with the chip: in from nothing, a little past full
      // size, and settles.
      medalScale.set(0);
      medalScale.set(withDelay(550, withSequence(withSpring(1.2, SPRING), withSpring(1, SPRING))));
    }
    border.set(0);
    border.set(withDelay(550, withTiming(1, { duration: 300 })));
    const peak = scheme === 'dark' ? 0.5 : 0.9;
    glow.set(withDelay(900, withSequence(withTiming(peak, { duration: 300 }), withTiming(0, { duration: 300 }))));
  }

  // No deps: the handle reads the latest render's values when it runs.
  useImperativeHandle(ref, () => ({ play, popIn }));

  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(border.value, [0, 1], [tone.border, c.streak]),
  }));
  const countStyle = useAnimatedStyle(() => ({ transform: [{ scale: countScale.value }] }));
  const chipStyle = useAnimatedStyle(() => ({
    opacity: chipOpacity.value,
    transform: [{ translateY: chipY.value }, { scale: chipScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  const openStreak = onOpenStreak ?? onPress;
  const chip = (
    <Animated.View style={chipStyle}>
      <StreakChip state={state} onPress={openStreak} />
    </Animated.View>
  );

  const firstMedal = progress.prev == null && streak.current === 0;
  const label = [
    `${done} of ${target} workouts this week.`,
    line ? sentence(line) : '',
    sentence(chipLabel(state)),
    medal != null ? `${medal}-week medal earned.` : sentence(firstMedal ? FIRST_MEDAL_TITLE : progress.line),
    'Open history.',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View>
      <Animated.View pointerEvents="none" style={[styles.glow, { backgroundColor: c.streakSoft }, glowStyle]} />
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityActions={[{ name: 'openStreak', label: 'Open streak' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'openStreak') openStreak();
        }}
        style={({ pressed }) => pressed && styles.pressed}>
        <Animated.View
          style={[styles.card, cardSurface(scheme, c), { backgroundColor: tone.fill }, styles.border, cardStyle]}>
          {medal != null ? (
            <>
              <View style={styles.hero}>
                {chip}
                <Medal weeks={medal} size={MEDAL_SIZE} animatedScale={medalScale} />
                <Animated.View style={countStyle}>
                  <Text style={[styles.heroTitle, { color: c.text }]}>{medal}-week medal</Text>
                </Animated.View>
                <Text style={[styles.heroLine, { color: c.text2 }]} numberOfLines={2}>
                  {line ?? ' '}
                </Text>
              </View>
              <View style={[styles.footer, { backgroundColor: c.surface }]}>
                <Text style={[styles.footerText, { color: c.text2 }]}>
                  This week {done} of {target}
                </Text>
                <View style={styles.mini}>
                  {Array.from({ length: target }, (_, i) => (
                    <Segment key={i} index={i} state={state} scale={scales[i]} style={styles.miniSegment} />
                  ))}
                </View>
                {onShareStreak ? (
                  <Pressable
                    onPress={onShareStreak}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Share streak"
                    style={({ pressed }) => pressed && styles.pressed}>
                    <Text style={[type.button, { color: c.accentText }]}>Share</Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : (
            <>
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text style={[styles.eyebrow, { color: c.text2 }]}>This week</Text>
                  <Animated.View style={[styles.countRow, countStyle]}>
                    <Text style={[styles.count, { color: hit ? c.streakBig : c.text }]}>{done}</Text>
                    <Text style={[styles.of, { color: c.text2 }]}>
                      of {target} {target === 1 ? 'workout' : 'workouts'}
                    </Text>
                  </Animated.View>
                </View>
                <View style={styles.badges}>
                  {chip}
                  {streak.restBanked ? <RestToken count={1} /> : null}
                </View>
              </View>

              <View style={styles.segments}>
                {Array.from({ length: target }, (_, i) => (
                  <Segment key={i} index={i} state={state} scale={scales[i]} style={styles.segment} />
                ))}
              </View>

              <DayRow state={state} dates={dates} today={today} />

              {/* Its own full-width row, every state. */}
              <Text style={[type.meta, { color: c.text2 }]} numberOfLines={2}>
                {line ?? ' '}
              </Text>

              <View style={[styles.divider, { backgroundColor: c.divider }]} />
              <MedalRow progress={progress} streak={streak.current} />
            </>
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
}

/**
 * Segment `index` (0-based) of the target: the heat color for
 * (index + 1) / target once that many are done; then the "now" segment, a
 * dashed outline (ember at risk); then surface2.
 */
function Segment({
  index,
  state,
  scale,
  style,
}: {
  index: number;
  state: WeekCardState;
  /** Undefined past MAX_SEGMENTS: drawn still. */
  scale: SharedValue<number> | undefined;
  style: ViewStyle;
}) {
  const c = useColors();
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale ? scale.value : 1 }] }));
  const target = Math.max(1, state.target);
  let look: ViewStyle;
  if (index < state.done) look = { backgroundColor: heatColor((index + 1) / target) };
  else if (index === state.done) look = { ...styles.now, borderColor: state.atRisk ? c.streak : c.text3 };
  else look = { backgroundColor: c.surface2 };
  return <Animated.View style={[style, look, animated]} />;
}

/** The card's shape before its reads are in: the normal state's heights, so nothing shifts. */
export function WeekCardSkeleton() {
  const { scheme, colors: c } = useTheme();
  return (
    <View style={[styles.card, cardSurface(scheme, c), styles.border, { borderColor: scheme === 'dark' ? c.border : 'transparent' }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <SkeletonText variant={styles.eyebrow} width={64} />
          <SkeletonText variant={styles.count} width={150} />
        </View>
        <Skeleton width={84} height={32} radius={radius.pill} />
      </View>
      <Skeleton height={12} radius={6} />
      <View style={styles.skeletonDays}>
        {Array.from({ length: 7 }, (_, i) => (
          <View key={i} style={styles.skeletonDay}>
            <SkeletonText variant={styles.letterSize} width={8} />
            <SkeletonCircle size={DAY_CIRCLE} />
          </View>
        ))}
      </View>
      <SkeletonText variant={type.meta} width="70%" />
      <View style={[styles.divider, { backgroundColor: c.divider }]} />
      <View style={styles.skeletonMedals}>
        <SkeletonCircle size={44} />
        <View style={styles.skeletonMiddle}>
          <Skeleton height={8} radius={4} />
          <SkeletonText variant={styles.lineSize} width="70%" />
        </View>
        <SkeletonCircle size={60} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: spacing.card,
    gap: spacing.md,
  },
  // One border width in every state, so nothing shifts when it turns ember.
  border: { borderWidth: 1.5 },
  glow: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: radius.card + 6,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  headerText: { flexShrink: 1 },
  eyebrow: { fontSize: 13, fontWeight: '600' },
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, alignSelf: 'flex-start' },
  count: { fontSize: 40, fontWeight: '700', letterSpacing: -0.8, ...tabular },
  of: { fontSize: 17, fontWeight: '500', ...tabular },
  badges: { alignItems: 'flex-end', gap: 6 },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 12, borderRadius: 6 },
  now: { borderWidth: 2, borderStyle: 'dashed' },
  divider: { height: StyleSheet.hairlineWidth },
  hero: { alignItems: 'center', gap: spacing.sm },
  heroTitle: { fontSize: 22, fontWeight: '700' },
  heroLine: { fontSize: 15, textAlign: 'center' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.bar,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  footerText: { fontSize: 14, fontWeight: '600', ...tabular },
  mini: { flexDirection: 'row', gap: 4, flex: 1 },
  miniSegment: { width: 28, height: 8, borderRadius: 4 },
  letterSize: { fontSize: 11 },
  lineSize: { fontSize: 13 },
  skeletonDays: { flexDirection: 'row', justifyContent: 'space-between' },
  skeletonDay: { alignItems: 'center', gap: 6 },
  skeletonMedals: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  skeletonMiddle: { flex: 1, gap: 6 },
  pressed: { opacity: 0.8 },
});
