import {
  DEFAULT_TRAINING_TIME,
  daysPerWeekLine,
  EQUIPMENT_CHIP_LABELS,
  FALLBACK_IMAGE,
  firstPlannedReminder,
  forkTrainingLevel,
  nextInRotation,
  onboardingDotCount,
  onboardingPages,
  onboardingPathName,
  planMetaLine,
  planSubtitle,
  rankPrograms,
  reminderLine,
  remindButtonLabel,
  routineArtByProgram,
  routineListSections,
  rotationRoutines,
  scheduleSummary,
  TRAINING_TIME_HINTS,
  TRAINING_TIME_LABELS,
  TRAINING_TIMES,
  weeklyTargetForDays,
  type EquipmentAccess,
  type OnboardingFork,
  type OnboardingPage,
  type ProgramGroup,
  type RoutineImageKey,
  type TemplateRow,
  type TrainingLevel,
  type TrainingTime,
} from '@liftcamp/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import * as Notifications from 'expo-notifications';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { useAuth } from '@/components/auth-provider';
import { EquipmentTiles, FORK_ART, preloadRoutineArt } from '@/components/home/pref-tiles';
import { ROUTINE_ART } from '@/components/home/routine-art';
import { RoutineDetailSheet } from '@/components/home/routine-detail';
import { programTintSlots, ProgramTileGrid } from '@/components/home/routine-grid';
import { TintWash } from '@/components/tint-wash';
import { useOnboarding } from '@/components/onboarding-provider';
import { SignInScreen } from '@/components/sign-in-screen';
import { LaunchWordmark } from '@/components/launch-wordmark';
import { Text } from '@/components/text';
import { TipNote } from '@/components/tip-note';
import { DayToggles } from '@/components/training-days';
import * as home from '@/data/home';
import { EVENTS, track } from '@/lib/analytics';
import { getInstallId } from '@/lib/install-id';
import { requestImportOnHome } from '@/lib/import-prompt';
import { NUDGES_DECLINED_KEY, scheduleFirstNudges } from '@/lib/nudges';
import { ensureRestAlertPermission } from '@/lib/rest-alert';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/** The one line a returning user sees in place of the welcome page. */
const RETURNING_LEAD = 'You already use LiftCamp. A couple of quick questions so we can match routines to you.';

/** The fork's two answers. */
const FORK_OPTIONS: { value: OnboardingFork; title: string; line: string; tint: TintToken }[] = [
  {
    value: 'new',
    title: "I'm new to this",
    line: "We'll pick a routine, suggest starting weights and walk you through your first session.",
    tint: 'tintPeach',
  },
  {
    value: 'experienced',
    title: 'I already lift',
    line: 'Bring your history from Hevy, Strong or Fitbod, pick any routine, or just start logging.',
    tint: 'tintMint',
  },
];

/** The art square's flat fill on an OptionCard: one of the six pastels. */
type TintToken = 'tintSky' | 'tintMint' | 'tintPeach' | 'tintLavender' | 'tintButter' | 'tintSand';

/** `onboarding_finished`'s `start`, on the experienced path. */
type StartChoice = 'import' | 'routine' | 'empty' | 'skip';

/** How the schedule page was left: `onboarding_finished`'s `schedule`. */
type ScheduleAnswer = 'days' | 'not_sure';

/** Page 4's filter chips, each on or off. */
type Chips = { equipment: boolean; days: boolean; level: boolean };
const ALL_CHIPS: Chips = { equipment: true, days: true, level: true };

/** Whether permission is still to be asked: iOS, and undetermined (always, in a dev build). */
async function permissionUndetermined(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  // Dev builds always ask: a Simulator's notification permission cannot be
  // reset once answered, so the prompt could not be seen again.
  if (__DEV__) return true;
  try {
    const p = await Notifications.getPermissionsAsync();
    return p.status === Notifications.PermissionStatus.UNDETERMINED;
  } catch {
    return false;
  }
}

