import {
  matchHeading,
  programMatches,
  rankPrograms,
  ROUTINE_SHORTLIST,
  routineArtByProgram,
  type EquipmentAccess,
  type ProgramGroup,
  type TemplateRow,
  type TrainingLevel,
} from '@liftcamp/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import { EquipmentTiles, LevelTiles, preloadRoutineArt } from '@/components/home/pref-tiles';
import { RoutineDetailSheet } from '@/components/home/routine-detail';
import { RoutineGrid } from '@/components/home/routine-grid';
import { useOnboarding } from '@/components/onboarding-provider';
import { SignInScreen } from '@/components/sign-in-screen';
import { LaunchWordmark } from '@/components/launch-wordmark';
import { Text } from '@/components/text';
import * as home from '@/data/home';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, tabular, type } from '@/theme/tokens';

const PAGES = 4;

/** One line under each days option. */
const DAYS_HINTS: Record<number, string> = {
  2: 'Full body twice a week. Easiest to fit in.',
  3: 'Enough to progress, easy to keep up.',
  4: 'Upper and lower body on separate days.',
  5: 'More volume, for when training is a priority.',
};
/** The option badged Recommended: the default answer. */
const RECOMMENDED_DAYS = home.DEFAULT_WEEKLY_TARGET;

/** The one line a returning user sees in place of the welcome page. */
const RETURNING_LEAD = 'You already use LiftCamp. A couple of quick questions so we can match routines to you.';

/**
 * First launch: four pages in a horizontal pager.
 *
 * Page 1, the welcome, is locked until there is a session, because the
 * later pages write to the database. Once signed in, the remaining pages
 * swipe freely. Every page after the welcome has the same shape: a header
 * with a back chevron and Skip, the title and subtitle top-left, the
 * page's content, and its primary button pinned at the bottom above the
 * progress dots.
 *
 * Page 2 is the weekly target, page 3 asks level and equipment, page 4
 * ranks the routines on all three answers (see `rankPrograms` in shared):
 * the best three, the first marked Recommended, and See all for the rest.
 * A tile opens the routine detail, whose "Use routine" saves the routine
 * as the user's own and completes onboarding onto Home; the page's own
 * button does the same for the recommended routine. Skip, on any page,
 * completes onboarding onto Home with no routine. Every exit writes the
 * target first, so a user who skipped page 2 still leaves with one (the
 * default, 3). Level and equipment are written when page 3's button is
 * pressed; skipping or swiping past it leaves them null, which is the
 * unmatched state existing users are in. `complete()` unmounts this route.
 *
 * A returning user, one whose account has finished workouts, is not
 * welcomed. Onboarding runs per account, and most accounts predate the
 * level and equipment question, so they arrive here signed in with a
 * history. For them the welcome page is not rendered at all: the pager
 * opens on the weekly target, with no back chevron and a line that says
 * why they are being asked, and three dots instead of four.
 */
