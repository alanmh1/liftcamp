import {
  routineArtByProgram,
  setupTasks,
  templateLevelLabel,
  type SetupTaskKey,
  type TemplateRow,
} from '@liftcamp/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import type { SheetRef } from '@/components/BottomSheet';
import { useAuth } from '@/components/auth-provider';
import { useWeightUnit } from '@/components/unit-provider';
import { LastWorkoutCard } from '@/components/home/last-workout-card';
import { ResumeCard } from '@/components/home/resume-card';
import { RoutineCard } from '@/components/home/routine-card';
import { RenameSheet, RoutineMenuSheet, type RoutineAction } from '@/components/home/routine-menu-sheet';
import { SetupChecklist } from '@/components/home/setup-checklist';
import { StarterRoutines } from '@/components/home/starter-routines';
import { WeekStrip } from '@/components/home/week-strip';
import { Text } from '@/components/text';
import * as home from '@/data/home';
import type { HomeTemplate, InProgressWorkout, LastWorkout } from '@/data/home';
import { startAdHocWorkout } from '@/data/workouts';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

type HomeData = {
  target: number;
  weekDates: string[];
  inProgress: InProgressWorkout | null;
  finishedCount: number;
  last: LastWorkout | null;
  mine: HomeTemplate[];
  /** All system routines; `starterPrograms` picks from them with the prefs. */
  system: TemplateRow[];
  prefs: home.TrainingPrefs;
  /** The checklist's profile fields. Anonymity comes from the session. */
  sex: string | null;
  bodyweight: number | null;
  invitedFriendAt: string | null;
  setupHiddenAt: string | null;
};

const INVITE_URL = 'https://liftcamp.app';
const INVITE_MESSAGE = `I'm tracking my lifting with LiftCamp. It's free and it's built for people just starting out. ${INVITE_URL}`;

/**
 * Relaunching mid-workout opens the workout, not Home. Module-level so it
 * fires once per app process rather than once per Home mount, and keyed by
 * user so a session switch mid-process behaves like a launch for the new
 * user rather than inheriting the old one's flag.
 */
const autoResumedFor = new Set<string>();

function firstName(meta: Record<string, unknown> | undefined): string | null {
  const raw = meta?.full_name ?? meta?.name ?? meta?.given_name;
  if (typeof raw !== 'string') return null;
  const first = raw.trim().split(/\s+/)[0];
  return first && first.length <= 24 ? first : null;
}