async function notificationsGranted(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** The day Home's Next up will offer, for the first-workout nudges' copy. */
async function nextUpDayName(userId: string): Promise<string | null> {
  const mine = await home.getUserTemplates(userId);
  return nextInRotation(rotationRoutines(mine), home.peekUpNextSkips(userId))?.name ?? null;
}

/**
 * First launch (docs/onboarding-fork-spec.md). A horizontal pager whose
 * pages depend on the answers: `onboardingPages` in shared decides which
 * are rendered, so a swipe never lands on a page from the other path, and
 * the dots count the current path.
 *
 *   New lifter:   welcome, fork, schedule, prefs, routines (plan view)
 *   Experienced:  welcome, fork, schedule, start, then Import or Just log
 *                 finish onto Home, and Pick a routine goes on to prefs
 *                 and routines (list view)
 *   Returning:    schedule, prefs, routines (list view). An account with
 *                 finished workouts, which never sees the fork or start.
 *
 * The welcome is locked until there is a session, because the later pages
 * write to the database. The fork's Continue writes `training_level`
 * (beginner or intermediate), which is what marks the account onboarded
 * (onboarding-state in shared). The schedule's button writes the days, the
 * time and the weekly target, then asks for notification permission on
 * iOS; Not sure yet writes no days. Prefs writes the equipment.
 *
 * Skip, on every page after the welcome, finishes onto Home with whatever
 * is answered. A new account that did not pick days on the schedule page
 * leaves through the reminders sheet, as before the fork, while the
 * system has not been asked about notifications; one that picked days has
 * been asked already. `complete()` unmounts this route.
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
  /** The physical page in view. */
  const [page, setPage] = useState(0);
  /** A page asked for that may not be rendered yet; scrolled to once it is. */
  const [want, setWant] = useState<OnboardingPage | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [system, setSystem] = useState<TemplateRow[]>([]);

  // The fork: the card picked, and the answer Continue confirmed. Only the
  // confirmed answer extends the path, so nothing past the fork can be
  // swiped to before Continue.
  const [forkPick, setForkPick] = useState<OnboardingFork | null>(null);
  const [fork, setFork] = useState<OnboardingFork | null>(null);
  /** The start page's Pick a routine, which adds prefs and routines to the experienced path. */
  const [pickRoutine, setPickRoutine] = useState(false);

  // The schedule page.
  const [days, setDays] = useState<number[]>([]);
  const [time, setTime] = useState<TrainingTime>(DEFAULT_TRAINING_TIME);
  const [scheduleAnswer, setScheduleAnswer] = useState<ScheduleAnswer | null>(null);
  const [tipHidden, setTipHidden] = useState(false);
  const [granted, setGranted] = useState(false);
  /** The weekly target as saved: the days' count (clamped), or the default. */
  const [target, setTarget] = useState<number>(home.DEFAULT_WEEKLY_TARGET);

  // Prefs.
  const [equipment, setEquipment] = useState<EquipmentAccess | null>(null);
  /** Equipment written to the profile. Until then page 4 ranks with any equipment. */
  const [saved, setSaved] = useState(false);
  /** A returning user's saved level, which their list ranks on. */
  const [savedLevel, setSavedLevel] = useState<TrainingLevel | null>(null);

  // Page 4.
  /** New lifters' page 4 opens on the plan; See other routines switches to the list. */
  const [planView, setPlanView] = useState<'plan' | 'list'>('plan');
  const [chips, setChips] = useState<Chips>(ALL_CHIPS);
  /** The routine open in the detail sheet. */
  const [detail, setDetail] = useState<ProgramGroup | null>(null);

  const remindersRef = useRef<SheetRef>(null);
  // Set by the reminders sheet's first answer, so a later dismissal or a
  // second tap does nothing.
  const remindersAnswered = useRef(false);

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
      if (cancelled) return;
      setReturning(n > 0);
      if (n === 0) return;
      // A returning account opens on its saved schedule and ranks on its
      // saved level.
      home.getTrainingSchedule(userId).then((s) => {
        if (cancelled) return;
        if (s.days?.length) setDays(s.days);
        if (s.time) setTime(s.time);
      });
      home.getTrainingPrefs(userId).then((p) => {
        if (cancelled) return;
        setSavedLevel(p.level);
        if (p.equipment) setEquipment(p.equipment);
      });
    });
    return () => {
      cancelled = true;
    };
    // Mount only: the session at mount is the one being asked about.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pathArgs = { returning: !!returning, fork, pickRoutine };
  const pages = onboardingPages(pathArgs);
  const dotCount = onboardingDotCount(pathArgs);
  const current = pages[page];

  // Scrolls to the page asked for once it is rendered: a Continue that
  // extends the path asks for a page that exists only after this render.
  useEffect(() => {
    if (!want) return;
    const i = pages.indexOf(want);
    if (i < 0) return;
    setWant(null);
    setPage(i);
    requestAnimationFrame(() => pager.current?.scrollTo({ x: i * width, animated: true }));
  }, [want, pages, width]);

  function goTo(name: OnboardingPage) {
    setWant(name);
  }

  /** The page before this one on the path, for the header's back. Null on the first. */
  function back() {
    const prev = pages[page - 1];
    if (prev) goTo(prev);
  }

  // The funnel's onboarding events (lib/analytics). Each page after the
  // welcome is logged once per mount, the first time it is in view with a
  // session, whether reached by a button or a swipe. The welcome page has
  // no event: the first open and the account's created_at bracket it.
  const logged = useRef(new Set<OnboardingPage>());
  useEffect(() => {
    void getInstallId();
  }, []);
  useEffect(() => {
    if (!userId || returning === null || !current || current === 'welcome') return;
    if (logged.current.has(current)) return;
    logged.current.add(current);
    void getInstallId().then((deviceId) =>
      track(EVENTS.onboardingPage, { page: current, returning, device_id: deviceId }),
    );
  }, [current, userId, returning]);

  useEffect(() => {
    home.getSystemTemplates().then(setSystem);
    // The equipment tiles are a few pages in and the routine cards after
    // them; warming their images now means they draw at once when reached.
    void preloadRoutineArt();
  }, []);

  // Page 4. New lifters rank as beginners; experienced lifters see every
  // level, hidden routines included; returning users rank on their saved
  // level, beginner if none.
  const answeredEquipment = saved ? equipment : null;
  const art = useMemo(() => routineArtByProgram(system), [system]);
  const recommended = useMemo(
    () => rankPrograms(system, { level: 'beginner', equipment: answeredEquipment, days: target })[0],
    [system, answeredEquipment, target],
  );
  const levelChip = !returning && fork === 'new';
  // Only a new lifter has a plan; everyone else gets the list.
  const view = levelChip ? planView : 'list';
  const setView = setPlanView;
  const sections = useMemo(
    () =>
      routineListSections(system, {
        level: levelChip && chips.level ? 'beginner' : null,
        rankLevel: returning ? (savedLevel ?? 'beginner') : null,
        equipment: chips.equipment ? answeredEquipment : null,
        days: chips.days ? target : null,
        keepHidden: !returning && fork === 'experienced',
      }),
    [system, levelChip, chips, returning, savedLevel, answeredEquipment, target, fork],
  );
  // The plan card's tint: the slot its tile takes in the list as it first
  // opens (every chip on), held fixed in every list grid after so the two
  // always agree.
  const planTints = useMemo(() => {
    if (!levelChip || !recommended) return new Map<string, number>();
    const first = routineListSections(system, {
      level: 'beginner',
      equipment: answeredEquipment,
      days: target,
    }).find((sec) => sec.programs.some((g) => g.program === recommended.program));
    const slot = programTintSlots(first?.programs ?? [recommended], art).get(recommended.program) ?? 0;
    return new Map([[recommended.program, slot]]);
  }, [levelChip, recommended, system, answeredEquipment, target, art]);
  const planDays = scheduleAnswer === 'days' ? days : null;
  const firstReminder = planDays && granted ? firstPlannedReminder(planDays, time) : null;

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
    goTo('fork');
  }

  /** A fork card. Picking the other answer forgets the confirmed one, so the old path cannot be swiped to. */
  function pickFork(value: OnboardingFork) {
    setForkPick(value);
    if (value !== fork) {
      setFork(null);
      setPickRoutine(false);
    }
  }

  /** The fork's Continue: the level goes in now, since it marks the account onboarded. */
  async function onForkContinue() {
    if (!userId || !forkPick || busy) return;
    setBusy('fork');
    await home.setTrainingPrefs(userId, { level: forkTrainingLevel(forkPick) });
    setBusy(null);
    setFork(forkPick);
    setPlanView('plan');
    goTo('schedule');
  }

  /** The page after the schedule on this path. */
  const afterSchedule: OnboardingPage = !returning && fork === 'experienced' ? 'start' : 'prefs';

  /**
   * "Remind me …": days, time and target saved, then the system prompt on
   * iOS while it is still to be asked. The next page waits for the answer,
   * so the prompt never sits over a page that moved under it.
   */
  async function onScheduleContinue() {
    if (!userId || days.length === 0 || busy) return;
    setBusy('schedule');
    await home.setTrainingSchedule(userId, { days, time });
    setTarget(weeklyTargetForDays(days.length));
    setScheduleAnswer('days');
    if (await permissionUndetermined()) await ensureRestAlertPermission();
    setGranted(await notificationsGranted());
    setBusy(null);
    goTo(afterSchedule);
  }

  /** "Not sure yet": no days, no time, the target left at its default, no prompt. */
  async function onScheduleNotSure() {
    if (!userId || busy) return;
    setBusy('notSure');
    await home.setTrainingSchedule(userId, { days: [], time: null });
    setScheduleAnswer('not_sure');
    setBusy(null);
    goTo(afterSchedule);
  }

  /**
   * Prefs' Continue: the equipment, then the routines. A returning user
   * has no fork answer, so their level is written here (their saved one,
   * else beginner) to mark the account onboarded.
   */
  async function onPrefsContinue() {
    if (!userId || !equipment || busy) return;
    setBusy('prefs');
    await home.setTrainingPrefs(
      userId,
      returning ? { equipment, level: savedLevel ?? 'beginner' } : { equipment },
    );
    setBusy(null);
    setSaved(true);
    setChips(ALL_CHIPS);
    goTo('routines');
  }

  /**
   * The one way out of onboarding. A new account on iOS that did not pick
   * days goes through the reminders sheet first.
   */
  async function finish(how: 'routine' | 'skip', start: StartChoice | null) {
    if (!userId) return;
    const path = onboardingPathName(!!returning, fork);
    void getInstallId().then((deviceId) =>
      track(EVENTS.onboardingFinished, {
        how,
        returning: !!returning,
        device_id: deviceId,
        path,
        start: path === 'experienced' ? start : null,
        schedule: scheduleAnswer ?? 'skipped',
        days: scheduleAnswer === 'days' ? days.length : null,
      }),
    );
    if (!returning && scheduleAnswer !== 'days' && (await permissionUndetermined())) {
      remindersAnswered.current = false;
      remindersRef.current?.present();
      return;
    }
    complete();
  }

  /** The reminders sheet's answer, then out. A drag down counts as Not now. */
  async function answerReminders(on: boolean) {
    if (remindersAnswered.current) return;
    remindersAnswered.current = true;
    if (on) {
      await ensureRestAlertPermission();
      // In the background: the routine just saved names the nudges, and
      // Home should not wait on that read.
      if (userId) {
        const id = userId;
        void nextUpDayName(id)
          .catch(() => null)
          .then((dayName) => scheduleFirstNudges({ userId: id, dayName }));
      }
    } else {
      await AsyncStorage.setItem(NUDGES_DECLINED_KEY, new Date().toISOString()).catch(() => {});
    }
    remindersRef.current?.dismiss();
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
    await finish('routine', 'routine');
    setBusy(null);
  }

  /** Skip, the same on every page: finish onto Home with what is answered so far. */
  async function onSkip() {
    if (busy) return;
    setBusy('skip');
    await finish('skip', 'skip');
    setBusy(null);
  }

  /** Finish onto Home with no routine, as the start page's import tiles and Just log do. */
  async function finishWith(start: 'import' | 'empty') {
    if (busy || !userId) return;
    // Home opens /import once it mounts (lib/import-prompt), since the
    // route is not reachable until `complete()` has run.
    if (start === 'import') requestImportOnHome();
    setBusy(start);
    await finish('skip', start);
    setBusy(null);
  }

  /** Plan view's import link: the same as an import tile. */
  function onImport() {
    void finishWith('import');
  }

  if (returning === null) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator />
      </View>
    );
  }

  const header = (onBack: (() => void) | null) => (
    <StepHeader onBack={onBack} onSkip={() => void onSkip()} disabled={busy !== null} c={c} />
  );
  // The header's back on the page at `name`: none on the first page.
  const backFor = (name: OnboardingPage) => (pages.indexOf(name) > 0 ? back : null);

  function renderPage(name: OnboardingPage) {
    switch (name) {
      case 'welcome':
        return (
          <View key={name} style={[styles.page, { width }]}>
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
        );

      case 'fork':
        return (
          <View key={name} style={[styles.page, { width }]}>
            {header(backFor(name))}
            <ScrollView contentContainerStyle={styles.pageScroll} showsVerticalScrollIndicator={false}>
              <Text style={[type.screenTitle, { color: c.text }]}>Have you lifted before?</Text>
              <Text style={[type.meta, { color: c.text2 }]}>
                We'll set things up differently depending on your answer.
              </Text>
              <View style={styles.optionCards}>
                {FORK_OPTIONS.map((o) => (
                  <OptionCard
                    key={o.value}
                    art={FORK_ART[o.value]}
                    tint={o.tint}
                    title={o.title}
                    line={o.line}
                    selected={forkPick === o.value}
                    onPress={() => pickFork(o.value)}
                    c={c}
                  />
                ))}
              </View>
            </ScrollView>
            <View style={styles.actions}>
              <PrimaryButton
                label={busy === 'fork' ? 'Saving…' : 'Continue'}
                onPress={() => void onForkContinue()}
                disabled={busy !== null || !forkPick}
                c={c}
              />
            </View>
          </View>
        );

      case 'schedule':
        return (
          <View key={name} style={[styles.page, { width }]}>
            {header(backFor(name))}
            <ScrollView contentContainerStyle={styles.pageScroll} showsVerticalScrollIndicator={false}>
              {returning ? <Text style={[type.meta, { color: c.text2 }]}>{RETURNING_LEAD}</Text> : null}
              <Text style={[type.screenTitle, { color: c.text }]}>When do you usually train?</Text>
              <Text style={[type.meta, { color: c.text2 }]}>
                We'll send one reminder on those days. Change it anytime in Settings.
              </Text>
              <View style={styles.filter}>
                <Text style={[type.label, { color: c.text3 }]}>Days</Text>
                <DayToggles days={days} onChange={setDays} disabled={busy !== null} />
                <Text style={[type.meta, { color: c.text2 }]}>{daysPerWeekLine(days.length)}</Text>
              </View>
              <View style={styles.filter}>
                <Text style={[type.label, { color: c.text3 }]}>Around what time?</Text>
                <View style={styles.segments}>
                  {TRAINING_TIMES.map((t) => {
                    const selected = time === t;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => setTime(t)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${TRAINING_TIME_LABELS[t]}, ${TRAINING_TIME_HINTS[t]}`}
                        style={({ pressed }) => [
                          styles.option,
                          styles.segment,
                          {
                            backgroundColor: selected ? c.accentSoft : c.surface2,
                            borderColor: selected ? c.accent : 'transparent',
                          },
                          pressed && styles.pressed,
                        ]}>
                        <Text style={[type.button, { color: selected ? c.accentText : c.text }]}>
                          {TRAINING_TIME_LABELS[t]}
                        </Text>
                        <Text style={[type.meta, { color: c.text2 }]}>{TRAINING_TIME_HINTS[t]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              {tipHidden ? null : (
                <TipNote onDismiss={() => setTipHidden(true)}>
                  Starting out, two or three days a week is plenty. You can add more later.
                </TipNote>
              )}
            </ScrollView>
            <View style={styles.actions}>
              <PrimaryButton
                label={busy === 'schedule' ? 'Saving…' : remindButtonLabel(days)}
                onPress={() => void onScheduleContinue()}
                disabled={busy !== null || days.length === 0}
                c={c}
              />
              <TextButton label="Not sure yet" onPress={() => void onScheduleNotSure()} disabled={busy !== null} c={c} />
            </View>
          </View>
        );

      case 'start':
        return (
          <View key={name} style={[styles.page, { width }]}>
            {header(backFor(name))}
            <ScrollView contentContainerStyle={styles.pageScroll} showsVerticalScrollIndicator={false}>
              <Text style={[type.screenTitle, { color: c.text }]}>How do you want to start?</Text>
              <Text style={[type.meta, { color: c.text2 }]}>You can do the others later.</Text>
              <View style={styles.optionCards}>
                {/* Art for import until its own clay art comes in: the dumbbells. */}
                <OptionCard
                  art={ROUTINE_ART.dumbbells}
                  tint="tintButter"
                  title="Import your workouts"
                  line="From Hevy, Strong or Fitbod. Your workouts, PRs and streak medals come with you."
                  onPress={() => void finishWith('import')}
                  disabled={busy !== null}
                  c={c}
                />
                <OptionCard
                  art={ROUTINE_ART['adjustable-bench']}
                  tint="tintSky"
                  title="Pick a routine"
                  line="Every routine, including intermediate and advanced"
                  onPress={() => {
                    setPickRoutine(true);
                    goTo('prefs');
                  }}
                  disabled={busy !== null}
                  c={c}
                />
                <OptionCard
                  art={ROUTINE_ART['light-dumbbells']}
                  tint="tintLavender"
                  title="Just log my own workout"
                  line="Start empty, save it as a routine after"
                  onPress={() => void finishWith('empty')}
                  disabled={busy !== null}
                  c={c}
                />
              </View>
            </ScrollView>
          </View>
        );

      case 'prefs':
        return (
          <View key={name} style={[styles.page, { width }]}>
            {header(backFor(name))}
            <ScrollView contentContainerStyle={styles.pageScroll} showsVerticalScrollIndicator={false}>
              <Text style={[type.screenTitle, { color: c.text }]}>Where do you train?</Text>
              <Text style={[type.meta, { color: c.text2 }]}>We'll match routines to what you can train with.</Text>
              <View style={styles.filter}>
                <EquipmentTiles value={equipment} onChange={(v) => setEquipment(v ?? equipment)} />
              </View>
            </ScrollView>
            <View style={styles.actions}>
              <PrimaryButton
                label={busy === 'prefs' ? 'Saving…' : 'Continue'}
                onPress={() => void onPrefsContinue()}
                disabled={busy !== null || !equipment}
                c={c}
              />
            </View>
          </View>
        );

      case 'routines':
        return (
          <View key={name} style={[styles.pageFlush, { width }]}>
            {/* Side padding on the scroll content rather than the frame, so
                the routine cards' shadows are not clipped at the edges. */}
            <View style={styles.padded}>
              {header(view === 'list' && levelChip ? () => setView('plan') : backFor(name))}
            </View>
            {view === 'plan' ? (
              <>
                <ScrollView contentContainerStyle={[styles.pageScroll, styles.padded]} showsVerticalScrollIndicator={false}>
                  <Text style={[type.screenTitle, { color: c.text }]}>Here's your plan</Text>
                  <Text style={[type.meta, { color: c.text2 }]}>{planSubtitle(target, answeredEquipment)}</Text>
                  {recommended ? (
                    <PlanCard
                      group={recommended}
                      image={art.get(recommended.program) ?? FALLBACK_IMAGE}
                      tint={planTints.get(recommended.program) ?? 0}
                      meta={planMetaLine(recommended, scheduleSummary(planDays))}
                      reminder={firstReminder ? reminderLine(firstReminder, time) : null}
                      onPress={() => setDetail(recommended)}
                      disabled={busy !== null}
                    />
                  ) : null}
                  <ImportRow onPress={onImport} disabled={busy !== null} c={c} />
                </ScrollView>
                <View style={[styles.actions, styles.padded]}>
                  <PrimaryButton
                    label={busy === 'use' && !detail ? 'Saving…' : 'Use this plan'}
                    onPress={() => recommended && void useRoutine(recommended)}
                    disabled={busy !== null || !recommended}
                    c={c}
                  />
                  <SecondaryButton label="See other routines" onPress={() => setView('list')} disabled={busy !== null} c={c} />
                </View>
              </>
            ) : (
              <ScrollView contentContainerStyle={[styles.pageScroll, styles.padded]} showsVerticalScrollIndicator={false}>
                <Text style={[type.screenTitle, { color: c.text }]}>Pick a routine</Text>
                <Text style={[type.meta, { color: c.text2 }]}>Filtered to what you told us. Tap a filter to change it.</Text>
                <View style={styles.chips}>
                  {answeredEquipment ? (
                    <FilterChip
                      label={EQUIPMENT_CHIP_LABELS[answeredEquipment]}
                      on={chips.equipment}
                      onPress={() => setChips((x) => ({ ...x, equipment: !x.equipment }))}
                      c={c}
                    />
                  ) : null}
                  <FilterChip
                    label={`${target} days`}
                    on={chips.days}
                    onPress={() => setChips((x) => ({ ...x, days: !x.days }))}
                    c={c}
                  />
                  {levelChip ? (
                    <FilterChip
                      label="Beginner"
                      on={chips.level}
                      onPress={() => setChips((x) => ({ ...x, level: !x.level }))}
                      c={c}
                    />
                  ) : null}
                </View>
                {sections.length === 0 ? (
                  <Text style={[type.meta, { color: c.text2 }]}>Nothing matches every filter. Tap one to turn it off.</Text>
                ) : (
                  sections.map((s) => (
                    <View key={s.title} style={styles.section}>
                      <Text style={[type.label, { color: c.text3 }]}>{s.title}</Text>
                      <ProgramTileGrid
                        programs={s.programs}
                        art={art}
                        onOpen={setDetail}
                        disabled={busy !== null}
                        badges={levelChip && recommended ? { [recommended.program]: 'Your plan' } : undefined}
                        fixedTints={planTints}
                      />
                    </View>
                  ))
                )}
                <Pressable
                  onPress={() => setChips({ equipment: false, days: false, level: false })}
                  disabled={busy !== null}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.outline, { borderColor: c.border }, pressed && styles.pressed]}>
                  <Text style={[type.button, { color: c.text }]}>Browse all routines</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        );
    }
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
          {pages.map(renderPage)}
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
              if (!outcome.ok) return;
              // A new guest goes through onboarding like Get started; an
              // account that signed in has nothing left to set up.
              if (outcome.guest) goTo('fork');
              else complete();
            }}
          />
        </Modal>

        <Sheet ref={remindersRef} onDismiss={() => void answerReminders(false)}>
          <View style={styles.reminders}>
            <Text style={[type.screenTitle, { color: c.text }]} accessibilityRole="header">
              Turn on reminders?
            </Text>
            <Text style={[type.meta, styles.remindersLead, { color: c.text2 }]}>
              A nudge for your first session, and a buzz when a rest timer ends.
            </Text>
            <View style={styles.remindersActions}>
              <PrimaryButton label="Turn on" onPress={() => void answerReminders(true)} c={c} />
              <TextButton label="Not now" onPress={() => void answerReminders(false)} c={c} />
            </View>
          </View>
        </Sheet>

        <View style={styles.dots}>
          {Array.from({ length: dotCount }, (_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === page ? c.accent : c.border }]} />
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

/**
 * Plan view's one card, in the grid tiles' style (ProgramGridTile): the
 * art on its pastel wash, a 1 pt border line, then a `surface` band with the
 * eyebrow, name, meta line and check rows. Tapping it opens the routine
 * detail.
 */
function PlanCard({
  group,
  image,
  meta,
  tint,
  reminder,
  onPress,
  disabled,
}: {
  group: ProgramGroup;
  image: RoutineImageKey;
  meta: string;
  /** The art area's tint slot, the same as its tile in the list. */
  tint: number;
  /** "Reminder Wednesday evening", or null for no row. */
  reminder: string | null;
  onPress: () => void;
  disabled: boolean;
}) {
  const c = useColors();
  const checks = [
    'Starting weights suggested for every lift',
    'How-to for each exercise, in the workout',
    ...(reminder ? [reminder] : []),
  ];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Best match, ${group.program}, ${meta}`}
      style={({ pressed }) => [
        styles.planCard,
        { backgroundColor: c.surface, borderColor: c.border },
        pressed && styles.tilePressed,
      ]}>
      <View style={styles.planArt}>
        <TintWash slot={tint} />
        <Image
          source={ROUTINE_ART[image]}
          style={styles.planImage}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={150}
          accessibilityIgnoresInvertColors
        />
      </View>
      <View style={[styles.planBand, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <Text style={[type.label, { color: c.accentText }]}>Best match</Text>
        <Text style={[type.exerciseName, { color: c.text }]}>{group.program}</Text>
        {meta ? <Text style={[type.meta, styles.tabular, { color: c.text2 }]}>{meta}</Text> : null}
        <View style={styles.checks}>
          {checks.map((line) => (
            <View key={line} style={styles.check}>
              <SymbolView
                name={{ ios: 'checkmark', android: 'check' }}
                size={14}
                weight="bold"
                tintColor={c.success}
                fallback={<Text style={{ color: c.success }}>✓</Text>}
              />
              <Text style={[type.meta, styles.checkText, { color: c.text }]}>{line}</Text>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Plan view's import row, a card in the grid tiles' border and radius: the
 * import symbol in the accent, the title and subtitle, a chevron. Opens
 * /import over Home, as the start page's tiles do.
 */
function ImportRow({ onPress, disabled, c }: { onPress: () => void; disabled: boolean; c: ReturnType<typeof useColors> }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Switching from another app? Import from Fitbod, Strong or Hevy"
      style={({ pressed }) => [
        styles.importRow,
        { backgroundColor: c.surface, borderColor: c.border },
        pressed && styles.tilePressed,
      ]}>
      <SymbolView
        name={{ ios: 'square.and.arrow.down', android: 'file_download' }}
        size={22}
        weight="semibold"
        tintColor={c.accent}
        fallback={<Text style={[type.button, { color: c.accent }]}>↓</Text>}
      />
      <View style={styles.forkText}>
        <Text style={[type.button, { color: c.text }]}>Switching from another app?</Text>
        <Text style={[type.meta, { color: c.text2 }]}>Import from Fitbod, Strong or Hevy</Text>
      </View>
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right' }}
        size={14}
        weight="semibold"
        tintColor={c.text3}
        fallback={<Text style={[styles.chevron, { color: c.text3 }]}>›</Text>}
      />
    </Pressable>
  );
}

/** A list-view filter: filled when on, outlined with "+ " when off. */
function FilterChip({
  label,
  on,
  onPress,
  c,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  c: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        on ? { backgroundColor: c.text, borderColor: c.text } : { borderColor: c.border },
        pressed && styles.pressed,
      ]}>
      <Text style={[type.meta, styles.chipText, { color: on ? c.bg : c.text }]}>{on ? label : `+ ${label}`}</Text>
    </Pressable>
  );
}

/**
 * A compact option: a 72 pt art square on a flat pastel, then the title
 * and a line, on a surface card with a 2 pt border. With `selected` it is
 * a radio (the fork): the border turns accent and a soft accent shadow
 * comes up, the width never changes so nothing shifts. Without it, a
 * plain button with a chevron (the start page).
 */
function OptionCard({
  art,
  tint,
  title,
  line,
  selected,
  onPress,
  disabled = false,
  c,
}: {
  art: number;
  tint: TintToken;
  title: string;
  line: string;
  /** A radio's state. Left out, the card is a button with a chevron. */
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
  c: ReturnType<typeof useColors>;
}) {
  const radio = selected !== undefined;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={radio ? 'radio' : 'button'}
      accessibilityState={radio ? { selected } : undefined}
      accessibilityLabel={`${title}. ${line}`}
      style={({ pressed }) => [
        styles.optionCard,
        { backgroundColor: c.surface, borderColor: selected ? c.accent : c.border },
        selected && [styles.optionSelected, { shadowColor: c.accent }],
        pressed && styles.pressed,
      ]}>
      <View style={[styles.optionArt, { backgroundColor: c[tint] }]}>
        <Image
          source={art}
          style={styles.optionImage}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={150}
          accessibilityIgnoresInvertColors
        />
      </View>
      <View style={styles.forkText}>
        <Text style={[type.exerciseName, { color: c.text }]}>{title}</Text>
        <Text style={[type.meta, { color: c.text2 }]}>{line}</Text>
      </View>
      {radio ? null : (
        <SymbolView
          name={{ ios: 'chevron.right', android: 'chevron_right' }}
          size={14}
          weight="semibold"
          tintColor={c.text3}
          fallback={<Text style={[styles.chevron, { color: c.text3 }]}>›</Text>}
        />
      )}
    </Pressable>
  );
}

/**
 * The header on every page after the welcome: back on the left (absent on
 * the first page, keeping its space so Skip does not move), Skip on the
 * right. Both are 44 pt targets.
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
            name={{ ios: 'chevron.left', android: 'chevron_left' }}
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

/** PrimaryButton's size and radius on a `surface` fill with a border: See other routines. */
function SecondaryButton({
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
      style={({ pressed }) => [
        styles.button,
        styles.secondary,
        { backgroundColor: c.surface, borderColor: c.border },
        (pressed || disabled) && styles.pressed,
      ]}>
      <Text style={[type.button, { color: c.text, fontSize: 17 }]}>{label}</Text>
    </Pressable>
  );
}

/** A 44 pt text button in the accent: Not sure yet, See other routines, Not now. */
function TextButton({
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
      style={({ pressed }) => [styles.textButton, (pressed || disabled) && styles.pressed]}>
      <Text style={[type.button, { color: c.accentText }]}>{label}</Text>
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
  actions: { gap: spacing.xs, paddingTop: spacing.sm, paddingBottom: spacing.sm },
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
  button: {
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  // A 44 pt target for a text button.
  textButton: { height: 44, alignItems: 'center', justifyContent: 'center' },
  link: { alignSelf: 'center', paddingVertical: spacing.sm },
  reminders: { gap: spacing.sm, paddingTop: spacing.sm },
  remindersLead: { fontSize: 15, lineHeight: 22 },
  remindersActions: { gap: spacing.xs, paddingTop: spacing.md },
  // The time segments, in the selected style the weekly target rows
  // used: accentSoft and an accent border when selected.
  option: { borderRadius: radius.bar, borderWidth: 1.5 },
  optionCards: { gap: 14, marginTop: spacing.sm },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 2,
  },
  optionSelected: Platform.select({
    ios: { shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
    default: { elevation: 2 },
  }),
  optionArt: { width: 72, height: 72, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  optionImage: { width: 68, height: 68 },
  forkText: { flex: 1, gap: 2 },
  segments: { flexDirection: 'row', gap: spacing.sm },
  segment: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, gap: 2 },
  // The grid tiles' shape (ProgramGridTile): 1 pt border, card radius, no shadow.
  planCard: { borderRadius: radius.card, borderWidth: 1, overflow: 'hidden', marginTop: spacing.sm },
  planArt: { height: 160, alignItems: 'center', justifyContent: 'center' },
  planImage: { width: 136, height: 136 },
  planBand: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 4,
  },
  importRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    borderRadius: radius.card,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  secondary: { borderWidth: 1.5 },
  // The grid tiles' press: a slight dim and shrink.
  tilePressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  tabular: { fontVariant: ['tabular-nums'] },
  checks: { gap: spacing.xs, marginTop: spacing.sm },
  check: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkText: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  chipText: { fontWeight: '600' },
  section: { gap: spacing.sm, marginTop: spacing.sm },
  outline: {
    borderRadius: radius.bar,
    borderWidth: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
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
