import {
  CREATE_ACCOUNT_TITLE,
  EMPTY_LOCAL_HOME,
  INVITE_URL,
  mergeHomePending,
  NEXT_WORKOUT_LINE,
  nextRoutineDay,
  routineArtByProgram,
  setupCardMode,
  setupTasks,
  shouldOfferSave,
  templateLevelLabel,
  type LocalHomeState,
  type SetupTaskKey,
  type TemplateRow,
} from '@liftcamp/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import type { SheetRef } from '@/components/BottomSheet';
import { useAuth } from '@/components/auth-provider';
import { HeaderWorkoutButton } from '@/components/header-workout-button';
import { useWeightUnit } from '@/components/unit-provider';
import { LastWorkoutCard, LastWorkoutCardSkeleton } from '@/components/home/last-workout-card';
import { ResumeCard } from '@/components/home/resume-card';
import { NextUpCard, NextUpCardSkeleton, RoutineCard } from '@/components/home/routine-card';
import { RenameSheet, RoutineMenuSheet, type RoutineAction } from '@/components/home/routine-menu-sheet';
import { SetupChecklist } from '@/components/home/setup-checklist';
import { StarterRoutines, StarterRoutinesSkeleton } from '@/components/home/starter-routines';
import { StreakShareSheet, type StreakShareHandle } from '@/components/home/streak-share-sheet';
import { WeekCard, WeekCardSkeleton } from '@/components/home/week-card';
import { ScreenHeader } from '@/components/screen-header';
import { useStartGate } from '@/components/start-gate';
import { Reveal } from '@/components/skeleton';
import { Text } from '@/components/text';
import * as home from '@/data/home';
import { completionShownThisSession, markCompletionShown, readCompletionSeen } from '@/data/setup-completion';
import type { HomeTemplate, InProgressWorkout, LastWorkout } from '@/data/home';
import { startAdHocWorkout } from '@/data/workouts';
import { writeQueue } from '@/data/write-queue';
import { subscribeGuestMerge, takeMergedNotice } from '@/lib/guest-merge';
import { markScreen } from '@/lib/launch-timing';
import { networkFailedSince } from '@/lib/network';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
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
  /** Finished workout dates for the last 52 weeks, for the week card and its streak. */
  streakDates?: string[];
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

/** 20 pt icon plus 12 on every side: the 44 pt minimum tap target. */
const TRASH_SLOP = 12;

const INVITE_MESSAGE = `I'm tracking my lifting with LiftCamp. It's free and it's built for people just starting out. ${INVITE_URL}`;


function firstName(meta: Record<string, unknown> | undefined): string | null {
  const raw = meta?.full_name ?? meta?.name ?? meta?.given_name;
  if (typeof raw !== 'string') return null;
  const first = raw.trim().split(/\s+/)[0];
  return first && first.length <= 24 ? first : null;
}

/** How long the line after a guest merge stays. */
const MERGED_NOTICE_MS = 4000;

