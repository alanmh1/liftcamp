import { matchHeading, type EquipmentAccess, type TemplateRow, type TrainingLevel } from '@liftcamp/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { RoutineCard } from '@/components/home/routine-card';
import { EquipmentTiles, LevelTiles } from '@/components/home/pref-tiles';
import { useOnboarding } from '@/components/onboarding-provider';
import { SignInScreen } from '@/components/sign-in-screen';
import { Text } from '@/components/text';
import * as home from '@/data/home';
import { startAdHocWorkout } from '@/data/workouts';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, tabular, type } from '@/theme/tokens';

const PAGES = 4;

/**
 * First launch: four pages in a horizontal pager.
 *
 * Page 1 is locked until there is a session, because the later pages write
 * to the database. Once signed in, the remaining pages swipe freely. Page 2
 * is the weekly target, page 3 asks level and equipment, page 4 the start
 * choice, listing the programs those answers match. Every exit from page 4
 * writes the target first, so a user who swiped past page 2 still leaves
 * with one (the default, 3). Level and equipment are written when the
 * "Show N programs" button is pressed; swiping past that page leaves them
 * null, which is the unmatched state existing users are in. `complete()`
 * unmounts this route; the workout a user started on page 4 is then opened
 * by Home's resume-on-launch check, so there is one code path for landing
 * in a workout rather than two racing.
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

  const userId = session?.user.id;

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
  const everything = useMemo(
    () => home.starterPrograms(system, { level: null, equipment: null }),
    [system],
  );
  const match = saved && preview ? preview : everything;
  const shown = showAll ? everything : match;

  function goTo(i: number) {
    pager.current?.scrollTo({ x: i * width, animated: true });
    setPage(i);
  }

  async function onGetStarted() {
    if (busy) return;
    // A session may already exist (an install that predates onboarding).
    // Signing in anonymously again would mint a second user and orphan the
    // first one's workouts, so only sign in when there is nothing to keep.
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

  async function onSkip() {
    if (busy) return;
    setBusy('skip');
    await finish();
    setBusy(null);
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
          {/* 1. Welcome */}
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
              <Pressable onPress={() => setShowSignIn(true)} hitSlop={8} style={styles.link}>
                <Text style={[type.meta, { color: c.accentText }]}>I have an account</Text>
              </Pressable>
              {error ? <Text style={[type.meta, { color: c.danger }]}>{error}</Text> : null}
            </View>
          </View>

          {/* 2. Weekly target */}
          <View style={[styles.page, { width }]}>
            <View style={styles.center}>
              <Text style={[type.screenTitle, styles.title, { color: c.text }]}>
                How many days a week?
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
              <Text style={[type.meta, { color: c.text2 }]}>You can change this in Profile.</Text>
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
                Two answers pick the programs that fit. Both change later in Profile.
              </Text>
              <View style={styles.filter}>
                <Text style={[type.label, { color: c.text3 }]}>Level</Text>
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
                      ? `Show ${preview.programs.length} ${preview.programs.length === 1 ? 'program' : 'programs'}`
                      : 'Show programs'
                }
                onPress={() => void onShowPrograms()}
                disabled={busy !== null || !preview}
                c={c}
              />
            </View>
          </View>

          {/* 4. Pick a start, from the programs the answers match. */}
          <View style={[styles.page, { width }]}>
            <ScrollView contentContainerStyle={styles.pageScroll} showsVerticalScrollIndicator={false}>
              <Text style={[type.screenTitle, { color: c.text }]}>Choose a starter routine</Text>
              <Text style={[type.meta, { color: c.text2 }]}>
                Pick one program and repeat it week to week. The weight going up is the progress.
              </Text>
              {match.matched && !showAll ? (
                <View style={styles.matchLine}>
                  <Text style={[type.meta, { color: c.text2 }]} numberOfLines={2}>
                    {match.exact
                      ? matchHeading(level!, equipment)
                      : `Nothing matches exactly. ${matchHeading(level!, null)}, any equipment.`}
                  </Text>
                  <Pressable onPress={() => setShowAll(true)} hitSlop={8}>
                    <Text style={[type.button, { color: c.accentText, fontSize: 14 }]}>See all</Text>
                  </Pressable>
                </View>
              ) : null}
              <View style={styles.cards}>
                {shown.programs.map((g) => (
                  <View key={g.program} style={styles.program}>
                    <View>
                      <Text style={[type.label, { color: c.text3 }]}>{g.program}</Text>
                      {g.blurb ? <Text style={[type.meta, { color: c.text2 }]}>{g.blurb}</Text> : null}
                    </View>
                    {g.templates.map((t) => (
                      <RoutineCard
                        key={t.id}
                        template={t}
                        primaryLabel="Use"
                        onPrimary={() => void startAndFinish(t.id, (uid) => home.startFromTemplate(uid, t))}
                        busy={busy === t.id}
                        disabled={busy !== null}
                      />
                    ))}
                  </View>
                ))}
              </View>
              <PrimaryButton
                label={busy === 'empty' ? 'Starting…' : 'Start empty workout'}
                onPress={() => void startAndFinish('empty', (uid) => startAdHocWorkout(uid))}
                disabled={busy !== null}
                c={c}
                outline
              />
              <Pressable onPress={() => void onSkip()} disabled={busy !== null} hitSlop={8} style={styles.link}>
                <Text style={[type.meta, { color: c.text2 }]}>Skip</Text>
              </Pressable>
            </ScrollView>
          </View>

        </ScrollView>

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
          {Array.from({ length: PAGES }, (_, i) => (
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
  pageScroll: { gap: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  logo: { width: 120, height: 120 },
  title: { textAlign: 'center' },
  lead: { textAlign: 'center', maxWidth: 300 },
  actions: { gap: spacing.md, paddingBottom: spacing.xl },
  cards: { gap: spacing.lg },
  program: { gap: spacing.sm },
  filter: { gap: spacing.sm, marginTop: spacing.sm },
  matchLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  button: {
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  link: { alignSelf: 'center', paddingVertical: spacing.sm },
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
