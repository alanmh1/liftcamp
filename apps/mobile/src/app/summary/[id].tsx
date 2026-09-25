import {
  comparisonParts,
  formatDuration,
  LB_PER_KG,
  pickComparisonLine,
  pickVolumeComparison,
} from '@liftcamp/shared';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import type { SheetRef } from '@/components/BottomSheet';
import { useAuth } from '@/components/auth-provider';
import { Confetti } from '@/components/summary/confetti';
import { CARD_SIZE, ShareCard, type CardData, type CardKind } from '@/components/summary/share-card';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { UsernameSheet } from '@/components/username-sheet';
import { getPrSetIds, getWorkoutDetail, type WorkoutDetail } from '@/data/history';
import {
  ensureUsername,
  getFinishedWorkoutCount,
  getWeeklyTarget,
  getWeekWorkoutDates,
} from '@/data/home';
import { getBodyweight } from '@/data/workouts';
import { canShareToStories, shareToStories } from '@/lib/instagram-stories';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, palettes, radius, spacing, type } from '@/theme/tokens';

/** The approved list, in rotation by workout number. */
const HEADLINES = [
  'Nice one.',
  'Another one!',
  'Boo-yah!',
  'Get in!',
  'Beautiful.',
  'Done and dusted.',
  'In the books.',
];

const SHARE_URL = 'https://liftcamp.app';

/** How long "Saved" holds where the save card was, before it fades. */
const SAVED_MS = 2000;

/** How long each card holds during the one automatic pass through the carousel. */
const CYCLE_STEP_MS = 2500;

/** "1st", "12th", "23rd". */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const rem10 = n % 10;
  return `${n}${rem10 === 1 ? 'st' : rem10 === 2 ? 'nd' : rem10 === 3 ? 'rd' : 'th'}`;
}

/** "Wednesday, 9 September", from the local date. */
function dateLabel(workoutDate: string): string {
  const d = new Date(`${workoutDate}T00:00:00`);
  const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
  const month = d.toLocaleDateString(undefined, { month: 'long' });
  return `${weekday}, ${d.getDate()} ${month}`;
}

type Loaded = {
  detail: WorkoutDetail;
  count: number;
  celebrate: boolean;
  username: string;
  /** Picked once here, so the carousel and the capture show the same line. */
  comparisonLine: string | null;
};

/**
 * The end of a workout: a headline, the workout number, three share cards,
 * the username that is printed on them, share, and Done. Replaces the
 * workout screen in the root stack, so there is no way back into it; Done
 * is the only exit.
 *
 * The confetti gate: every one of the first three workouts, and after that
 * a session that reaches the weekly target or sets a personal record on a
 * compound lift. The PR set ids are the same `getPrSetIds` the history and
 * detail screens use, intersected with this workout's sets, so a ribbon
 * there and a burst here cannot disagree.
 *
 * The carousel walks itself once, card by card, and stops on the last, the
 * comparison card, which is the most shareable and sits over the Share
 * button, so someone who never swipes still sees what is there. It starts
 * when the confetti lands, or straight away when there is none, and a
 * swipe on the carousel ends it for good. A swipe, not any touch: a guest's
 * summary is taller than the screen with the save card on it, and a
 * vertical scroll that happened to start on the carousel was ending the
 * pass before it began.
 *
 * A guest gets a card under the share buttons asking them to save the
 * workout. It opens link-account over this screen; a successful link comes
 * back here, the session stops being anonymous, and the card gives way to
 * "Saved" for a moment. It sits in the scroll content, under the confetti
 * overlay, so it never holds up or covers the burst.
 *
 * Presented as a native full-screen modal, so like the workout screen it
 * provides its own BottomSheetModalProvider and SafeAreaProvider: a sheet
 * portals into the nearest provider's host, and the root's host is behind
 * this modal. Without the provider here the username sheet presented
 * invisibly.
 */
export default function WorkoutSummaryScreen() {
  return (
    <SafeAreaProvider>
      <BottomSheetModalProvider>
        <WorkoutSummaryContent />
      </BottomSheetModalProvider>
    </SafeAreaProvider>
  );
}

function WorkoutSummaryContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const { scheme, colors: c } = useTheme();
  const { label: unit, unit: weightUnit, loading: unitLoading } = useWeightUnit();
  const { width } = useWindowDimensions();
  const userId = session?.user.id;
  const anonymous = !!session?.user.is_anonymous;

  // True for SAVED_MS after this guest links an account from the card.
  // Linking keeps the user id, so the screen stays mounted and sees the
  // session go from anonymous to not. A link that lands on a different,
  // existing account changes the id and the root stack remounts instead.
  const [saved, setSaved] = useState(false);
  const wasAnonymous = useRef(anonymous);
  useEffect(() => {
    if (wasAnonymous.current && !anonymous) {
      setSaved(true);
      const t = setTimeout(() => setSaved(false), SAVED_MS);
      wasAnonymous.current = anonymous;
      return () => clearTimeout(t);
    }
    wasAnonymous.current = anonymous;
  }, [anonymous]);

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [username, setUsername] = useState<string>('');
  const [page, setPage] = useState(0);
  const [sharing, setSharing] = useState(false);
  // The card being captured at full size, mounted offscreen only for the
  // capture. Three permanent 1080 point views for an image nobody may send
  // is not worth the memory.
  const [capturing, setCapturing] = useState<CardKind | null>(null);
  const captureView = useRef<View>(null);
  const captureLaidOut = useRef<(() => void) | null>(null);
  const usernameRef = useRef<SheetRef>(null);
  const carousel = useRef<ScrollView>(null);
  // The automatic pass: its pending timer, and whether it may ever run
  // again. A swipe sets the latter true and it stays true.
  const cycleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycleStarted = useRef(false);
  const cycleDone = useRef(false);

  useEffect(() => {
    if (!userId || !id || unitLoading) return;
    let cancelled = false;
    (async () => {
      const bodyweight = await getBodyweight(userId);
      const [detail, prSetIds, count, target, weekDates, name] = await Promise.all([
        getWorkoutDetail(userId, id, bodyweight, weightUnit),
        getPrSetIds(userId, bodyweight, weightUnit),
        getFinishedWorkoutCount(userId),
        getWeeklyTarget(userId),
        getWeekWorkoutDates(userId),
        ensureUsername(userId),
      ]);
      if (cancelled) return;
      if (!detail) {
        router.dismissTo('/');
        return;
      }
      const compoundPr = detail.exercises.some(
        (we) =>
          we.exercise.mechanic === 'compound' &&
          we.sets.some((s) => s.completed && prSetIds != null && prSetIds.has(s.id)),
      );
      // The week's dates include today, since finished_at was written before
      // this screen was pushed; the session that lands on the target fires.
      const hitTarget = weekDates.length === target;
      const volumeLb = unit === 'kg' ? detail.volume * LB_PER_KG : detail.volume;
      const entry = pickVolumeComparison(volumeLb);
      setUsername(name ?? '');
      setLoaded({
        detail,
        count,
        celebrate: count <= 3 || hitTarget || compoundPr,
        username: name ?? '',
        comparisonLine: entry ? pickComparisonLine(entry) : null,
      });
    })();
    return () => {
      cancelled = true;
    };
    // `unit` is read once for the line pick; it does not change mid-screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, id, router, weightUnit, unitLoading]);

  const cardWidth = width - spacing.screen * 2;

  /** Stops the automatic pass, now and for the rest of this screen. */
  const cancelCycle = useCallback(() => {
    cycleDone.current = true;
    if (cycleTimer.current) clearTimeout(cycleTimer.current);
    cycleTimer.current = null;
  }, []);

  /** One pass: each later card in turn, ending on the last. */
  const startCycle = useCallback(
    (cardCount: number) => {
      if (cycleDone.current || cycleStarted.current || cardCount < 2) return;
      cycleStarted.current = true;
      const order = Array.from({ length: cardCount - 1 }, (_, i) => i + 1);
      let step = 0;
      const next = () => {
        if (cycleDone.current) return;
        const target = order[step];
        if (target == null) {
          cycleDone.current = true;
          return;
        }
        carousel.current?.scrollTo({ x: target * width, animated: true });
        setPage(target);
        step += 1;
        cycleTimer.current = setTimeout(next, CYCLE_STEP_MS);
      };
      cycleTimer.current = setTimeout(next, CYCLE_STEP_MS);
    },
    [width],
  );

  useEffect(() => cancelCycle, [cancelCycle]);

  const data: CardData | null = loaded
    ? (() => {
        const d = loaded.detail;
        const volumeLb = unit === 'kg' ? d.volume * LB_PER_KG : d.volume;
        const entry = pickVolumeComparison(volumeLb);
        return {
          username,
          name: d.name?.trim() || 'Workout',
          dateLabel: dateLabel(d.workoutDate),
          duration: formatDuration(d.createdAt, d.finishedAt),
          volume: `${Math.round(d.volume).toLocaleString()} ${unit}`,
          sets: d.completedSets,
          exercises: d.exercises
            .map((we) => ({ name: we.exercise.name, sets: we.sets.filter((s) => s.completed).length }))
            .filter((e) => e.sets > 0),
          comparison:
            entry && loaded.comparisonLine
              ? { slug: entry.slug, ...comparisonParts(loaded.comparisonLine) }
              : null,
        };
      })()
    : null;

  // The comparison card is skipped under the lightest object, per the table.
  const kinds: CardKind[] = data?.comparison ? ['stats', 'exercises', 'comparison'] : ['stats', 'exercises'];
  const cardCount = kinds.length;

  // With no confetti the pass starts as soon as the cards exist; with
  // confetti it waits for the burst's onDone below.
  useEffect(() => {
    if (loaded && !loaded.celebrate) startCycle(cardCount);
  }, [loaded, cardCount, startCycle]);

  /** Mounts the active card at 1080 offscreen, waits for layout, captures it. */
  const capture = useCallback(async (): Promise<string | null> => {
    const kind = kinds[page];
    if (!kind) return null;
    setCapturing(kind);
    await new Promise<void>((resolve) => {
      captureLaidOut.current = resolve;
    });
    // One frame after layout, so the text inside has been drawn too.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const uri = await captureRef(captureView, {
        format: 'png',
        width: CARD_SIZE,
        height: CARD_SIZE,
        quality: 1,
        result: 'tmpfile',
      });
      return uri;
    } catch {
      return null;
    } finally {
      setCapturing(null);
      captureLaidOut.current = null;
    }
  }, [kinds, page]);

  async function onShare() {
    if (sharing) return;
    setSharing(true);
    const uri = await capture();
    setSharing(false);
    if (!uri) {
      Alert.alert('Could not make the image.', 'Try again.');
      return;
    }
    const message = `My workout on LiftCamp ${SHARE_URL}`;
    // iOS takes the image and a line of text together through the system
    // sheet, so the share carries the app name even if the image is
    // stripped. Android's sheet takes one or the other, so it gets the image.
    if (Platform.OS === 'ios') {
      await Share.share({ url: uri, message });
    } else {
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: message });
    }
  }

  async function onStories() {
    if (sharing) return;
    setSharing(true);
    const uri = await capture();
    setSharing(false);
    if (!uri) return;
    const ok = await shareToStories(uri);
    if (!ok) Alert.alert('Instagram is not installed.');
  }

  if (!loaded || !data) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.fill}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.head}>
            <Text style={[styles.headline, { color: c.text }]}>
              {HEADLINES[(loaded.count - 1 + HEADLINES.length) % HEADLINES.length]}
            </Text>
            <Text style={[type.meta, styles.count, { color: c.text2 }]}>
              Your {ordinal(Math.max(1, loaded.count))} workout
            </Text>
          </View>

          {/* The carousel pages at the full window width so the paging snaps,
              with the card inset by the screen padding on each page. */}
          <ScrollView
            ref={carousel}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScrollBeginDrag={cancelCycle}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
            style={styles.carousel}>
            {kinds.map((kind) => (
              <View key={kind} style={[styles.page, { width }]}>
                <View style={styles.cardShadow}>
                  <ShareCard kind={kind} data={data} size={cardWidth} />
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={styles.dots}>
            {kinds.map((kind, i) => (
              <View
                key={kind}
                style={[styles.dot, { backgroundColor: i === page ? c.accent : c.border }]}
              />
            ))}
          </View>

          <Pressable
            onPress={() => usernameRef.current?.present()}
            accessibilityRole="button"
            accessibilityLabel="Edit username"
            hitSlop={8}
            style={({ pressed }) => [styles.usernameRow, pressed && styles.pressed]}>
            <Text style={[type.meta, { color: c.text2 }]}>Posting as </Text>
            <Text style={[type.button, { color: c.text }]}>@{username}</Text>
            <Text style={[type.meta, { color: c.accentText }]}>  Edit</Text>
          </Pressable>

          <View style={styles.shareRow}>
            <Pressable
              onPress={() => void onShare()}
              disabled={sharing}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.share,
                { backgroundColor: c.accent },
                (pressed || sharing) && styles.pressed,
              ]}>
              <Text style={[type.button, { color: palettes.light.bg }]}>
                {sharing ? 'Preparing…' : 'Share'}
              </Text>
            </Pressable>
            {canShareToStories() ? (
              <Pressable
                onPress={() => void onStories()}
                disabled={sharing}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.share,
                  styles.storiesButton,
                  { borderColor: c.border },
                  (pressed || sharing) && styles.pressed,
                ]}>
                <Text style={[type.button, { color: c.text }]}>Stories</Text>
              </Pressable>
            ) : null}
          </View>

          {anonymous ? (
            <View style={[styles.saveCard, cardSurface(scheme, c)]}>
              <Text style={[type.exerciseName, { color: c.text }]}>Save this workout</Text>
              <Text style={[type.meta, { color: c.text2 }]}>
                Create a free account so your workouts are backed up and you can sign in on any device.
              </Text>
              <Pressable
                onPress={() => router.push('/link-account')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.saveButton, { backgroundColor: c.accent }, pressed && styles.pressed]}>
                <Text style={[type.button, { color: palettes.light.bg }]}>Create free account</Text>
              </Pressable>
            </View>
          ) : saved ? (
            <Animated.View exiting={FadeOut.duration(400)} style={styles.saved}>
              <Text style={[type.button, { color: c.accentText }]}>Saved</Text>
            </Animated.View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={() => router.dismissTo('/')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.done, { borderColor: c.border }, pressed && styles.pressed]}>
            <Text style={[type.button, { color: c.text }]}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Offscreen, at share resolution, only while a capture is in flight. */}
      {capturing ? (
        <View style={styles.offscreen} pointerEvents="none">
          <View onLayout={() => captureLaidOut.current?.()} collapsable={false}>
            <ShareCard ref={captureView} kind={capturing} data={data} size={CARD_SIZE} forSharing />
          </View>
        </View>
      ) : null}

      {loaded.celebrate ? <Confetti onDone={() => startCycle(cardCount)} /> : null}

      <UsernameSheet
        ref={usernameRef}
        userId={userId}
        current={username}
        onSaved={(name) => setUsername(name)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingTop: spacing.xl, paddingBottom: spacing.xl, gap: spacing.lg },
  head: { alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.screen },
  headline: { fontSize: 34, fontWeight: '700', letterSpacing: -0.7, textAlign: 'center' },
  count: { fontSize: 15 },
  carousel: { flexGrow: 0 },
  // Vertical room for the card's shadow, which the horizontal ScrollView
  // clips at its own bounds. The page width stays the window width, so the
  // paging still snaps; only the height grows.
  page: { alignItems: 'center', paddingVertical: spacing.lg },
  // The preview lifts off the page a little; the capture has no shadow,
  // because the exported image is the card alone.
  cardShadow: {
    borderRadius: radius.card,
    shadowColor: palettes.light.text,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
  },
  shareRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.screen },
  share: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
  },
  storiesButton: { borderWidth: 1, backgroundColor: 'transparent' },
  saveCard: {
    marginHorizontal: spacing.screen,
    borderRadius: radius.card,
    padding: spacing.card,
    gap: spacing.sm,
  },
  saveButton: {
    marginTop: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.bar,
    paddingVertical: spacing.md,
  },
  saved: { alignItems: 'center', paddingVertical: spacing.md },
  footer: { paddingHorizontal: spacing.screen, paddingBottom: spacing.md, paddingTop: spacing.sm },
  done: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
  },
  offscreen: { position: 'absolute', left: -CARD_SIZE * 2, top: 0 },
  pressed: { opacity: 0.7 },
});
