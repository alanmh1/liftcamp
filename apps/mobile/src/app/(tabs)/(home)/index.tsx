import {
  nextRoutineDay,
  routineArtByProgram,
  saveWorkoutsTitle,
  setupTasks,
  shouldOfferSave,
  UNSAVED_WORKOUTS_LINE,
  templateLevelLabel,
  type SetupTaskKey,
  type TemplateRow,
} from '@liftcamp/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import type { SheetRef } from '@/components/BottomSheet';
import { useAuth } from '@/components/auth-provider';
import { useWeightUnit } from '@/components/unit-provider';
import { LastWorkoutCard, LastWorkoutCardSkeleton } from '@/components/home/last-workout-card';
import { ResumeCard } from '@/components/home/resume-card';
import { NextUpCard, RoutineCard, RoutineCardSkeleton } from '@/components/home/routine-card';
import { RenameSheet, RoutineMenuSheet, type RoutineAction } from '@/components/home/routine-menu-sheet';
import { SetupChecklist } from '@/components/home/setup-checklist';
import { StarterRoutines, StarterRoutinesSkeleton } from '@/components/home/starter-routines';
import { WeekStrip, WeekStripSkeleton } from '@/components/home/week-strip';
import { Reveal } from '@/components/skeleton';
import { Text } from '@/components/text';
import * as home from '@/data/home';
import type { HomeTemplate, InProgressWorkout, LastWorkout } from '@/data/home';
import { startAdHocWorkout } from '@/data/workouts';
import { markScreen } from '@/lib/launch-timing';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';

/**
 * Home's reads, each filled in as its own request returns. Undefined means
 * not loaded yet, which is different from an empty answer (null or []).
 * A section renders once the reads it needs are in, so Home fills in top
 * to bottom as the network answers instead of waiting for the slowest.
 */
type HomeData = {
  /** The weekly target, the program prefs and the checklist's fields. */
  profile?: home.HomeProfile;
  weekDates?: string[];
  inProgress?: InProgressWorkout | null;
  finishedCount?: number;
  last?: LastWorkout | null;
  mine?: HomeTemplate[];
  /** All system routines; `starterPrograms` picks from them with the prefs. */
  system?: TemplateRow[];
};