export default function HomeScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { guardStart, offerIfDue } = useStartGate();
  const { scheme, colors: c } = useTheme();
  const userId = session?.user.id;

  const { label: unit, unit: weightUnit, loading: unitLoading } = useWeightUnit();

  // The first frame draws from the last full load, which UnitProvider has
  // already put in memory (home.peekHomeCache), so a stored session shows
  // Home at once with or without signal. The system routines start from the
  // session cache when a screen already read them. Each part is then
  // replaced by its read.
  const [base, setData] = useState<HomeData>(() => {
    const cached = userId && !unitLoading ? home.peekHomeCache<HomeData>(userId, weightUnit) : undefined;
    return { ...cached, system: home.peekSystemTemplates() ?? cached?.system };
  });
  // What only the phone knows yet: workouts finished, discarded or started
  // here whose writes are still queued (home.getLocalHomeState).
  const [local, setLocal] = useState<LocalHomeState<InProgressWorkout, LastWorkout>>(EMPTY_LOCAL_HOME);
  // A Resume card swiped away, hidden through the undo window before the
  // discard is queued.
  const [hiddenId, setHiddenId] = useState<string | null>(null);
  const data = useMemo(() => {
    const merged = mergeHomePending(base, local);
    return hiddenId && merged.inProgress?.id === hiddenId ? { ...merged, inProgress: null } : merged;
  }, [base, local, hiddenId]);
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
  const streakShareRef = useRef<StreakShareHandle>(null);
  const [menuTemplate, setMenuTemplate] = useState<HomeTemplate | null>(null);

  const isAnonymous = !!session?.user.is_anonymous;

  // Whether this user saw the checklist finished on an earlier launch
  // (setupCardMode). Undefined while it is read, which keeps a finished
  // card from flashing.
  const [completionSeen, setCompletionSeen] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    setCompletionSeen(undefined);
    if (!userId) return;
    let live = true;
    void readCompletionSeen(userId).then((seen) => {
      if (live) setCompletionSeen(seen);
    });
    return () => {
      live = false;
    };
  }, [userId]);

  // A different account starts from nothing rather than showing the last
  // one's data while its own loads.
  const dataFor = useRef(userId);
  useEffect(() => {
    if (dataFor.current === userId) return;
    dataFor.current = userId;
    loadGen.current += 1;
    setData({ system: home.peekSystemTemplates() });
    setLocal(EMPTY_LOCAL_HOME);
    setHiddenId(null);
  }, [userId]);

  // The last full load, drawn at once and kept when the reads find no
  // signal, then the phone's own state over it. Only parts no read has
  // filled yet take the cached value.
  useEffect(() => {
    if (!userId || unitLoading) return;
    let cancelled = false;
    void home.readHomeCache<HomeData>(userId, weightUnit).then((cached) => {
      if (cancelled || !cached) return;
      setData((d) => {
        const next: HomeData = { ...cached };
        for (const k of Object.keys(d) as (keyof HomeData)[]) {
          if (d[k] !== undefined) (next as Record<string, unknown>)[k] = d[k];
        }
        return next;
      });
    });
    void home.getLocalHomeState(userId, weightUnit).then((l) => {
      if (!cancelled) setLocal(l);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, weightUnit, unitLoading]);

  // A session kept from storage with its access token expired (opened with
  // no signal) sends reads with the publishable key until it refreshes, and
  // RLS answers those empty. Home waits for the fresh token instead: the
  // refresh changes `accessToken`, which remakes `load`, and the focus
  // effect runs it again.
  const accessToken = session?.access_token;
  const expiresAt = session?.expires_at;

  const load = useCallback(async () => {
    // The last workout's volume is converted to the unit, so wait for it.
    if (!userId || unitLoading) return;
    const gen = ++loadGen.current;
    if (accessToken && expiresAt != null && expiresAt * 1000 <= Date.now()) {
      // The cache stays on screen; the phone's own state can still update.
      const phone = await home.getLocalHomeState(userId, weightUnit);
      if (gen === loadGen.current) setLocal(phone);
      return;
    }
    const startedAt = Date.now();
    // What this load has fetched, for the checklist once it is all in. On a
    // refocus the screen keeps showing the previous data until each read
    // replaces its own part. A read that lands after any request of this
    // load went unanswered is an empty default, not an answer, and is not
    // shown: the cached or earlier value stays.
    const got: HomeData = {};
    let first = true;
    const track = <K extends keyof HomeData>(key: K, read: Promise<HomeData[K]>) =>
      read.then((value) => {
        if (gen !== loadGen.current || networkFailedSince(startedAt)) return;
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
      track('streakDates', home.getStreakWorkoutDates(userId)),
      // A workout in progress shows as the Resume card and opens on a tap.
      track('inProgress', home.getInProgressWorkout(userId)),
      track('finishedCount', home.getFinishedWorkoutCount(userId)),
      track('last', home.getLastWorkout(userId, weightUnit)),
      track('mine', home.getUserTemplates(userId)),
      track('system', home.getSystemTemplates()),
    ]);
    if (gen !== loadGen.current) return;
    // After the reads, so a write that synced during them is not counted twice.
    const phone = await home.getLocalHomeState(userId, weightUnit);
    if (gen !== loadGen.current) return;
    setLocal(phone);
    if (!networkFailedSince(startedAt)) {
      void home.saveHomeCache(userId, weightUnit, got);
      // A guest who started a second workout with no signal: once it is
      // over and Home has reached the server, the create-account sheet.
      const now = mergeHomePending(got, phone);
      void offerIfDue({ finishedCount: now.finishedCount ?? 0, inProgress: now.inProgress != null });
    }
    markScreen('home', 'content');
    // `isAnonymous` is not read here; it is a dependency so that linking an
    // account reloads Home.
  }, [userId, weightUnit, unitLoading, isAnonymous, accessToken, expiresAt, offerIfDue]);

  // Everything reads on focus, so returning from a workout refreshes the strip
  // and the last-workout card without a pull to refresh.
  // Counts Home's focuses; the week card checks for its celebration on each.
  const [focusCount, setFocusCount] = useState(0);
  useFocusEffect(
    useCallback(() => {
      markScreen('home', 'open');
      setFocusCount((n) => n + 1);
      void load();
      // While Home is showing, it reads again when the app comes back to the
      // foreground and when the phone's queued writes have all reached the
      // server, so a workout synced after a reconnect appears without
      // leaving the tab.
      const appState = AppState.addEventListener('change', (state) => {
        if (state === 'active') void load();
      });
      let pending = writeQueue.status().pending;
      const unsubscribe = writeQueue.subscribe((status) => {
        if (pending > 0 && status.pending === 0) void load();
        pending = status.pending;
      });
      // A guest's data merged into this account while Home is showing (a
      // merge retried after "Sign in now").
      const unsubscribeMerge = subscribeGuestMerge((e) => {
        if (e.type === 'merged') void load();
      });
      return () => {
        appState.remove();
        unsubscribe();
        unsubscribeMerge();
      };
    }, [load]),
  );

  // After a guest's data is merged into this account: one quiet line for a
  // few seconds, no alert. A merge that lands before Home mounts leaves its
  // line to be taken; one that lands while Home shows arrives as an event.
  const [mergedNotice, setMergedNotice] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const show = (line: string | null) => {
      if (!line) return;
      setMergedNotice(line);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setMergedNotice(null), MERGED_NOTICE_MS);
    };
    show(takeMergedNotice());
    const unsubscribe = subscribeGuestMerge((e) => {
      if (e.type === 'merged') show(takeMergedNotice() ?? e.line);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Above the early return, like every hook here: React needs the same
  // hooks in the same order on every render. An empty list before load.
  const art = useMemo(() => routineArtByProgram(data.system ?? []), [data.system]);

  // Null until the profile, the workout count and the routines are all in,
  // so the checklist (and the save row it replaces) never flashes.
  const setup = useMemo(() => {
    const input = setupInput(data, isAnonymous);
    return input ? setupTasks(input) : null;
  }, [data, isAnonymous]);

  // Open, finished ("All done") for the rest of the session its last task
  // ticked, or hidden. See setupCardMode.
  const setupMode =
    setup && userId
      ? setupCardMode(setup, {
          setupHiddenAt: data.profile?.setupHiddenAt ?? null,
          completionSeen,
          doneShownThisSession: completionShownThisSession(userId),
        })
      : 'hidden';

  // Shown finished: kept up this session and hidden from the next launch.
  // The flag is never cleared: a task that unticks reopens the card on its
  // own (setupCardMode), and clearing on a cache drawn before the finish
  // would show "All done" again.
  useEffect(() => {
    if (userId && setupMode === 'done' && !completionShownThisSession(userId)) markCompletionShown(userId);
  }, [userId, setupMode]);

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
    if (!base.profile) return;
    const invitedFriendAt = new Date().toISOString();
    setData((d) => (d.profile ? { ...d, profile: { ...d.profile, invitedFriendAt } } : d));
  }

  function confirmHideSetup() {
    Alert.alert('Hide setup?', 'Everything on this list is still in the app.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Hide',
        onPress: () => {
          if (!userId) return;
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

  /**
   * Every start on Home. Through the start gate: a guest's second workout
   * waits behind the create-account sheet and runs once an account is
   * linked, or not at all.
   */
  async function run(key: string, fn: () => Promise<string | null>) {
    if (!userId || busy) return;
    setBusy(key);
    await guardStart(async () => {
      setBusy(key);
      const id = await fn();
      setBusy(null);
      if (id) openWorkout(id);
      else Alert.alert('Could not start that workout.', 'Try again.');
    });
    setBusy(null);
  }

  function discard(w: InProgressWorkout) {
    setHiddenId(w.id);
    setUndo(w);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => {
      // Only delete once the undo window closes, so undo is a pure UI revert.
      // Stays hidden: from here the queued discard hides it.
      if (userId) void home.discardWorkout(userId, w.id);
      setUndo(null);
    }, 5000);
  }

  /**
   * Before the header pill starts a workout: a discard still waiting on
   * Undo is queued now, so the workout swiped away stops counting as open
   * and Undo cannot bring back a second one.
   */
  async function commitPendingDiscard() {
    if (!undo || !userId) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(null);
    await home.discardWorkout(userId, undo.id);
  }

  function undoDiscard() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setHiddenId(null);
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

  /**
   * The trash on a saved routine's label row. Removes every day of it (the
   * user's own template rows, Next up's day included) through the write
   * queue, so it works offline. Home drops it at once: from the loaded
   * data now, and through the pending overlay until the deletes sync, so a
   * reload in between does not bring it back. Workouts done from it, their
   * PRs and the streak stay. No haptic.
   */
  function confirmRemoveRoutine(program: string, templateIds: string[]) {
    Alert.alert(`Remove ${program}?`, 'Its days leave your Home screen. Your past workouts, PRs and streak stay.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void removeRoutine(templateIds) },
    ]);
  }

  async function removeRoutine(templateIds: string[]) {
    if (!userId) return;
    const gone = new Set(templateIds);
    const before = base.mine;
    setData((d) => (d.mine ? { ...d, mine: d.mine.filter((t) => !gone.has(t.id)) } : d));
    setLocal((l) => ({ ...l, removedTemplateIds: [...l.removedTemplateIds, ...templateIds] }));
    const saved = await home.removeRoutine(userId, templateIds);
    if (!saved) {
      setData((d) => ({ ...d, mine: before }));
      setLocal((l) => ({ ...l, removedTemplateIds: l.removedTemplateIds.filter((id) => !gone.has(id)) }));
      Alert.alert('Could not remove that routine.', 'Try again.');
      return;
    }
    const phone = await home.getLocalHomeState(userId, weightUnit);
    setLocal(phone);
  }

  async function onRename(name: string) {
    renameRef.current?.dismiss();
    if (!menuTemplate) return;
    await home.renameTemplate(menuTemplate.id, name);
    await load();
  }

  const { profile } = data;
  const isNew = data.finishedCount === 0;
  const showSetup = setupMode !== 'hidden';
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

  const hasRoutine = !!data.mine && data.mine.length > 0;

  /** "Start new workout", filled, leads Home until a routine is saved. With
   *  a routine, Next up leads and an empty workout is the header's pill. */
  const startButton = (
    <Pressable
      onPress={() => void run('empty', () => startAdHocWorkout(userId!, weightUnit))}
      disabled={busy !== null}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.start,
        { backgroundColor: c.accent },
        (pressed || busy === 'empty') && styles.pressed,
      ]}>
      <Text style={[type.button, styles.startLabel]}>{busy === 'empty' ? 'Starting…' : 'Start new workout'}</Text>
    </Pressable>
  );

  const checklist =
    showSetup && setup ? (
      <SetupChecklist setup={setup} finished={setupMode === 'done'} onTask={onSetupTask} onHide={confirmHideSetup} />
    ) : null;

  /** The day to do next, with Home's primary Start. */
  const nextUpCard = nextUp ? (
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
  ) : null;

  /** Every saved day but Next up's: a routine's under its name, with the
   *  trash that removes the whole routine, and a routine with no program as
   *  a row on its own. */
  const otherDays = (routineGroups ?? [])
    .map((g) => ({
      ...g,
      // Every day, Next up's included: Remove takes the whole routine.
      allIds: g.templates.map((t) => t.id),
      templates: g.templates.filter((t) => t.id !== nextUp?.template.id),
    }))
    .filter((g) => g.templates.length > 0)
    .map((g) => (
      <View key={g.key} style={styles.routineGroup}>
        {g.program ? (
          <View style={styles.routineHead}>
            <Text style={[type.meta, styles.routineHeading, { color: c.text2 }]} numberOfLines={1}>
              {g.program}
              {templateLevelLabel(g.level) ? `  ·  ${templateLevelLabel(g.level)}` : ''}
            </Text>
            <Pressable
              onPress={() => confirmRemoveRoutine(g.program!, g.allIds)}
              hitSlop={TRASH_SLOP}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${g.program}`}
              style={({ pressed }) => [styles.trash, pressed && styles.pressed]}>
              <SymbolView
                name="trash"
                size={16}
                tintColor={c.text3}
                fallback={<Text style={[styles.trashGlyph, { color: c.text3 }]}>🗑</Text>}
              />
            </Pressable>
          </View>
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
    ));

  /** With a routine saved, the starter grid gives way to one row into the full list. */
  const browseRow = (
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
  );

  const starterSection =
    !starter || starter.programs.length > 0 ? (
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
    ) : null;

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScreenHeader
        title="Home"
        trailing={
          <HeaderWorkoutButton
            // Undefined until Home's reads (or its cache) are in; the pill
            // looks it up itself until then.
            openWorkoutId={data.inProgress === undefined ? undefined : (data.inProgress?.id ?? null)}
            disabled={busy !== null}
            beforeStart={commitPendingDiscard}
            onBusyChange={(b) => setBusy(b ? 'empty' : null)}
          />
        }
      />
      <ScrollView
        {...scrollInsetProps}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {name ? <Text style={[type.meta, { color: c.text2 }]}>Hi {name}</Text> : null}
        {mergedNotice ? <Text style={[type.meta, { color: c.text2 }]}>{mergedNotice}</Text> : null}

        {/* Each section shows its skeleton until its own reads are in. The
            resume card and the checklist show only for some users, so they
            wait unseen rather than hold a place that may never fill. */}
        <Reveal
          ready={!!profile && !!data.streakDates && data.finishedCount !== undefined}
          skeleton={<WeekCardSkeleton />}>
          {() => (
            <WeekCard
              dates={data.streakDates!}
              target={profile!.weeklyTarget}
              finishedCount={data.finishedCount!}
              focusCount={focusCount}
              onPress={() => router.navigate('/history')}
              onShareStreak={(share) => streakShareRef.current?.present(share)}
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

        {data.mine === undefined ? (
          // Until the saved routines are read, one Next up-shaped skeleton
          // holds the whole area below, so Home never lays itself out one
          // way and then switches to the other.
          <NextUpCardSkeleton />
        ) : hasRoutine ? (
          // A saved routine: its next day leads with Home's primary Start,
          // then the checklist, the routine's other days and the way into
          // the full list. An empty workout is the header's pill.
          <>
            {nextUpCard}
            {checklist}
            <View style={styles.section}>
              <Text style={[type.exerciseName, { color: c.text }]}>Saved routines</Text>
              {otherDays}
              {browseRow}
            </View>
          </>
        ) : (
          // No saved routine: Start leads, then the checklist and the
          // routines, the starter grid among them.
          <>
            {startButton}
            {checklist}
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={[type.exerciseName, { color: c.text }]}>Routines</Text>
                <Pressable onPress={() => router.push('/routines')} hitSlop={8}>
                  <Text style={[type.button, { color: c.accentText, fontSize: 14 }]}>See all</Text>
                </Pressable>
              </View>
              {/* Waits for the workout count too: it decides whether the list
                  starts open, and that is only read when it mounts. A match with
                  no programs renders nothing, so it gets no wrapper either. */}
              {starterSection}
            </View>
          </>
        )}

        {setup && !showSetup && shouldOfferSave({ isAnonymous, finishedCount: data.finishedCount ?? 0 }) ? (
          // A guest with at least one finished workout, who needs an
          // account for the next one. Opens sign-in in link mode; once an identity
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
              {CREATE_ACCOUNT_TITLE}
            </Text>
            <Text style={[type.meta, { color: c.text2 }]}>{NEXT_WORKOUT_LINE}</Text>
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
      <StreakShareSheet ref={streakShareRef} />
    </View>
  );
}


const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    padding: spacing.screen,
    gap: spacing.lg,
    paddingBottom: SCROLL_END_PADDING,
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
  routineHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  routineHeading: { flex: 1, fontWeight: '600' },
  // A 20 pt icon box; TRASH_SLOP brings the tap target to 44 pt without
  // making the label row taller.
  trash: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  trashGlyph: { fontSize: 15, lineHeight: 18 },
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