export default function HomeScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const c = useColors();
  const userId = session?.user.id;

  const [data, setData] = useState<HomeData | null>(null);
  // One key for anything that starts a workout: a routine id, 'empty', or
  // 'repeat'. Any non-null value disables every other start control on the
  // screen.
  const [busy, setBusy] = useState<string | null>(null);
  const [undo, setUndo] = useState<InProgressWorkout | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const menuRef = useRef<SheetRef>(null);
  const renameRef = useRef<SheetRef>(null);
  const [menuTemplate, setMenuTemplate] = useState<HomeTemplate | null>(null);

  // Task 2 scrolls here, to the top of Routines.
  const scrollRef = useRef<ScrollView>(null);
  const routinesY = useRef(0);
  // Whether the checklist was showing unfinished after the previous load,
  // and whether this visit is the one where it finished. The done state is
  // for that visit only: it clears on blur, and the next load finds the
  // card no longer visible.
  const setupWasOpen = useRef(false);
  const [setupFinished, setSetupFinished] = useState(false);

  const { label: unit, unit: weightUnit, loading: unitLoading } = useWeightUnit();
  const isAnonymous = !!session?.user.is_anonymous;

  const load = useCallback(async () => {
    // The last workout's volume is converted to the unit, so wait for it.
    if (!userId || unitLoading) return;
    // One read of user_profiles covers the weekly target, the prefs and
    // the checklist's fields.
    const [profile, weekDates, inProgress, finishedCount, last, mine, system] = await Promise.all([
      home.getHomeProfile(userId),
      home.getWeekWorkoutDates(userId),
      home.getInProgressWorkout(userId),
      home.getFinishedWorkoutCount(userId),
      home.getLastWorkout(userId, weightUnit),
      home.getUserTemplates(userId),
      home.getSystemTemplates(),
    ]);
    const next: HomeData = {
      target: profile.weeklyTarget,
      weekDates,
      inProgress,
      finishedCount,
      last,
      mine,
      system,
      prefs: profile.prefs,
      sex: profile.sex,
      bodyweight: profile.bodyweight,
      invitedFriendAt: profile.invitedFriendAt,
      setupHiddenAt: profile.setupHiddenAt,
    };
    setData(next);
    noteSetup(next);

    if (inProgress && !autoResumedFor.has(userId)) {
      autoResumedFor.add(userId);
      router.push({ pathname: '/workout/[id]', params: { id: inProgress.id } });
    }
    // `noteSetup` is recreated every render and reads only `isAnonymous`,
    // which is a dependency, so linking an account reloads with the new value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, router, weightUnit, unitLoading, isAnonymous]);

  // Everything reads on focus, so returning from a workout refreshes the strip
  // and the last-workout card without a pull to refresh.
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => setSetupFinished(false);
    }, [load]),
  );

  // Above the early return, like every hook here: React needs the same
  // hooks in the same order on every render. An empty list before load.
  const art = useMemo(() => routineArtByProgram(data?.system ?? []), [data?.system]);

  const setup = useMemo(
    () =>
      data
        ? setupTasks({
            isAnonymous,
            finishedCount: data.finishedCount,
            mineCount: data.mine.length,
            sex: data.sex,
            bodyweight: data.bodyweight,
            invitedFriendAt: data.invitedFriendAt,
            setupHiddenAt: data.setupHiddenAt,
          })
        : null,
    [data, isAnonymous],
  );

  /** Shows the done state when the last task was ticked while the card was open. */
  function noteSetup(d: HomeData) {
    const s = setupTasks({
      isAnonymous,
      finishedCount: d.finishedCount,
      mineCount: d.mine.length,
      sex: d.sex,
      bodyweight: d.bodyweight,
      invitedFriendAt: d.invitedFriendAt,
      setupHiddenAt: d.setupHiddenAt,
    });
    if (setupWasOpen.current && s.allDone && d.setupHiddenAt == null) setSetupFinished(true);
    setupWasOpen.current = s.visible;
  }

  function onSetupTask(key: SetupTaskKey) {
    if (key === 'save') router.push('/link-account');
    else if (key === 'log') scrollRef.current?.scrollTo({ y: routinesY.current, animated: true });
    else if (key === 'strength') router.push('/settings');
    else if (key === 'routine') router.push('/routines');
    else void invite();
  }

  /**
   * iOS reports a share when the user completes one with any target; it
   * cannot say whether the message was actually sent, so that is the
   * signal. A dismissal changes nothing.
   */
  async function invite() {
    if (!userId) return;
    try {
      const result = await Share.share({ message: INVITE_MESSAGE, url: INVITE_URL });
      if (result.action !== Share.sharedAction) return;
    } catch {
      return;
    }
    await home.markInvited(userId);
    if (!data) return;
    const next = { ...data, invitedFriendAt: new Date().toISOString() };
    setData(next);
    noteSetup(next);
  }

  function confirmHideSetup() {
    Alert.alert('Hide setup?', 'Everything on this list is still in the app.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Hide',
        onPress: () => {
          if (!userId) return;
          setupWasOpen.current = false;
          setData((d) => (d ? { ...d, setupHiddenAt: new Date().toISOString() } : d));
          void home.hideSetup(userId);
        },
      },
    ]);
  }

  function openWorkout(id: string) {
    router.push({ pathname: '/workout/[id]', params: { id } });
  }

  async function run(key: string, fn: () => Promise<string | null>) {
    if (!userId || busy) return;
    setBusy(key);
    const id = await fn();
    setBusy(null);
    if (id) openWorkout(id);
    else Alert.alert('Could not start that workout.', 'Try again.');
  }

  function discard(w: InProgressWorkout) {
    setData((d) => (d ? { ...d, inProgress: null } : d));
    setUndo(w);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => {
      // Only delete once the undo window closes, so undo is a pure UI revert.
      void home.discardWorkout(w.id);
      setUndo(null);
    }, 5000);
  }

  function undoDiscard() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setData((d) => (d && undo ? { ...d, inProgress: undo } : d));
    setUndo(null);
  }

  async function onRoutineAction(action: RoutineAction) {
    menuRef.current?.dismiss();
    const t = menuTemplate;
    if (!t || !userId) return;
    if (action === 'rename') {
      renameRef.current?.present();
      return;
    }
    if (action === 'duplicate') {
      await home.saveTemplateCopy(userId, t);
      await load();
      return;
    }
    if (action === 'share') {
      const url = await home.ensureShareLink(t.id);
      if (url) await Share.share({ message: `${t.name}: a routine on LiftCamp\n${url}`, url });
      return;
    }
    if (action === 'delete') {
      Alert.alert(`Delete ${t.name}?`, 'This removes the routine, not any logged workouts.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await home.deleteTemplate(t.id);
            await load();
          },
        },
      ]);
    }
  }

  async function onRename(name: string) {
    renameRef.current?.dismiss();
    if (!menuTemplate) return;
    await home.renameTemplate(menuTemplate.id, name);
    await load();
  }

  if (!data) {
    return <View style={[styles.fill, { backgroundColor: c.bg }]} />;
  }

  const isNew = data.finishedCount === 0;
  const showSetup = !!setup && (setup.visible || setupFinished);
  const name = firstName(session?.user.user_metadata as Record<string, unknown> | undefined);

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {name ? <Text style={[type.meta, { color: c.text2 }]}>Hi {name}</Text> : null}

        <WeekStrip
          dates={data.weekDates}
          target={data.target}
          onPress={() => router.navigate('/history')}
        />

        {data.inProgress ? (
          <ResumeCard
            workout={data.inProgress}
            onResume={() => openWorkout(data.inProgress!.id)}
            onDiscard={() => discard(data.inProgress!)}
          />
        ) : null}

        <Pressable
          onPress={() => void run('empty', () => startAdHocWorkout(userId!))}
          disabled={busy !== null}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.start,
            { backgroundColor: c.accent },
            (pressed || busy === 'empty') && styles.pressed,
          ]}>
          <Text style={[type.button, styles.startLabel]}>
            {busy === 'empty' ? 'Starting…' : 'Start new workout'}
          </Text>
        </Pressable>

        {showSetup && setup ? (
          <SetupChecklist setup={setup} finished={setupFinished} onTask={onSetupTask} onHide={confirmHideSetup} />
        ) : null}

        <View style={styles.section} onLayout={(e) => (routinesY.current = e.nativeEvent.layout.y)}>
          <View style={styles.sectionHead}>
            <Text style={[type.exerciseName, { color: c.text }]}>Routines</Text>
            <Pressable onPress={() => router.push('/routines')} hitSlop={8}>
              <Text style={[type.button, { color: c.accentText, fontSize: 14 }]}>See all</Text>
            </Pressable>
          </View>

          {/* Your routines. A saved routine's variations sit under a heading
              with its name; a routine with no program is a card on its own. */}
          {home.groupUserTemplates(data.mine).map((g) => (
            <View key={g.key} style={styles.routineGroup}>
              {g.program ? (
                <Text style={[type.meta, styles.routineHeading, { color: c.text2 }]} numberOfLines={1}>
                  {g.program}
                  {templateLevelLabel(g.level) ? `  ·  ${templateLevelLabel(g.level)}` : ''}
                </Text>
              ) : null}
              {g.templates.map((t) => (
                <RoutineCard
                  key={t.id}
                  template={t}
                  lastDone={t.lastDone}
                  primaryLabel="Start"
                  onPrimary={() => void run(t.id, () => home.startFromTemplate(userId!, t, weightUnit))}
                  onLongPress={() => {
                    setMenuTemplate(t);
                    menuRef.current?.present();
                  }}
                  busy={busy === t.id}
                  disabled={busy !== null}
                />
              ))}
            </View>
          ))}

          <StarterRoutines
            match={home.starterPrograms(data.system, data.prefs)}
            art={art}
            prefs={data.prefs}
            onSeeAll={() => router.push({ pathname: '/routines', params: { all: '1' } })}
            defaultOpen={isNew}
            disabled={busy !== null}
            onUse={async (g) => {
              if (!userId) return false;
              const ok = await home.saveProgramCopy(userId, g);
              if (ok) await load();
              return ok;
            }}
          />
        </View>

        {isAnonymous && !showSetup ? (
          // Anonymous accounts only. Opens sign-in in link mode; once an
          // identity is attached the user stops being anonymous and this row
          // goes away on its own. Hidden while the checklist shows, since
          // its first task is the same thing.
          <Pressable
            onPress={() => router.push('/link-account')}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.saveRow,
              { backgroundColor: c.accentSoft },
              pressed && styles.pressed,
            ]}>
            <Text style={[type.button, { color: c.accentText, fontSize: 14 }]}>Save your workouts</Text>
            <Text style={[type.meta, { color: c.text2 }]}>
              Add Apple or Google and keep them on your next phone
            </Text>
          </Pressable>
        ) : null}

        {data.last ? (
          <LastWorkoutCard
            workout={data.last}
            unit={unit}
            onOpen={() => router.push({ pathname: '/history/[id]', params: { id: data.last!.id } })}
            onRepeat={() => void run('repeat', () => home.repeatWorkout(userId!, data.last!, weightUnit))}
            busy={busy === 'repeat'}
          />
        ) : null}
      </ScrollView>

      {undo ? (
        <View style={[styles.toast, { backgroundColor: c.surface2, borderColor: c.border }]}>
          <Text style={[type.meta, { color: c.text }]}>Workout discarded</Text>
          <Pressable onPress={undoDiscard} hitSlop={8}>
            <Text style={[type.button, { color: c.accentText }]}>Undo</Text>
          </Pressable>
        </View>
      ) : null}

      <RoutineMenuSheet ref={menuRef} template={menuTemplate} onAction={(a) => void onRoutineAction(a)} />
      <RenameSheet ref={renameRef} initialName={menuTemplate?.name ?? ''} onSave={(n) => void onRename(n)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    padding: spacing.screen,
    gap: spacing.lg,
    paddingBottom: 48,
  },
  start: {
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  startLabel: { color: '#FFFFFF', fontSize: 17 },
  section: { gap: spacing.md },
  routineGroup: { gap: spacing.sm },
  routineHeading: { fontWeight: '600' },
  saveRow: {
    borderRadius: radius.bar,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 2,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toast: {
    position: 'absolute',
    left: spacing.screen,
    right: spacing.screen,
    bottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.bar,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.8 },
});
