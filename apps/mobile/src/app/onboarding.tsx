import {
  matchHeading,
  routineArtByProgram,
  type EquipmentAccess,
  type ProgramGroup,
  type TemplateRow,
  type TrainingLevel,
} from '@liftcamp/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import { EquipmentTiles, LevelTiles } from '@/components/home/pref-tiles';
import { RoutineDetailSheet } from '@/components/home/routine-detail';
import { RoutineGrid } from '@/components/home/routine-grid';
import { useOnboarding } from '@/components/onboarding-provider';
import { SignInScreen } from '@/components/sign-in-screen';
import { Text } from '@/components/text';
import * as home from '@/data/home';
import { startAdHocWorkout } from '@/data/workouts';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, tabular, type } from '@/theme/tokens';

const PAGES = 4;

/** The one line a returning user sees in place of the welcome page. */
const RETURNING_LEAD = 'You already use LiftCamp. A couple of quick questions so we can match routines to you.';

/**
 * First launch: four pages in a horizontal pager.
 *
 * Page 1 is locked until there is a session, because the later pages write
 * to the database. Once signed in, the remaining pages swipe freely. Page 2
 * is the weekly target, page 3 asks level and equipment, page 4 the start
 * choice: a grid of the routines those answers match, each opening the
 * routine detail, whose "Use routine" saves the routine as the user's own
 * and completes onboarding onto Home, where it sits with its Start buttons.
 * Every exit from page 4 writes the target first, so a user who swiped past
 * page 2 still leaves with one (the default, 3). Level and equipment are
 * written when the "Show N routines" button is pressed; swiping past that
 * page leaves them null, which is the unmatched state existing users are
 * in. `complete()` unmounts this route; the empty workout a user starts from
 * page 4 is then opened by Home's resume-on-launch check.
 *
 * A returning user, one whose account has finished workouts, is not
 * welcomed. Onboarding runs per account, and most accounts predate the
 * level and equipment question, so they arrive here signed in with a
 * history. For them the welcome page is not rendered at all: the pager
 * opens on the weekly target with a line that says why they are being
 * asked, and three dots instead of four.
 */
