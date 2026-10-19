import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  proseNumber,
  streakShare,
  weekCardLine,
  weekCardState,
  weekMedal,
  type StreakShare,
  type WeekCardState,
} from '@liftcamp/shared';
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
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

import { Plate } from '@/components/home/plate';
import { Medal } from '@/components/medals/medal';
import { SkeletonCircle, SkeletonText } from '@/components/skeleton';
import { Text } from '@/components/text';
import { localDateIso, startOfWeek } from '@/data/home';
import { celebrate, reward } from '@/lib/haptics';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, tabular, type } from '@/theme/tokens';

/**
 * The Workouts this week card on Home: the count as weight plates, a line
 * of encouragement keyed to where the week stands, the week streak as a
 * chip, and the day dots. The rules and the copy are in packages/shared
 * week-card.ts; the spec is docs/week-card-spec.md. Tapping opens History.
 *
 * Two animations. A plate filled since the card last drew this week pops
 * in. And once per week, on the first Home visit after the app was opened
 * or came back from the background following the week being hit, the card
 * celebrates: plates pulse, the count pops, the chip lands, the border
 * turns accent, a medal lands on a medal week, and a soft glow passes
 * behind it, with the celebrate and
 * reward haptics. Not on the return from the summary, where confetti just
 * ran. Reduce Motion shows the end state with no motion; haptics still run.
 *
 * A medal week (the week's hit takes the streak onto a rung of the medal
 * ladder, packages/shared medals.ts) shows the medal in the plates' slot
 * beside the count, and hides the plates. The line keeps its own row under
 * the count either way. In the celebration the plates pulse in that slot,
 * then fade as the medal lands there with the chip.
 *
 * Sharing the streak: the chip opens the streak card preview for any
 * streak of 1 or more, and on a medal week the celebration leaves a
 * Share button under the medal line once it has finished, which opens
 * the same preview. Both call `onShareStreak`; the chip is a pressable of
 * its own inside the card's, so a tap on it does not open History. For
 * VoiceOver, which reads the card as one element, the same thing is a
 * "Share streak" action on the card.
 *
 * `WeekCard` is Home's: it reads the dates, the clock and the stored flags
 * and decides when to animate. `WeekCardView` draws a given state and line
 * and plays the animations when told, which is what the dev gallery
 * (app/dev/week-card.tsx) renders.
 */

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const PLATE_SIZE = 26;
/**
 * The medal in the plates' slot on a medal week. The slot is this tall
 * that week only, so other weeks keep their height.
 */
const MEDAL_SIZE = 64;
/** Plates drawn at most: the target, then one per extra workout up to this. */
const MAX_PLATES = 7;
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

// The done count each week was last drawn with, so only plates filled
// since then pop in. Module level so a remount does not replay them.
const drawnDone = new Map<string, number>();

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

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function streakLabel(state: WeekCardState): string {
  const n = state.streak.current;
  return `${cap(proseNumber(n))}-week streak${state.streak.restBanked ? ', rest week banked' : ''}`;
}