export default function OnboardingScreen() {
  const { session, signInAnonymously, error } = useAuth();
  const { complete, clearNotice } = useOnboarding();
  const c = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ notice?: string }>();

  // Set by the root after an account deletion. Shown once over the welcome
  // page, then cleared from the route and the provider so it never repeats.
  useEffect(() => {
    if (params.notice !== 'deleted') return;
    Alert.alert('Your account and all your workouts have been deleted.', undefined, [{ text: 'OK' }]);
    router.setParams({ notice: undefined });
    clearNotice();
  }, [params.notice, router, clearNotice]);
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
  /** Both answers written to the profile. Until then page 4 ranks as a beginner. */
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
    // The level and equipment tiles are two pages in and the routine cards
    // three; warming their images now means they draw at once when reached.
    void preloadRoutineArt();
  }, []);

  // Page 4 ranks on the saved answers. Until page 3's button is pressed it
  // ranks as a beginner with any equipment, the same default as Home's
  // starter list, still using the days answer.
  const answers = useMemo(
    () => ({ level: saved ? level : null, equipment: saved ? equipment : null, days: target }),
    [saved, level, equipment, target],
  );
  const ranked = useMemo(() => rankPrograms(system, answers), [system, answers]);
  const recommended = ranked[0];
  const shown = showAll ? ranked : ranked.slice(0, ROUTINE_SHORTLIST);
  const art = useMemo(() => routineArtByProgram(system), [system]);
  // The heading names this level, so cards of it leave the level off. See
  // all's heading names none.
  const headingLevel = showAll ? null : (answers.level ?? 'beginner');

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

  /** Skip, the same on every page: finish onto Home with what is answered so far. */
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

  const heading = !saved
    ? 'Beginner routines to start with.'
    : programMatches(recommended, { level, equipment })
      ? `${matchHeading(level!, equipment)}.`
      : programMatches(recommended, { level, equipment: null })
        ? `Nothing matches exactly. ${matchHeading(level!, null)}, any equipment.`
        : 'Nothing matches exactly. These are the nearest.';

  const header = (onBack: (() => void) | null) => (
    <StepHeader onBack={onBack} onSkip={() => void onSkip()} disabled={busy !== null} c={c} />
  );

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
              <LaunchWordmark />
              {/* One sentence per line, broken by hand, so the two sit
                  balanced inside the 300 pt cap on every iPhone rather
                  than wrapping by width. */}
              <Text style={[type.meta, styles.lead, { color: c.text2 }]}>
                {'Try your first workout free.\nNo account needed to start.'}
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

          {/* 2. Weekly target. For a returning user this is the first page:
              no back, and the line above the question says why they are
              here. */}
          <View style={[styles.page, { width }]}>
            {header(returning ? null : () => goTo(0))}
            <ScrollView contentContainerStyle={styles.pageScroll} showsVerticalScrollIndicator={false}>
              {returning ? (
                <Text style={[type.meta, { color: c.text2 }]}>{RETURNING_LEAD}</Text>
              ) : null}
              <Text style={[type.screenTitle, { color: c.text }]}>How many days a week can you train?</Text>
              <Text style={[type.meta, { color: c.text2 }]}>You can change this in Settings.</Text>
              <View style={styles.targets}>
                {home.WEEKLY_TARGET_OPTIONS.map((n) => {
                  const selected = target === n;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => setTarget(n)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${n} days. ${DAYS_HINTS[n] ?? ''}${n === RECOMMENDED_DAYS ? ' Recommended.' : ''}`}
                      style={({ pressed }) => [
                        styles.target,
                        {
                          backgroundColor: selected ? c.accentSoft : c.surface2,
                          borderColor: selected ? c.accent : 'transparent',
                        },
                        pressed && styles.pressed,
                      ]}>
                      <View style={styles.targetHead}>
                        <Text style={[type.exerciseName, tabular, { color: selected ? c.accentText : c.text }]}>
                          {n} days
                        </Text>
                        {n === RECOMMENDED_DAYS ? (
                          <View style={[styles.badge, { backgroundColor: c.accent }]}>
                            <Text style={[type.meta, styles.badgeText]}>Recommended</Text>
                          </View>
                        ) : null}
                      </View>
                      {DAYS_HINTS[n] ? (
                        <Text style={[type.meta, { color: c.text2 }]}>{DAYS_HINTS[n]}</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <View style={styles.actions}>
              <PrimaryButton label="Continue" onPress={() => goTo(2)} disabled={busy !== null} c={c} />
            </View>
          </View>

          {/* 3. Level and equipment, in the shape of a filter sheet: both
              rows on one screen. The button is enabled once both are
              answered. */}
          <View style={[styles.page, { width }]}>
            {header(() => goTo(1))}
            <ScrollView contentContainerStyle={styles.pageScroll} showsVerticalScrollIndicator={false}>
              <Text style={[type.screenTitle, { color: c.text }]}>What are you working with?</Text>
              <Text style={[type.meta, { color: c.text2 }]}>
                We'll recommend routines based on your experience and what you can train with.
              </Text>
              <View style={styles.filter}>
                <Text style={[type.label, { color: c.text3 }]}>Experience</Text>
                <LevelTiles value={level} onChange={(v) => setLevel(v ?? level)} hints />
              </View>
              <View style={styles.filter}>
                <Text style={[type.label, { color: c.text3 }]}>Equipment</Text>
                <EquipmentTiles value={equipment} onChange={(v) => setEquipment(v ?? equipment)} />
              </View>
            </ScrollView>
            <View style={styles.actions}>
              <PrimaryButton
                label={busy === 'prefs' ? 'Saving…' : 'Continue'}
                onPress={() => void onShowPrograms()}
                disabled={busy !== null || !level || !equipment}
                c={c}
              />
            </View>
          </View>

          {/* 4. The routines the answers rank highest. This page keeps its
              side padding on the scroll content rather than the frame, so
              the routine cards' shadows are not clipped at the scroll
              view's edges. */}
          <View style={[styles.pageFlush, { width }]}>
            <View style={styles.padded}>{header(() => goTo(2))}</View>
            <ScrollView contentContainerStyle={[styles.pageScroll, styles.padded]} showsVerticalScrollIndicator={false}>
              <Text style={[type.screenTitle, { color: c.text }]}>Choose a starter routine</Text>
              <Text style={[type.meta, { color: c.text2 }]}>
                Pick one routine and repeat it week to week. The weight going up is the progress.
              </Text>
              <View style={styles.matchLine}>
                <Text style={[type.meta, styles.matchText, { color: c.text2 }]} numberOfLines={3}>
                  {showAll ? 'Every routine, best fit first.' : heading}
                </Text>
                {!showAll && ranked.length > shown.length ? (
                  <Pressable onPress={() => setShowAll(true)} hitSlop={8}>
                    <Text style={[type.button, { color: c.accentText, fontSize: 14 }]}>See all</Text>
                  </Pressable>
                ) : null}
              </View>
              <RoutineGrid
                programs={shown}
                art={art}
                onOpen={setDetail}
                disabled={busy !== null}
                namedLevel={headingLevel}
                recommended={recommended?.program}
              />
            </ScrollView>
            <View style={[styles.actions, styles.padded]}>
              <PrimaryButton
                label={busy === 'use' && !detail ? 'Saving…' : 'Use recommended routine'}
                onPress={() => recommended && void useRoutine(recommended)}
                disabled={busy !== null || !recommended}
                c={c}
              />
            </View>
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

/**
 * The header on every page after the welcome: back on the left (absent on
 * a returning user's first page, keeping its space so Skip does not move),
 * Skip on the right. Both are 44 pt targets.
 */
function StepHeader({
  onBack,
  onSkip,
  disabled,
  c,
}: {
  onBack: (() => void) | null;
  onSkip: () => void;
  disabled: boolean;
  c: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.headerButton, styles.back, pressed && styles.pressed]}>
          <SymbolView
            name="chevron.left"
            size={20}
            weight="semibold"
            tintColor={c.text}
            fallback={<Text style={[styles.chevron, { color: c.text }]}>‹</Text>}
          />
        </Pressable>
      ) : (
        <View style={styles.headerButton} />
      )}
      <Pressable
        onPress={onSkip}
        disabled={disabled}
        accessibilityRole="button"
        style={({ pressed }) => [styles.headerButton, styles.skip, pressed && styles.pressed]}>
        <Text style={[type.button, { color: c.text2 }]}>Skip</Text>
      </Pressable>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  c,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  c: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, { backgroundColor: c.accent }, (pressed || disabled) && styles.pressed]}>
      <Text style={[type.button, { color: '#FFFFFF', fontSize: 17 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { flex: 1, paddingHorizontal: spacing.screen },
  pageFlush: { flex: 1 },
  padded: { paddingHorizontal: spacing.screen },
  pageScroll: { gap: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  lead: { textAlign: 'center', maxWidth: 300 },
  actions: { gap: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  headerButton: { minWidth: 44, height: 44, justifyContent: 'center' },
  // Pulled out by the gap between the glyph and the target's edge, so the
  // chevron and Skip sit on the page's text edges.
  back: { marginLeft: -spacing.sm, paddingLeft: spacing.sm },
  skip: { alignItems: 'flex-end' },
  chevron: { fontSize: 28, lineHeight: 30 },
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
  // Full-width rows, one per option, in the tiles' selected style.
  targets: { gap: spacing.sm, marginTop: spacing.sm },
  target: {
    borderRadius: radius.bar,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 2,
  },
  targetHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { color: '#FFFFFF', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pressed: { opacity: 0.7 },
});
