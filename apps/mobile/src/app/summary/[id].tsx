import {
  comparisonParts,
  countedSets,
  formatDuration,
  hasPendingFinish,
  isCardio,
  isMilestoneWorkout,
  LB_PER_KG,
  localDateFromIso,
  pickComparisonLine,
  pickVolumeComparison,
  routineFromWorkout,
  streakShare,
  workoutMedal,
  workoutSubtitle,
  workStat,
  type StreakShare,
} from '@liftcamp/shared';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import type { SheetRef } from '@/components/BottomSheet';
import { useAuth } from '@/components/auth-provider';
import { Reveal, Skeleton, SkeletonText } from '@/components/skeleton';
import { Confetti } from '@/components/summary/confetti';
import { STREAK_CARD_BACKGROUND, StreakCard } from '@/components/home/streak-card';
import { ShareActions } from '@/components/share/share-actions';
import { CARD_SIZE, SHARE_CARD_BACKGROUND, ShareCard, type CardData } from '@/components/summary/share-card';
import {
  MedalEarnedLine,
  SummaryCarousel,
  summaryPages,
  type SummaryPage,
} from '@/components/summary/summary-carousel';
import { SaveRoutineSheet } from '@/components/history/save-routine-sheet';
import { confirmUpdateRoutine, useRoutineUpdate } from '@/components/history/update-routine';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { UsernameSheet } from '@/components/username-sheet';
import { WorkoutNoteRow, WorkoutNoteSheet } from '@/components/workout/workout-note';
import { getPrSetIds, getWorkoutDetail, type WorkoutDetail } from '@/data/history';
import {
  ensureUsername,
  getFinishedWorkoutCount,
  getStreakWorkoutDates,
  getWeeklyTarget,
  getWeekWorkoutDates,
} from '@/data/home';
import { getNextTime, summaryFromPhone, type NextTimeRow, type SummarySource } from '@/data/summary';
import { getBodyweight, setWorkoutNotes } from '@/data/workouts';
import { writeQueue } from '@/data/write-queue';
import { markScreen } from '@/lib/launch-timing';
import { useProgressionGate } from '@/lib/pro';
import { SHARE_URL } from '@/lib/share-image';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';

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

/** How long "Saved" holds where the save card was, before it fades. */
const SAVED_MS = 2000;

/** Next time rows shown before Show all. */
const NEXT_TIME_COLLAPSED = 3;

/** How long each card holds during the one automatic pass through the carousel. */
const CYCLE_STEP_MS = 2500;