export function WeekCard({
  dates,
  target,
  finishedCount,
  focusCount,
  onPress,
  onShareStreak,
}: {
  /** Every finished workout date, raw. */
  dates: string[];
  target: number;
  finishedCount: number;
  /** Goes up every time Home gains focus; the celebration check runs on it. */
  focusCount: number;
  onPress: () => void;
  /** Opens the streak card preview with the streak's weeks and strip. */
  onShareStreak: (share: StreakShare) => void;
}) {
  const state = useMemo(() => weekCardState({ dates, target, finishedCount }), [dates, target, finishedCount]);
  // The share card's numbers, from the same dates and target as the streak.
  const share = useMemo(() => streakShare(dates, target), [dates, target]);
  const { done, weekStart, phase } = state;
  const hit = phase === 'hit' || phase === 'over';
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

  // Plates filled since this week was last drawn pop in, staggered.
  useEffect(() => {
    const prev = drawnDone.get(weekStart);
    drawnDone.set(weekStart, done);
    if (prev === undefined || done <= prev) return;
    view.current?.popIn(prev);
  }, [weekStart, done]);

  // On every Home focus with the week hit: arm, or play once armed from an
  // earlier open.
  useEffect(() => {
    if (!hit) return;
    let cancelled = false;
    const check = shouldCelebrate(weekStart).then((go) => {
      if (go) {
        celebratedThisLaunch = true;
        celebrationListeners.forEach((listener) => listener());
      }
      if (go && !cancelled) view.current?.play();
    });
    celebrationCheck = check.catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [focusCount, hit, weekStart]);

  return (
    <WeekCardView
      ref={view}
      state={state}
      line={line}
      dates={dates}
      onPress={onPress}
      onShareStreak={share ? () => onShareStreak(share) : undefined}
    />
  );
}

/** What `WeekCardView` plays on demand. */
export type WeekCardHandle = {
  /** The once-a-week celebration: pulse, pop, chip, border, glow, haptics. */
  play: () => void;
  /** Pops the plates from index `from` up to the done count, staggered. */
  popIn: (from: number) => void;
};

/**
 * The card drawn from a computed state and line, with no reads of its own.
 * `line` null holds the line's height blank. `today` places the day dots;
 * it defaults to now, as on Home.
 */
export function WeekCardView({
  state,
  line,
  dates,
  today,
  onPress,
  onShareStreak,
  ref,
}: {
  state: WeekCardState;
  line: string | null;
  /** Finished workout dates, YYYY-MM-DD; the ones in this week fill the day dots. */
  dates: readonly string[];
  today?: Date;
  onPress: () => void;
  /** Opens the streak card preview. Without it the chip opens what the card does. */
  onShareStreak?: (weeks: number) => void;
  ref?: Ref<WeekCardHandle>;
}) {
  const { scheme, colors: c } = useTheme();
  const reduceMotion = useReducedMotion();
  const { done, target, phase, streak } = state;
  const hit = phase === 'hit' || phase === 'over';

  // Seven plates' scales, a fixed set of hooks.
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
  const border = useSharedValue(hit ? 1 : 0);
  const glow = useSharedValue(0);
  const medalScale = useSharedValue(1);
  const celebrating = useRef(false);
  // A medal week's Share button, shown once the celebration is over. Held
  // for as long as the card is mounted, which on Home is the session.
  const [shareShown, setShareShown] = useState(false);
  const medal = weekMedal(state);
  // On a medal week the plates sit hidden under the medal, shown only while
  // the celebration hands their slot over.
  const platesOpacity = useSharedValue(medal != null ? 0 : 1);

  useEffect(() => {
    if (!celebrating.current) border.value = hit ? 1 : 0;
  }, [hit, border]);

  useEffect(() => {
    if (celebrating.current) return;
    platesOpacity.value = medal != null ? 0 : 1;
    medalScale.value = 1;
  }, [medal, platesOpacity, medalScale]);

  function popIn(from: number) {
    if (reduceMotion) return;
    for (let i = from; i < Math.min(done, MAX_PLATES); i += 1) {
      scales[i].value = 0.6;
      scales[i].value = withDelay((i - from) * 60, withSequence(withSpring(1.12, SPRING), withSpring(1, SPRING)));
    }
  }

  function play() {
    celebrating.current = true;
    celebrate();
    setTimeout(reward, 550);
    setTimeout(() => {
      celebrating.current = false;
      if (medal != null) setShareShown(true);
    }, 1500);
    if (reduceMotion) {
      border.value = 1;
      platesOpacity.value = medal != null ? 0 : 1;
      medalScale.value = 1;
      return;
    }
    const filled = Math.min(done, MAX_PLATES);
    for (let i = 0; i < filled; i += 1) {
      scales[i].value = withDelay(i * 80, withSequence(withSpring(1.25, SPRING), withSpring(1, SPRING)));
    }
    countScale.value = withDelay(350, withSequence(withTiming(1.15, { duration: 150 }), withTiming(1, { duration: 150 })));
    if (streak.current === 1) {
      // The chip is new this week: it lands.
      chipOpacity.value = 0;
      chipY.value = 6;
      chipOpacity.value = withDelay(550, withTiming(1, { duration: 250 }));
      chipY.value = withDelay(550, withTiming(0, { duration: 250 }));
    } else {
      chipScale.value = withDelay(550, withSequence(withTiming(1.2, { duration: 125 }), withTiming(1, { duration: 125 })));
    }
    if (medal != null) {
      // The plates pulse in the slot, then give it to the medal, which
      // lands with the chip: in from nothing, a little past full size, and
      // settles.
      platesOpacity.value = 1;
      platesOpacity.value = withDelay(550, withTiming(0, { duration: 200 }));
      medalScale.value = 0;
      medalScale.value = withDelay(550, withSequence(withSpring(1.2, SPRING), withSpring(1, SPRING)));
    }
    border.value = 0;
    border.value = withDelay(550, withTiming(1, { duration: 300 }));
    const peak = scheme === 'dark' ? 0.5 : 0.9;
    glow.value = withDelay(900, withSequence(withTiming(peak, { duration: 300 }), withTiming(0, { duration: 300 })));
  }

  // No deps: the handle reads the latest render's values when it runs.
  useImperativeHandle(ref, () => ({ play, popIn }));

  // No border in light mode until the week is hit; dark cards keep theirs.
  const restBorder = scheme === 'dark' ? c.border : `${c.accent}00`;
  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(border.value, [0, 1], [restBorder, c.accent]),
  }));
  const countStyle = useAnimatedStyle(() => ({ transform: [{ scale: countScale.value }] }));
  const chipStyle = useAnimatedStyle(() => ({
    opacity: chipOpacity.value,
    transform: [{ translateY: chipY.value }, { scale: chipScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const platesStyle = useAnimatedStyle(() => ({ opacity: platesOpacity.value }));

  const plateCount = Math.max(target, Math.min(done, MAX_PLATES));
  const monday = startOfWeek(today);
  const todayIso = localDateIso(today);
  const trained = new Set(dates);
  const chip = streak.current > 0 ? streakLabel(state) : null;
  const canShare = !!onShareStreak && streak.current > 0;
  const shareStreak = () => onShareStreak?.(streak.current);

  return (
    <View>
      <Animated.View
        pointerEvents="none"
        style={[styles.glow, { backgroundColor: c.accentSoft }, glowStyle]}
      />
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${done} of ${target} workouts this week. ${line ?? ''} ${medal != null ? `${medal}-week medal earned. ` : ''}${chip ? `${chip}. ` : ''}Open history.`}
        accessibilityActions={canShare ? [{ name: 'shareStreak', label: 'Share streak' }] : undefined}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'shareStreak') shareStreak();
        }}
        style={({ pressed }) => pressed && styles.pressed}>
        <Animated.View style={[styles.card, cardSurface(scheme, c), styles.border, cardStyle]}>
          <View style={styles.row}>
            <Text style={[type.label, { color: c.text3 }]}>Workouts this week</Text>
            {chip ? (
              <Pressable
                onPress={canShare ? shareStreak : onPress}
                hitSlop={8}
                style={({ pressed }) => pressed && styles.pressed}>
                <Animated.View style={[styles.chip, { backgroundColor: c.accentSoft }, chipStyle]}>
                  <Plate size={12} filled />
                  <Text style={[type.meta, styles.chipText, { color: c.accentText }]}>
                    {streak.current} {streak.current === 1 ? 'week' : 'weeks'}
                  </Text>
                  {streak.restBanked ? <Plate size={10} filled={false} /> : null}
                </Animated.View>
              </Pressable>
            ) : null}
          </View>

          <View style={[styles.row, styles.center]}>
            {/* The app's Text, so the weight maps to Outfit's bold face; the
                animated view around it carries the pop. */}
            <Animated.View style={countStyle}>
              <Text style={[styles.count, { color: c.text }]}>
                {done} of {target}
              </Text>
            </Animated.View>
            {/* The plates' slot. On a medal week it is the medal's height,
                the plates hidden under it. */}
            <View style={[styles.slot, medal != null && styles.medalSlot]}>
              <Animated.View style={[styles.plates, platesStyle]}>
                {Array.from({ length: plateCount }, (_, i) => (
                  <Plate key={i} size={PLATE_SIZE} filled={i < done} animatedScale={scales[i]} />
                ))}
              </Animated.View>
              {medal != null ? (
                <Medal weeks={medal} size={MEDAL_SIZE} animatedScale={medalScale} style={styles.medal} />
              ) : null}
            </View>
          </View>

          {/* Its own full-width row, every week. */}
          <Text style={[type.meta, { color: c.text2 }]} numberOfLines={2}>
            {line ?? ' '}
          </Text>

          {canShare && medal != null && shareShown ? (
            <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(250)} style={styles.shareWrap}>
              <Pressable
                onPress={shareStreak}
                hitSlop={8}
                style={({ pressed }) => [styles.share, { backgroundColor: c.accentSoft }, pressed && styles.pressed]}>
                <Text style={[type.button, { color: c.accentText }]}>Share</Text>
              </Pressable>
            </Animated.View>
          ) : null}

          <View style={styles.dots}>
            {DAY_LETTERS.map((letter, i) => {
              const d = new Date(monday);
              d.setDate(monday.getDate() + i);
              const iso = localDateIso(d);
              const isToday = iso === todayIso;
              return (
                <View key={i} style={styles.day}>
                  <View
                    style={[
                      styles.dot,
                      trained.has(iso) ? { backgroundColor: c.accent, borderColor: c.accent } : { borderColor: c.border },
                      isToday && { borderColor: c.accentText, borderWidth: 2 },
                    ]}
                  />
                  <Text style={[styles.letter, { color: isToday ? c.text : c.text3 }]}>{letter}</Text>
                </View>
              );
            })}
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

/** The card's shape before its reads are in, the same heights so nothing shifts. */
export function WeekCardSkeleton() {
  const { scheme, colors: c } = useTheme();
  return (
    <View style={[styles.card, cardSurface(scheme, c), styles.border, { borderColor: scheme === 'dark' ? c.border : 'transparent' }]}>
      <SkeletonText variant={type.label} width={128} />
      <View style={[styles.row, styles.center]}>
        <SkeletonText variant={styles.count} width={72} />
        <View style={styles.plates}>
          <SkeletonCircle size={PLATE_SIZE} />
          <SkeletonCircle size={PLATE_SIZE} />
          <SkeletonCircle size={PLATE_SIZE} />
        </View>
      </View>
      <SkeletonText variant={type.meta} width="70%" />
      <View style={styles.dots}>
        {DAY_LETTERS.map((letter, i) => (
          <View key={i} style={styles.day}>
            <SkeletonCircle size={14} />
            <Text style={[styles.letter, { color: c.text3 }]}>{letter}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: spacing.card,
    gap: spacing.sm,
  },
  // One border width in every state, so nothing shifts when it turns accent.
  border: { borderWidth: 1.5 },
  glow: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: radius.card + 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  center: { alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  chipText: { fontWeight: '600', ...tabular },
  slot: { flexShrink: 1, justifyContent: 'center' },
  medalSlot: { height: MEDAL_SIZE, minWidth: MEDAL_SIZE },
  medal: { position: 'absolute', right: 0, top: 0 },
  shareWrap: { alignSelf: 'flex-start' },
  share: {
    borderRadius: radius.bar,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  count: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, ...tabular },
  plates: { flexDirection: 'row', gap: 6, flexShrink: 1, flexWrap: 'wrap', justifyContent: 'flex-end' },
  dots: { flexDirection: 'row', gap: spacing.sm },
  day: { alignItems: 'center', gap: 4 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  letter: { fontSize: 10, fontWeight: '600' },
  pressed: { opacity: 0.8 },
});