/** The setup checklist's inputs, once every read it needs is in. */
function setupInput(d: HomeData, isAnonymous: boolean) {
  if (!d.profile || d.finishedCount === undefined || !d.mine) return null;
  return {
    isAnonymous,
    finishedCount: d.finishedCount,
    mineCount: d.mine.length,
    sex: d.profile.sex,
    birthday: d.profile.birthday,
    bodyweight: d.profile.bodyweight,
    invitedFriendAt: d.profile.invitedFriendAt,
    setupHiddenAt: d.profile.setupHiddenAt,
  };
}

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
  const { scheme, colors: c } = useTheme();
  const userId = session?.user.id;

  // The system routines start from the session cache when a screen already
  // read them. Everything else waits for its read.
  const [data, setData] = useState<HomeData>(() => ({ system: home.peekSystemTemplates() }));
  // Each load's number, so a slow read from an earlier load cannot land
  // over a newer one.
  const loadGen = useRef(0);
  // One key for anything that starts a workout: a routine id, 'empty', or
  // 'repeat'. Any non-null value disables every other start control on the
  // screen.
  const [busy, setBusy] = useState<string | null>(null);
  const [undo, setUndo] = useState<InProgressWorkout | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const menuRef = useRef<SheetRef>(null);
  const renameRef = useRef<SheetRef>(null);
  const [menuTemplate, setMenuTemplate] = useState<HomeTemplate | null>(null);

  // Whether the checklist was showing unfinished after the previous load,
  // and whether this visit is the one where it finished. The done state is
  // for that visit only: it clears on blur, and the next load finds the
  // card no longer visible.
  const setupWasOpen = useRef(false);
  const [setupFinished, setSetupFinished] = useState(false);

  const { label: unit, unit: weightUnit, loading: unitLoading } = useWeightUnit();
  const isAnonymous = !!session?.user.is_anonymous;

  // A different account starts from nothing rather than showing the last
  // one's data while its own loads.
  const dataFor = useRef(userId);
  useEffect(() => {
    if (dataFor.current === userId) return;
    dataFor.current = userId;
    loadGen.current += 1;
    setData({ system: home.peekSystemTemplates() });
  }, [userId]);

  const load = useCallback(async () => {
    // The last workout's volume is converted to the unit, so wait for it.
    if (!userId || unitLoading) return;
    const gen = ++loadGen.current;
    // What this load has fetched, for the checklist once it is all in. On a
    // refocus the screen keeps showing the previous data until each read
    // replaces its own part.
    const got: HomeData = {};
    let first = true;
    const track = <K extends keyof HomeData>(key: K, read: Promise<HomeData[K]>) =>
      read.then((value) => {
        if (gen !== loadGen.current) return;
        got[key] = value;
        setData((d) => ({ ...d, [key]: value }));
        if (first) {
          first = false;
          markScreen('home', 'first');
        }
      });

    // One read of user_profiles covers the weekly target, the prefs and
    // the checklist's fields.
    await Promise.all([
      track('profile', home.getHomeProfile(userId)),
      track('weekDates', home.getWeekWorkoutDates(userId)),
      track(
        'inProgress',
        home.getInProgressWorkout(userId).then((w) => {
          if (w && gen === loadGen.current && !autoResumedFor.has(userId)) {
            autoResumedFor.add(userId);
            router.push({ pathname: '/workout/[id]', params: { id: w.id } });
          }
          return w;
        }),
      ),
      track('finishedCount', home.getFinishedWorkoutCount(userId)),
      track('last', home.getLastWorkout(userId, weightUnit)),
      track('mine', home.getUserTemplates(userId)),
      track('system', home.getSystemTemplates()),
    ]);
    if (gen !== loadGen.current) return;
    markScreen('home', 'content');
    noteSetup(got);
    // `noteSetup` is recreated every render and reads only `isAnonymous`,
    // which is a dependency, so linking an account reloads with the new value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, router, weightUnit, unitLoading, isAnonymous]);

  // Everything reads on focus, so returning from a workout refreshes the strip
  // and the last-workout card without a pull to refresh.
  useFocusEffect(
    useCallback(() => {
      markScreen('home', 'open');
      void load();
      return () => setSetupFinished(false);
    }, [load]),
  );

  // Above the early return, like every hook here: React needs the same
  // hooks in the same order on every render. An empty list before load.
  const art = useMemo(() => routineArtByProgram(data.system ?? []), [data.system]);

  // Null until the profile, the workout count and the routines are all in,
  // so the checklist (and the save row it replaces) never flashes.
  const setup = useMemo(() => {
    const input = setupInput(data, isAnonymous);
    return input ? setupTasks(input) : null;
  }, [data, isAnonymous]);

  /** Shows the done state when the last task was ticked while the card was open. */
  function noteSetup(d: HomeData) {
    const input = setupInput(d, isAnonymous);
    if (!input) return;
    const s = setupTasks(input);
    if (setupWasOpen.current && s.allDone && input.setupHiddenAt == null) setSetupFinished(true);
    setupWasOpen.current = s.visible;
  }

  function onSetupTask(key: SetupTaskKey) {
    if (key === 'save') router.push('/link-account');
    else if (key === 'log') startFirstWorkout();
    else if (key === 'profile') router.push('/settings');
    else if (key === 'routine') router.push('/routines');
    else void invite();
  }

  /**
   * "Do your first workout": the next day of the user's saved routine, the
   * one Home would start next (see `nextRoutineDay`), or the routines list
   * to pick one when there is none yet.
   */
  function startFirstWorkout() {
    if (!nextUp) {
      router.push('/routines');
      return;
    }
    const next = nextUp.template;
    void run(next.id, () => home.startFromTemplate(userId!, next, weightUnit));
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
    if (!data.profile) return;
    const next = { ...data, profile: { ...data.profile, invitedFriendAt: new Date().toISOString() } };
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
          setData((d) =>
            d.profile ? { ...d, profile: { ...d.profile, setupHiddenAt: new Date().toISOString() } } : d,
          );
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
    setData((d) => ({ ...d, inProgress: null }));
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
    setData((d) => (undo ? { ...d, inProgress: undo } : d));
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

  const { profile } = data;
  const isNew = data.finishedCount === 0;
  const showSetup = !!setup && (setup.visible || setupFinished);
  const name = firstName(session?.user.user_metadata as Record<string, unknown> | undefined);
  // The saved routines as Home lists them, and the day Next up offers.
  const routineGroups = data.mine ? home.groupUserTemplates(data.mine) : undefined;
  const nextTemplate = routineGroups ? nextRoutineDay(routineGroups) : null;
  const nextUp = nextTemplate
    ? { template: nextTemplate, program: routineGroups!.find((g) => g.templates.includes(nextTemplate))?.program ?? null }
    : null;

  const starter =
    data.system && profile && data.finishedCount !== undefined
      ? home.starterPrograms(data.system, profile.prefs)
      : null;

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {name ? <Text style={[type.meta, { color: c.text2 }]}>Hi {name}</Text> : null}

        {/* Each section shows its skeleton until its own reads are in. The
            resume card and the checklist show only for some users, so they
            wait unseen rather than hold a place that may never fill. */}
        <Reveal ready={!!profile && !!data.weekDates} skeleton={<WeekStripSkeleton />}>
          {() => (
            <WeekStrip
              dates={data.weekDates!}
              target={profile!.weeklyTarget}
              onPress={() => router.navigate('/history')}
            />
          )}
        </Reveal>

        {data.inProgress ? (
          <ResumeCard
            workout={data.inProgress}
            onResume={() => openWorkout(data.inProgress!.id)}
            onDiscard={() => discard(data.inProgress!)}
          />
        ) : null}

        {/* Home's primary button, unless a saved routine has a Next up card,
            which then carries the primary Start and this steps back to an
            outline. */}
        <Pressable
          onPress={() => void run('empty', () => startAdHocWorkout(userId!))}
          disabled={busy !== null}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.start,
            nextUp ? { borderWidth: 1.5, borderColor: c.accent } : { backgroundColor: c.accent },
            (pressed || busy === 'empty') && styles.pressed,
          ]}>
          <Text style={[type.button, styles.startLabel, nextUp && { color: c.accentText }]}>
            {busy === 'empty' ? 'Starting…' : 'Start new workout'}
          </Text>
        </Pressable>

        {showSetup && setup ? (
          <SetupChecklist setup={setup} finished={setupFinished} onTask={onSetupTask} onHide={confirmHideSetup} />
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[type.exerciseName, { color: c.text }]}>Routines</Text>
            <Pressable onPress={() => router.push('/routines')} hitSlop={8}>
              <Text style={[type.button, { color: c.accentText, fontSize: 14 }]}>See all</Text>
            </Pressable>
          </View>

          {/* Your routines. The day to do next is the Next up card, with
              Home's primary Start; every other day is a row, a saved
              routine's under a heading with its name, a routine with no
              program as a row on its own. Two card skeletons until the read
              is in; nothing for none. */}
          {data.mine === undefined || data.mine.length > 0 ? (
            <Reveal ready={data.mine !== undefined} skeleton={<RoutinesSkeleton />} style={styles.section}>
              {() => (
                <>
                  {nextUp ? (
                    <NextUpCard
                      template={nextUp.template}
                      program={nextUp.program}
                      lastDone={nextUp.template.lastDone}
                      onStart={() => void run(nextUp.template.id, () => home.startFromTemplate(userId!, nextUp.template, weightUnit))}
                      onLongPress={() => {
                        setMenuTemplate(nextUp.template);
                        menuRef.current?.present();
                      }}
                      busy={busy === nextUp.template.id}
                      disabled={busy !== null}
                    />
                  ) : null}
                  {routineGroups!
                    .map((g) => ({ ...g, templates: g.templates.filter((t) => t.id !== nextUp?.template.id) }))
                    .filter((g) => g.templates.length > 0)
                    .map((g) => (
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
                </>
              )}
            </Reveal>
          ) : null}

          {/* Waits for the workout count too: it decides whether the list
              starts open, and that is only read when it mounts. A match with
              no programs renders nothing, so it gets no wrapper either. */}
          {/* With a routine saved, the starter grid gives way to one row into
              the full list. */}
          {data.mine && data.mine.length > 0 ? (
            <Pressable
              onPress={() => router.push('/routines')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.browseRow, cardSurface(scheme, c), pressed && styles.pressed]}>
              <Text style={[type.button, { color: c.text }]}>Browse other routines</Text>
              <SymbolView
                name="chevron.right"
                size={13}
                weight="semibold"
                tintColor={c.text3}
                fallback={<Text style={[styles.browseChevron, { color: c.text3 }]}>›</Text>}
              />
            </Pressable>
          ) : !starter || starter.programs.length > 0 ? (
            <Reveal ready={starter != null} skeleton={<StarterRoutinesSkeleton />}>
              {() => (
                <StarterRoutines
                  match={starter!}
                  art={art}
                  prefs={profile!.prefs}
                  defaultOpen={isNew}
                  disabled={busy !== null}
                  onUse={async (g) => {
                    if (!userId) return false;
                    const ok = await home.saveProgramCopy(userId, g);
                    if (ok) await load();
                    return ok;
                  }}
                />
              )}
            </Reveal>
          ) : null}
        </View>

        {setup && !showSetup && shouldOfferSave({ isAnonymous, finishedCount: data.finishedCount ?? 0 }) ? (
          // A guest with at least one finished workout: before that there
          // is nothing to save. Opens sign-in in link mode; once an identity
          // is attached the user stops being anonymous and this row goes
          // away on its own. Hidden while the checklist shows, since its
          // first task is the same thing.
          <Pressable
            onPress={() => router.push('/link-account')}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.saveRow,
              { backgroundColor: c.accentSoft },
              pressed && styles.pressed,
            ]}>
            <Text style={[type.button, { color: c.accentText, fontSize: 14 }]}>
              {saveWorkoutsTitle(data.finishedCount ?? 0)}
            </Text>
            <Text style={[type.meta, { color: c.text2 }]}>{UNSAVED_WORKOUTS_LINE}</Text>
          </Pressable>
        ) : null}

        {/* A skeleton only while a last workout may exist: not once the
            count says there are none. */}
        {data.last || (data.last === undefined && data.finishedCount !== 0) ? (
          <Reveal ready={data.last !== undefined} skeleton={<LastWorkoutCardSkeleton />}>
            {() => (
              <LastWorkoutCard
                workout={data.last!}
                unit={unit}
                onOpen={() => router.push({ pathname: '/history/[id]', params: { id: data.last!.id } })}
                onRepeat={() => void run('repeat', () => home.repeatWorkout(userId!, data.last!, weightUnit))}
                busy={busy === 'repeat'}
              />
            )}
          </Reveal>
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

/** Two routine cards, for Your routines before they load. */
function RoutinesSkeleton() {
  return (
    <View style={styles.routineGroup}>
      <RoutineCardSkeleton nameWidth="48%" />
      <RoutineCardSkeleton nameWidth="36%" />
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
  browseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.card,
    paddingHorizontal: spacing.card,
    paddingVertical: spacing.lg,
  },
  browseChevron: { fontSize: 20, lineHeight: 22 },
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