export default function OnboardingScreen() {
  const { session, signInAnonymously, error } = useAuth();
  const { complete } = useOnboarding();
  const c = useColors();
  const { width } = useWindowDimensions();

  const pager = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [system, setSystem] = useState<TemplateRow[]>([]);
  const [target, setTarget] = useState<number>(home.DEFAULT_WEEKLY_TARGET);
  const [level, setLevel] = useState<TrainingLevel | null>(null);
  const [equipment, setEquipment] = useState<EquipmentAccess | null>(null);
  const [showAll, setShowAll] = useState(false);
  /** Both answers written to the profile. Until then page 4 is unfiltered. */
  const [saved, setSaved] = useState(false);
  /** The routine open in the detail sheet, from a tile on page 4. */
  const [detail, setDetail] = useState<ProgramGroup | null>(null);

  const userId = session?.user.id;

  // Decided once, for the session present at mount. Null while the count
  // is in flight, so the pager does not open on the welcome page and then
  // jump. A session minted by Get started is new by definition and never
  // re-evaluated.
  const [returning, setReturning] = useState<boolean | null>(userId ? null : false);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    home.getFinishedWorkoutCount(userId).then((n) => {
      if (!cancelled) setReturning(n > 0);
    });
    return () => {
      cancelled = true;
    };
    // Mount only: the session at mount is the one being asked about.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // With the welcome page not rendered, every physical index is one less
  // than the logical page number the code below uses.
  const skip = returning ? 1 : 0;

  useEffect(() => {
    home.getSystemTemplates().then(setSystem);
  }, []);

  // Page 3's count previews the pair; page 4 lists it once saved. A user who
  // swipes past page 3 without pressing the button has null answers in the
  // profile and sees the unmatched list, the same as an existing user.
  const preview = useMemo(
    () => (level && equipment ? home.starterPrograms(system, { level, equipment }) : null),
    [system, level, equipment],
  );
  // Unanswered, the list is the beginner default the same as Home's; See
  // all opens the full list.
  const fallback = useMemo(
    () => home.starterPrograms(system, { level: null, equipment: null }),
    [system],
  );
  const everything = useMemo(() => home.allPrograms(system), [system]);
  const art = useMemo(() => routineArtByProgram(system), [system]);
  const match = saved && preview ? preview : fallback;
  const shown = showAll ? everything : match;

  /** `i` is the logical page, 0 to 3, whether or not the welcome page exists. */
  function goTo(i: number) {
    const physical = i - skip;
    pager.current?.scrollTo({ x: physical * width, animated: true });
    setPage(physical);
  }

  async function onGetStarted() {
    if (busy) return;
    // A session may already exist: an account created from the sign-in
    // route arrives here already signed in, and an install that predates
    // onboarding keeps its user. Signing in anonymously again would mint a
    // second user and orphan the first one's workouts, so only sign in when
    // there is nothing to keep.
    if (!session) {
      setBusy('start');
      await signInAnonymously();
      setBusy(null);
    }
    goTo(1);
  }

  /** Page 3's button: save both answers, then show what they match. */
  async function onShowPrograms() {
    if (!userId || !level || !equipment || busy) return;
    setBusy('prefs');
    await home.setTrainingPrefs(userId, { level, equipment });
    setBusy(null);
    setSaved(true);
    setShowAll(false);
    goTo(3);
  }

  /** The one way out of onboarding: the target is saved on every path. */
  async function finish() {
    if (!userId) return;
    await home.setWeeklyTarget(userId, target);
    complete();
  }

  async function startAndFinish(key: string, fn: (uid: string) => Promise<string | null>) {
    if (!userId || busy) return;
    setBusy(key);
    const id = await fn(userId);
    if (!id) {
      setBusy(null);
      Alert.alert('Could not start that workout.', 'Try again.');
      return;
    }
    await finish();
    setBusy(null);
  }

  /** Use routine: save every variation as the user's own, then finish onto Home. */
  async function useRoutine(group: ProgramGroup) {
    if (!userId || busy) return;
    setBusy('use');
    const ok = await home.saveProgramCopy(userId, group);
    if (!ok) {
      setBusy(null);
      Alert.alert('Could not save that routine.', 'Try again.');
      return;
    }
    setDetail(null);
    await finish();
    setBusy(null);
  }

  async function onSkip() {
    if (busy) return;
    setBusy('skip');
    await finish();
    setBusy(null);
  }

  if (returning === null) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.fill}>
        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          scrollEnabled={!!session}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          style={styles.fill}>
          {/* 1. Welcome. Not rendered for a returning user. */}
          {!returning ? (
          <View style={[styles.page, { width }]}>
            <View style={styles.center}>
              <Image source={require('../../assets/images/splash-icon.png')} style={styles.logo} />
              <Text style={[type.screenTitle, styles.title, { color: c.text }]}>LiftCamp</Text>
              <Text style={[type.meta, styles.lead, { color: c.text2 }]}>
                Start logging now. Add an account later and keep everything.
              </Text>
            </View>
            <View style={styles.actions}>
              <PrimaryButton
                label={busy === 'start' ? 'Starting…' : 'Get started'}
                onPress={() => void onGetStarted()}
                disabled={busy !== null}
                c={c}
              />
              {/* Only for a fresh install with no session. An account that
                  reached the flow already signed in has nothing to sign into. */}
              {!session ? (
                <Pressable onPress={() => setShowSignIn(true)} hitSlop={8} style={styles.link}>
                  <Text style={[type.meta, { color: c.accentText }]}>I have an account</Text>
                </Pressable>
              ) : null}
              {error ? <Text style={[type.meta, { color: c.danger }]}>{error}</Text> : null}
            </View>
          </View>
          ) : null}

          {/* 2. Weekly target. For a returning user this is the first page,
              and the line above the question says why they are here. */}
          <View style={[styles.page, { width }]}>
            <View style={styles.center}>
              {returning ? (
                <Text style={[type.meta, styles.lead, { color: c.text2 }]}>{RETURNING_LEAD}</Text>
              ) : null}
              <Text style={[type.screenTitle, styles.title, { color: c.text }]}>
                How many days a week can you train?
              </Text>
              <View style={styles.targets}>
                {home.WEEKLY_TARGET_OPTIONS.map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setTarget(n)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: target === n }}
                    style={[
                      styles.target,
                      {
                        backgroundColor: target === n ? c.accentSoft : c.surface2,
                        borderColor: target === n ? c.accent : 'transparent',
                      },
                    ]}>
                    <Text
                      style={[
                        styles.targetNumber,
                        { color: target === n ? c.accentText : c.text },
                      ]}>
                      {n}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[type.meta, styles.lead, { color: c.text2 }]}>
                Three is enough to make progress and easy to keep up. You can change this
                in Profile.
              </Text>
            </View>
            <View style={styles.actions}>
              <PrimaryButton label="Continue" onPress={() => goTo(2)} disabled={busy !== null} c={c} />
            </View>
          </View>

          {/* 3. Level and equipment, in the shape of a filter sheet: both
              rows on one screen and a live count as the continue button. */}
          <View style={[styles.page, { width }]}>
            <ScrollView contentContainerStyle={styles.pageScroll} showsVerticalScrollIndicator={false}>
              <Text style={[type.screenTitle, { color: c.text }]}>What are you working with?</Text>
              <Text style={[type.meta, { color: c.text2 }]}>
                We'll recommend routines based on your experience and what you can train with.
              </Text>
              <View style={styles.filter}>
                <Text style={[type.label, { color: c.text3 }]}>Experience</Text>
                <LevelTiles value={level} onChange={(v) => setLevel(v ?? level)} />
              </View>
              <View style={styles.filter}>
                <Text style={[type.label, { color: c.text3 }]}>Equipment</Text>
                <EquipmentTiles value={equipment} onChange={(v) => setEquipment(v ?? equipment)} />
              </View>
            </ScrollView>
            <View style={styles.actions}>
              <PrimaryButton
                label={
                  busy === 'prefs'
                    ? 'Saving…'
                    : preview
                      ? `Show ${preview.programs.length} ${preview.programs.length === 1 ? 'routine' : 'routines'}`
                      : 'Show routines'
                }
                onPress={() => void onShowPrograms()}
                disabled={busy !== null || !preview}
                c={c}
              />
            </View>
          </View>

          {/* 4. Pick a start, from the programs the answers match. This page
              keeps its side padding on the scroll content rather than the
              frame, so the routine cards' shadows are not clipped at the
              scroll view's edges. */}
          <View style={[styles.pageFlush, { width }]}>
            <ScrollView contentContainerStyle={[styles.pageScroll, styles.pageScrollPadded]} showsVerticalScrollIndicator={false}>
              <Text style={[type.screenTitle, { color: c.text }]}>Choose a starter routine</Text>
              <Text style={[type.meta, { color: c.text2 }]}>
                Pick one routine and repeat it week to week. The weight going up is the progress.
              </Text>
              {!showAll ? (
                <View style={styles.matchLine}>
                  <Text style={[type.meta, styles.matchText, { color: c.text2 }]} numberOfLines={3}>
                    {!match.matched
                      ? 'Beginner routines to start with.'
                      : match.exact
                        ? matchHeading(level!, equipment)
                        : `Nothing matches exactly. ${matchHeading(level!, null)}, any equipment.`}
                  </Text>
                  <Pressable onPress={() => setShowAll(true)} hitSlop={8}>
                    <Text style={[type.button, { color: c.accentText, fontSize: 14 }]}>See all</Text>
                  </Pressable>
                </View>
              ) : null}
              <RoutineGrid programs={shown.programs} art={art} onOpen={setDetail} disabled={busy !== null} />
              <PrimaryButton
                label={busy === 'empty' ? 'Starting…' : 'Start new workout'}
                onPress={() => void startAndFinish('empty', (uid) => startAdHocWorkout(uid))}
                disabled={busy !== null}
                c={c}
                outline
              />
              <Text style={[type.meta, styles.hint, { color: c.text2 }]}>Add exercises as you go</Text>
              <Pressable onPress={() => void onSkip()} disabled={busy !== null} hitSlop={8} style={styles.link}>
                <Text style={[type.meta, { color: c.text2 }]}>Skip</Text>
              </Pressable>
            </ScrollView>
          </View>

        </ScrollView>

        <RoutineDetailSheet
          group={detail}
          onClose={() => setDetail(null)}
          onUse={(g) => void useRoutine(g)}
          busy={busy === 'use'}
        />

        <Modal
          visible={showSignIn}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowSignIn(false)}>
          <SignInScreen
            mode="signIn"
            dismissLabel="Back"
            onDismiss={() => setShowSignIn(false)}
            onDone={(outcome) => {
              setShowSignIn(false);
              if (outcome.ok) complete();
            }}
          />
        </Modal>

        <View style={styles.dots}>
          {Array.from({ length: PAGES - skip }, (_, i) => (
            <View
              key={i}
              style={[styles.dot, { backgroundColor: i === page ? c.accent : c.border }]}
            />
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  c,
  outline,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  c: ReturnType<typeof useColors>;
  outline?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        outline ? { borderWidth: 1.5, borderColor: c.accent } : { backgroundColor: c.accent },
        (pressed || disabled) && styles.pressed,
      ]}>
      <Text style={[type.button, { color: outline ? c.accentText : '#FFFFFF', fontSize: 17 }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { flex: 1, paddingHorizontal: spacing.screen },
  pageFlush: { flex: 1 },
  pageScroll: { gap: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  pageScrollPadded: { paddingHorizontal: spacing.screen },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  logo: { width: 120, height: 120 },
  title: { textAlign: 'center' },
  lead: { textAlign: 'center', maxWidth: 300 },
  actions: { gap: spacing.md, paddingBottom: spacing.xl },
  filter: { gap: spacing.sm, marginTop: spacing.sm },
  matchLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  // Takes the row's width less See all, so a long line wraps instead of
  // running under it.
  matchText: {
    flex: 1,
  },
  button: {
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  link: { alignSelf: 'center', paddingVertical: spacing.sm },
  // Under Start new workout, pulled up against it.
  hint: { textAlign: 'center', marginTop: -spacing.sm },
  targets: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  target: {
    width: 64,
    height: 64,
    borderRadius: radius.bar,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetNumber: { fontSize: 28, fontWeight: '500', ...tabular },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pressed: { opacity: 0.7 },
});