/** "Tuesday, September 29", from the local date. US English whatever the device. */
function dateLabel(workoutDate: string): string {
  const d = new Date(`${workoutDate}T00:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

type Loaded = {
  detail: WorkoutDetail;
  count: number;
  celebrate: boolean;
  username: string;
  /** Picked once here, so the carousel and the capture show the same line. */
  comparisonLine: string | null;
  /** The medal this workout earned (workoutMedal), and its streak card. Null for most workouts. */
  medal: { weeks: number; share: StreakShare } | null;
};

/**
 * The medal a workout earned and the streak share card for it, or null.
 * workoutMedal is the walk Home stores and celebrates, read as of the
 * workout's day. The card's numbers come from the same day.
 */
function earnedMedal(
  dates: readonly string[],
  target: number,
  workoutDate: string,
): { weeks: number; share: StreakShare } | null {
  const weeks = workoutMedal(dates, target, workoutDate);
  const day = localDateFromIso(workoutDate);
  if (weeks == null || !day) return null;
  const share = streakShare(dates, target, day);
  return share ? { weeks, share: { ...share, weeks } } : null;
}

/**
 * The end of a workout: a headline, the workout number, three share cards,
 * the username that is printed on them, share, and Done. Replaces the
 * workout screen in the root stack, so there is no way back into it; Done
 * is the only exit.
 *
 * The confetti gate: every one of the first three workouts, every milestone
 * (`isMilestoneWorkout`), and otherwise a session that reaches the weekly
 * target or sets a personal record on a compound lift. The PR set ids are the same `getPrSetIds` the history and
 * detail screens use, intersected with this workout's sets, so a ribbon
 * there and a burst here cannot disagree.
 *
 * A workout that earned a streak medal (workoutMedal in shared: its day hit
 * the week and the streak landed on a rung) adds the streak share card in
 * its medal layout as the last page, after the workout cards, and a quiet
 * "You earned the 12-week medal" line at the end. Nothing else: no second
 * celebration and no haptic. The week card celebrates the medal on the
 * next Home open, as for any medal week.
 *
 * The carousel walks itself once, card by card, and stops on the last:
 * the medal card when there is one, otherwise the comparison card, the
 * most shareable either way, so someone who never swipes still sees what
 * is there. It starts
 * when the confetti lands, or straight away when there is none, and a
 * swipe on the carousel ends it for good. A swipe, not any touch: a guest's
 * summary is taller than the screen with the save card on it, and a
 * vertical scroll that happened to start on the carousel was ending the
 * pass before it began.
 *
 * A guest gets Create account beside Share, with a line under the pair. It
 * opens link-account over this screen; a successful link comes back here,
 * the session stops being anonymous, and the pair gives way to Share alone
 * with "Saved" under it for a moment. It sits in the scroll content, under
 * the confetti overlay, so it never holds up or covers the burst.
 *
 * Done is a quiet text button pinned at the bottom. The scroll content is
 * padded by the footer's measured height, so nothing can sit under it.
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
  const progressionOpen = useProgressionGate();
  const { width } = useWindowDimensions();
  const userId = session?.user.id;
  const anonymous = !!session?.user.is_anonymous;

  // True for SAVED_MS after this guest links an account from the card.
  // Linking keeps the user id, so the screen stays mounted and sees the
  // session go from anonymous to not. A link that lands on a different,
  // existing account changes the id and the root stack remounts instead.
  const [saved, setSaved] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
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
  // The workout's note as typed. Saved through the queue on every change.
  const [notes, setNotes] = useState('');
  const noteSheetRef = useRef<SheetRef>(null);
  const [username, setUsername] = useState<string>('');
  // Drawn from the phone's copy because the finish has not synced yet.
  const [unsynced, setUnsynced] = useState(false);
  // Pro only: what to aim for next time, per exercise. Empty until it loads,
  // and never loaded for anyone else.
  const [nextTime, setNextTime] = useState<NextTimeRow[]>([]);
  // More than NEXT_TIME_COLLAPSED rows start collapsed behind Show all.
  const [showAllNext, setShowAllNext] = useState(false);
  const [page, setPage] = useState(0);
  // The card being captured at full size, mounted offscreen only for the
  // capture. Three permanent 1080 point views for an image nobody may send
  // is not worth the memory.
  const [capturing, setCapturing] = useState<SummaryPage | null>(null);
  const captureView = useRef<View>(null);
  const captureLaidOut = useRef<(() => void) | null>(null);
  const usernameRef = useRef<SheetRef>(null);
  const saveRoutineRef = useRef<SheetRef>(null);
  // Saved as a routine from this screen, so the offer goes.
  const [routineSaved, setRoutineSaved] = useState(false);
  const carousel = useRef<ScrollView>(null);
  // The automatic pass: its pending timer, and whether it may ever run
  // again. A swipe sets the latter true and it stays true.
  const cycleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycleStarted = useRef(false);
  const cycleDone = useRef(false);

  useEffect(() => {
    markScreen('summary', 'open');
  }, []);

  useEffect(() => {
    if (!userId || !id || unitLoading) return;
    let cancelled = false;

    async function fromServer(): Promise<SummarySource | null> {
      // Pending, not awaited: the detail and the PR marks need it only to
      // score what they fetched, so every read starts at once.
      const bodyweight = getBodyweight(userId!);
      const [detail, prSetIds, count, target, weekDates, streakDates, name] = await Promise.all([
        getWorkoutDetail(userId!, id, bodyweight, weightUnit),
        getPrSetIds(userId!, bodyweight, weightUnit),
        getFinishedWorkoutCount(userId!),
        getWeeklyTarget(userId!),
        getWeekWorkoutDates(userId!),
        getStreakWorkoutDates(userId!),
        ensureUsername(session!.user),
      ]);
      return detail ? { detail, prSetIds, count, target, weekDates, streakDates, name } : null;
    }

    (async () => {
      // A finish still on the phone: the server's read would be missing
      // it, so the phone's copy draws the summary, with no request.
      const phone = await summaryFromPhone(userId, id, weightUnit);
      if (cancelled) return;
      const source = phone ?? (await fromServer());
      if (cancelled) return;
      if (!source) {
        router.dismissTo('/');
        return;
      }
      setUnsynced(phone != null);
      const { detail, prSetIds, count, target, weekDates, streakDates, name } = source;
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
      setNotes(detail.notes ?? '');
      setLoaded({
        detail,
        count,
        celebrate: count <= 3 || isMilestoneWorkout(count) || hitTarget || compoundPr,
        username: name ?? '',
        comparisonLine: entry ? pickComparisonLine(entry) : null,
        medal: earnedMedal(streakDates, target, detail.workoutDate),
      });
      markScreen('summary', 'content');
    })();
    return () => {
      cancelled = true;
    };
    // `unit` is read once for the line pick; it does not change mid-screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, id, router, weightUnit, unitLoading]);

  // "Will sync" goes once the finish has reached the server, on this
  // screen: the queue reports after every run, and ops go in order, so
  // everything before the finish has gone too. A note edited here later
  // does not bring it back.
  useEffect(() => {
    if (!unsynced || !id) return;
    const check = () => {
      if (!hasPendingFinish(writeQueue.pending(), id)) setUnsynced(false);
    };
    check();
    return writeQueue.subscribe(check);
  }, [unsynced, id]);

  function onChangeNotes(text: string) {
    if (!userId) return;
    setNotes(text);
    void setWorkoutNotes(userId, id, text);
  }

  // After the summary itself, so a slow history read never holds it up.
  const loadedDetail = loaded?.detail ?? null;

  // What Save as routine would write: the completed exercises. Offered only
  // for a workout not started from a routine, and hidden when empty.
  const routine = useMemo(
    () =>
      routineFromWorkout(
        (loadedDetail?.exercises ?? []).map((we) => ({
          exerciseId: we.exercise.id,
          sets: we.sets,
          cardio: isCardio(we.exercise),
        })),
      ),
    [loadedDetail],
  );
  const offerRoutine = !!loadedDetail && !loadedDetail.templateId && routine.length > 0 && !routineSaved;
  // A workout started from one of the user's routines that added, removed
  // or replaced an exercise gets Update routine in the same slot instead.
  const { update: routineUpdate, onUpdated: onRoutineUpdated } = useRoutineUpdate(userId, loadedDetail, {
    latestOnly: false,
  });
  const [updatingRoutine, setUpdatingRoutine] = useState(false);

  async function onUpdateRoutine() {
    if (!userId || !routineUpdate || updatingRoutine) return;
    setUpdatingRoutine(true);
    const ok = await confirmUpdateRoutine(userId, routineUpdate);
    setUpdatingRoutine(false);
    if (ok) onRoutineUpdated();
  }
  useEffect(() => {
    if (!userId || !loadedDetail || !progressionOpen) {
      setNextTime([]);
      return;
    }
    let cancelled = false;
    getNextTime(userId, loadedDetail, weightUnit)
      .then((rows) => {
        if (!cancelled) setNextTime(rows);
      })
      .catch(() => {
        // The block is left out; the summary is whole without it.
      });
    return () => {
      cancelled = true;
    };
  }, [userId, loadedDetail, progressionOpen, weightUnit]);

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
        // Cardio adds no volume; a cardio-only workout shows its time here.
        const work = workStat(d.volume, d.cardioSeconds, unit);
        return {
          username,
          name: d.name?.trim() || 'Workout',
          dateLabel: dateLabel(d.workoutDate),
          duration: formatDuration(d.createdAt, d.finishedAt),
          volume: work.value,
          volumeLabel: work.label,
          sets: d.completedSets,
          exercises: d.exercises
            .map((we) => ({ name: we.exercise.name, sets: countedSets(we.sets).length }))
            .filter((e) => e.sets > 0),
          comparison:
            entry && loaded.comparisonLine
              ? { slug: entry.slug, ...comparisonParts(loaded.comparisonLine) }
              : null,
        };
      })()
    : null;

  // The comparison card is skipped under the lightest object, per the table.
  // The medal card, when this workout earned one, comes after the workout's.
  const pages: SummaryPage[] = summaryPages({ comparison: !!data?.comparison, medal: !!loaded?.medal });
  const cardCount = pages.length;

  // With no confetti the pass starts as soon as the cards exist; with
  // confetti it waits for the burst's onDone below.
  useEffect(() => {
    if (loaded && !loaded.celebrate) startCycle(cardCount);
  }, [loaded, cardCount, startCycle]);

  /** Mounts the active card at 1080 offscreen, waits for layout, captures it. */
  const capture = useCallback(async (): Promise<string | null> => {
    const kind = pages[page];
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
  }, [pages, page]);

  const medalPage = pages[page] === 'medal' ? loaded?.medal : undefined;

  // Pinned over the bottom of the scroll; its measured height pads the
  // scroll content so the last row always clears it.
  const doneButton = (
    <View
      style={[styles.footer, { backgroundColor: c.bg }]}
      onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}>
      <Pressable
        onPress={() => router.dismissTo('/')}
        accessibilityRole="button"
        hitSlop={8}
        style={({ pressed }) => [styles.done, pressed && styles.pressed]}>
        <Text style={[type.button, { color: c.text2 }]}>Done</Text>
      </Pressable>
    </View>
  );

  // Same outer tree as the loaded return below, so the Reveal persists and
  // crossfades. Done is live from the start, so a slow read never traps
  // anyone on this screen.
  if (!loaded || !data) {
    return (
      <View style={[styles.fill, { backgroundColor: c.bg }]}>
        <SafeAreaView style={styles.fill}>
          <Reveal ready={false} skeleton={<SummarySkeleton cardWidth={cardWidth} />} style={styles.fill}>
            {null}
          </Reveal>
          {doneButton}
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.fill}>
        <Reveal ready skeleton={null} style={styles.fill}>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: footerHeight + spacing.xl }]}
            showsVerticalScrollIndicator={false}>
            <View style={styles.head}>
              <Text style={[styles.headline, { color: c.text }]}>
                {HEADLINES[(loaded.count - 1 + HEADLINES.length) % HEADLINES.length]}
              </Text>
              <Text style={[type.meta, styles.count, { color: c.text2 }]}>
                {workoutSubtitle(loaded.count)}
              </Text>
              {unsynced ? (
                <Text style={[type.meta, styles.count, { color: c.text2 }]}>
                  Will sync when you&apos;re back online.
                </Text>
              ) : null}
            </View>

            {/* Pro: next session's targets, first after the headline. Never on
                the share card. Free users and workouts with nothing to suggest
                have no block, so the carousel sits under the headline. */}
            {nextTime.length > 0 ? (
              <View style={styles.nextTime}>
                <Text style={[type.label, { color: c.accentText }]}>Next time</Text>
                <View style={[styles.nextTimeCard, cardSurface(scheme, c)]}>
                  {(showAllNext ? nextTime : nextTime.slice(0, NEXT_TIME_COLLAPSED)).map((row, i) => (
                    <View
                      key={row.exerciseId}
                      style={[
                        styles.nextTimeRow,
                        i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                      ]}>
                      <View style={styles.nextTimeText}>
                        <Text style={[type.button, { color: c.text }]} numberOfLines={1}>
                          {row.name}
                        </Text>
                        <Text style={[type.meta, { color: c.text2 }]}>{row.reason}</Text>
                      </View>
                      <Text style={[type.prevNumeral, styles.nextTimeFigure, { color: c.text }]}>
                        {row.label}
                      </Text>
                    </View>
                  ))}
                  {!showAllNext && nextTime.length > NEXT_TIME_COLLAPSED ? (
                    <Pressable
                      onPress={() => setShowAllNext(true)}
                      accessibilityRole="button"
                      accessibilityLabel={`Show all ${nextTime.length} exercises`}
                      style={({ pressed }) => [
                        styles.showAll,
                        { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
                        pressed && styles.pressed,
                      ]}>
                      <Text style={[type.button, { color: c.accentText }]}>Show all</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}

            <SummaryCarousel
              ref={carousel}
              pages={pages}
              data={data}
              medalShare={loaded.medal?.share ?? null}
              width={width}
              cardWidth={cardWidth}
              page={page}
              onPage={setPage}
              onScrollBeginDrag={cancelCycle}
            />

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

            {/* Share, and for a guest Create account beside it at the same
                width, tinted rather than filled so Share stays the primary. */}
            <View style={styles.actions}>
              <ShareActions
                surface={medalPage ? 'medal' : 'summary'}
                capture={capture}
                message={
                  medalPage
                    ? `My ${medalPage.weeks}-week streak on LiftCamp ${SHARE_URL}`
                    : `My workout on LiftCamp ${SHARE_URL}`
                }
                background={medalPage ? STREAK_CARD_BACKGROUND : SHARE_CARD_BACKGROUND}
                style={styles.shareActions}
                beside={
                  anonymous ? (
                    <Pressable
                      onPress={() => router.push('/link-account')}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.share, { backgroundColor: c.accentSoft }, pressed && styles.pressed]}>
                      <Text style={[type.button, { color: c.accentText }]}>Create account</Text>
                    </Pressable>
                  ) : null
                }
              />
              {anonymous ? (
                <Text style={[type.meta, styles.saveLine, { color: c.text2 }]}>
                  Create a free account to log your next workout.
                </Text>
              ) : saved ? (
                <Animated.View exiting={FadeOut.duration(400)} style={styles.saved}>
                  <Text style={[type.button, { color: c.accentText }]}>Saved</Text>
                </Animated.View>
              ) : null}
              {/* The create flow for routines: an empty workout, saved
                  after. There is no builder yet. */}
              {offerRoutine ? (
                <Pressable
                  onPress={() => saveRoutineRef.current?.present()}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.saveRoutine,
                    { backgroundColor: c.surface, borderColor: c.border },
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[type.button, { color: c.text }]}>Save as routine</Text>
                </Pressable>
              ) : routineUpdate ? (
                <Pressable
                  onPress={() => void onUpdateRoutine()}
                  disabled={updatingRoutine}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.saveRoutine,
                    { backgroundColor: c.surface, borderColor: c.border },
                    (pressed || updatingRoutine) && styles.pressed,
                  ]}>
                  <Text style={[type.button, { color: c.text }]}>Update routine</Text>
                </Pressable>
              ) : null}
            </View>

            <WorkoutNoteRow notes={notes} onPress={() => noteSheetRef.current?.present()} style={styles.noteRow} />

            {/* Quiet: the medal's celebration is the week card's, on Home. */}
            {loaded.medal ? <MedalEarnedLine weeks={loaded.medal.weeks} /> : null}
          </ScrollView>
        </Reveal>

        {doneButton}
      </SafeAreaView>

      {/* Offscreen, at share resolution, only while a capture is in flight. */}
      {capturing ? (
        <View style={styles.offscreen} pointerEvents="none">
          <View onLayout={() => captureLaidOut.current?.()} collapsable={false}>
            {capturing === 'medal' ? (
              loaded.medal ? <StreakCard ref={captureView} share={loaded.medal.share} size={CARD_SIZE} /> : null
            ) : (
              <ShareCard ref={captureView} kind={capturing} data={data} size={CARD_SIZE} forSharing />
            )}
          </View>
        </View>
      ) : null}

      {loaded.celebrate ? <Confetti onDone={() => startCycle(cardCount)} /> : null}

      <WorkoutNoteSheet ref={noteSheetRef} value={notes} onChangeText={onChangeNotes} />

      <SaveRoutineSheet
        ref={saveRoutineRef}
        userId={userId}
        workoutId={id}
        initialName={loaded.detail.name?.trim() || 'Workout'}
        exercises={routine}
        onSaved={(name) => {
          setRoutineSaved(true);
          Alert.alert('Routine saved', `${name} is in your routines on Workout.`);
        }}
      />

      <UsernameSheet
        ref={usernameRef}
        userId={userId}
        current={username}
        onSaved={(name) => setUsername(name)}
      />
    </View>
  );
}

/**
 * The summary's shape while the workout loads: the headline and count, the
 * first share card, the page dots, the username line and the share button.
 */
function SummarySkeleton({ cardWidth }: { cardWidth: number }) {
  return (
    <View style={styles.content}>
      <View style={styles.head}>
        <SkeletonText variant={styles.headline} width={180} />
        <SkeletonText variant={styles.count} width={130} />
      </View>
      <View style={styles.page}>
        {/* The card's corner is 48 of its 1080 points. */}
        <Skeleton width={cardWidth} height={cardWidth} radius={(cardWidth * 48) / CARD_SIZE} />
      </View>
      <View style={styles.dots}>
        <Skeleton width={8} height={8} radius={radius.pill} />
        <Skeleton width={8} height={8} radius={radius.pill} />
      </View>
      <View style={styles.usernameRow}>
        <SkeletonText variant={type.button} width={170} />
      </View>
      <View style={styles.shareRow}>
        <Skeleton height={SHARE_BUTTON_HEIGHT} radius={radius.bar} style={styles.fill} />
      </View>
    </View>
  );
}

/** The Share button: 15pt button text inside 16pt of padding each side. */
const SHARE_BUTTON_HEIGHT = 51;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingTop: spacing.xl, paddingBottom: spacing.xl, gap: spacing.lg },
  head: { alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.screen },
  headline: { fontSize: 34, fontWeight: '700', letterSpacing: -0.7, textAlign: 'center' },
  count: { fontSize: 15 },
  noteRow: { paddingHorizontal: spacing.screen },
  page: { alignItems: 'center', paddingVertical: spacing.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
  },
  shareRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.screen },
  shareActions: { paddingHorizontal: spacing.screen },
  share: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
  },
  actions: { gap: spacing.sm },
  // Share's shape, outlined, on its own row under Share.
  saveRoutine: {
    marginHorizontal: spacing.screen,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
  },
  saveLine: { textAlign: 'center', paddingHorizontal: spacing.screen },
  saved: { alignItems: 'center', paddingVertical: spacing.md },
  nextTime: { gap: spacing.sm, paddingHorizontal: spacing.screen },
  nextTimeCard: { borderRadius: radius.card, paddingHorizontal: spacing.lg },
  nextTimeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  nextTimeText: { flex: 1, gap: 2 },
  nextTimeFigure: { fontSize: 15, fontWeight: '600' },
  showAll: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  // A quiet text button: no fill, no border, 44 pt tall.
  done: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  offscreen: { position: 'absolute', left: -CARD_SIZE * 2, top: 0 },
  pressed: { opacity: 0.7 },
});
