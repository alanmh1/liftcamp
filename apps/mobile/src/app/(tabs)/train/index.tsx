import {
  lastDoneLabel,
  nextInRotation,
  otherRoutines,
  rotationRoutines,
  routineArtByProgram,
  routineMuscleSummary,
  routineProgram,
  rotationAfter,
  rotationList,
  type TemplateRow,
  type UpNextSkips,
} from '@liftcamp/shared';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { HeaderWorkoutButton } from '@/components/header-workout-button';
import { ProgramGrid, ProgramGridSkeleton } from '@/components/home/program-row';
import { NextUpCard, NextUpCardSkeleton } from '@/components/home/routine-card';
import {
  confirmRemoveRoutine,
  RoutineRows,
  RoutineRowsSkeleton,
  routineBuilderHref,
  routineRowMeta,
  useRoutineMenu,
} from '@/components/home/saved-routines';
import { ReorderListModal } from '@/components/reorder-list-modal';
import { ScreenHeader } from '@/components/screen-header';
import { SoftPill } from '@/components/soft-pill';
import { Reveal } from '@/components/skeleton';
import { useStartGate } from '@/components/start-gate';
import { useNavHref, useTabStack } from '@/components/tab-layout';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import * as home from '@/data/home';
import type { HomeTemplate, TrainingPrefs } from '@/data/home';
import { peekAllExercises, searchExercises, startAdHocWorkout } from '@/data/workouts';
import { networkFailedSince } from '@/lib/network';
import { useRoutineCapCheck } from '@/lib/pro';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, pressedFlat, radius, spacing, type } from '@/theme/tokens';

/**
 * The Workout tab (docs/workout-tab-spec.md), one scroll, top to bottom:
 *
 * - Up next: the routine after the one done last in the rotation
 *   (`nextInRotation`, the same pick as Home's Next up, Skips included),
 *   as a large card with the accent Start and a ⋯ for the routine menu.
 *   The card body, a row body and a starter tile push the routine's
 *   detail on this stack.
 * - Your rotation (docs/routine-builder-spec.md): the routines after Up
 *   next, in rotation order, wrapping around (`rotationAfter`), numbered
 *   from 1. The first three show; Show all opens the rest of the rotation
 *   and then the routines out of it, under "Not in rotation" and most
 *   recently done first (`rotationList`). Collapsed again on blur. Edit
 *   opens the reorder of the whole rotation; Done saves it
 *   (`saveRotationOrder`). A day done today is dimmed. No trash here;
 *   Remove is in the routine menu (⋯ or a long press) and takes the whole
 *   routine. The same menu edits it in the builder and adds it to the
 *   rotation or takes it out.
 * - The start card: Start empty workout, and Build a routine, which runs
 *   the custom routine cap check and opens the builder. The header pill
 *   shows only as Resume.
 * - Find a routine: the first four starter programs as a 2×2 grid, matched
 *   to the profile's level and equipment, with See All for the full
 *   browser on this stack.
 * - Exercise library, one card with the library's count.
 *
 * With nothing in the rotation, Up next is absent and Find a routine
 * leads, as with no saved routine; the start card follows, then the
 * routines out of the rotation. Every start goes through the start gate.
 *
 * Reads on focus. The saved routines and the prefs start from Home's last
 * full load, so the tab draws them at once and keeps them with no signal.
 * Routines removed on the phone and not yet synced stay hidden.
 */
export default function WorkoutTab() {
  const { session } = useAuth();
  const router = useRouter();
  const navHref = useNavHref();
  const { scheme, colors: c } = useTheme();
  const { guardStart } = useStartGate();
  const stack = useTabStack();
  const routineCapOk = useRoutineCapCheck();
  const { unit: weightUnit, loading: unitLoading } = useWeightUnit();
  const userId = session?.user.id;

  const [mine, setMine] = useState<HomeTemplate[] | undefined>(() =>
    userId && !unitLoading ? home.peekHomeCache<{ mine?: HomeTemplate[] }>(userId, weightUnit)?.mine : undefined,
  );
  // Removed here, deletes still queued: hidden until they sync.
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [system, setSystem] = useState<TemplateRow[] | undefined>(() => home.peekSystemTemplates());
  const [prefs, setPrefs] = useState<TrainingPrefs | undefined>(() =>
    userId && !unitLoading
      ? home.peekHomeCache<{ profile?: home.HomeProfile }>(userId, weightUnit)?.profile?.prefs
      : undefined,
  );
  // The library's size for the Exercises row. The same whole-library read
  // the library screen makes, cached for the session, so opening it is
  // instant once this has landed. A failed read answers empty and is ignored.
  const [exerciseCount, setExerciseCount] = useState<number | undefined>(() => peekAllExercises()?.length);
  // The routine id whose start runs, or 'empty'; any value disables every Start.
  const [busy, setBusy] = useState<string | null>(null);
  // The rotation's reorder, open from Edit.
  const [reordering, setReordering] = useState(false);
  // Show all under Your rotation. Collapsed again whenever the tab loses focus.
  const [expanded, setExpanded] = useState(false);
  // Home's Skips, so Up next offers the same routine Next up does after one.
  const [upNextSkips, setUpNextSkips] = useState<UpNextSkips>(() => (userId ? home.peekUpNextSkips(userId) : {}));
  const loadGen = useRef(0);

  const load = useCallback(async () => {
    if (!userId || unitLoading) return;
    const gen = ++loadGen.current;
    const startedAt = Date.now();
    // A read that lands after a request went unanswered is an empty default,
    // so it only fills a part nothing else has filled.
    const keep = <T,>(value: T) => (prev: T | undefined) =>
      gen === loadGen.current && !networkFailedSince(startedAt) ? value : (prev ?? value);
    await Promise.all([
      home.getUserTemplates(userId).then((rows) => {
        if (gen === loadGen.current) setMine(keep(rows));
      }),
      home.getSystemTemplates().then((rows) => {
        if (gen === loadGen.current) setSystem(rows);
      }),
      home.getTrainingPrefs(userId).then((p) => {
        if (gen === loadGen.current) setPrefs(keep(p));
      }),
      searchExercises('').then((rows) => {
        if (gen === loadGen.current && rows.length > 0) setExerciseCount(rows.length);
      }),
      home.getLocalHomeState(userId, weightUnit).then((l) => {
        if (gen === loadGen.current) setRemovedIds(l.removedTemplateIds);
      }),
    ]);
  }, [userId, weightUnit, unitLoading]);

  useFocusEffect(
    useCallback(() => {
      // In memory from launch and kept current by Home's Skip.
      if (userId) setUpNextSkips(home.peekUpNextSkips(userId));
      void load();
      return () => setExpanded(false);
    }, [load, userId]),
  );

  const shownMine = useMemo(() => {
    if (!mine) return undefined;
    const removed = new Set(removedIds);
    return mine.filter((t) => !removed.has(t.id));
  }, [mine, removedIds]);
  const rotation = useMemo(() => (shownMine ? rotationRoutines(shownMine) : undefined), [shownMine]);
  const others = useMemo(() => (shownMine ? otherRoutines(shownMine) : undefined), [shownMine]);
  const hero = rotation ? nextInRotation(rotation, upNextSkips) : null;
  const list = rotationList(rotationAfter(rotation ?? [], hero?.id), others ?? [], expanded);
  const art = useMemo(() => routineArtByProgram(system ?? []), [system]);
  const starter = system && prefs ? home.starterPrograms(system, prefs) : null;

  /** Remove from the menu takes the whole routine: every saved day that shares its program. */
  function askRemove(t: HomeTemplate) {
    const program = routineProgram(t);
    const ids = program ? (shownMine ?? []).filter((d) => routineProgram(d) === program).map((d) => d.id) : [t.id];
    confirmRemoveRoutine(program ?? t.name, () => void removeRoutine(ids));
  }

  const routineMenu = useRoutineMenu({ userId, reload: load, onRemove: askRemove });

  /**
   * Every start here, through the start gate, as on Home. `templateId` is
   * the routine day it seeds from, so a tap on the one in progress resumes it.
   */
  async function run(key: string, fn: () => Promise<string | null>, templateId?: string) {
    if (!userId || busy) return;
    setBusy(key);
    await guardStart(async () => {
      setBusy(key);
      const id = await fn();
      setBusy(null);
      if (id) router.push({ pathname: '/workout/[id]', params: { id } });
      else Alert.alert('Could not start that workout.', 'Try again.');
    }, templateId);
    setBusy(null);
  }

  function openRoutine(t: HomeTemplate) {
    router.push(navHref({ kind: 'routine', id: t.id }));
  }

  function startRoutine(t: HomeTemplate) {
    void run(t.id, () => home.startFromTemplate(userId!, t, weightUnit), t.id);
  }

  /**
   * The empty start, as the header pill did it: a workout already open on
   * the phone is resumed, never gated; otherwise the gate, then an instant
   * start.
   */
  async function startEmpty() {
    if (!userId || busy) return;
    const open = await home.getDeviceOpenWorkout(userId);
    if (open) {
      router.push({ pathname: '/workout/[id]', params: { id: open.id } });
      return;
    }
    await run('empty', () => startAdHocWorkout(userId, weightUnit));
  }

  /** Build a routine: the cap check first, so nobody builds a routine they cannot keep. */
  async function openBuilder() {
    if (!userId || busy) return;
    setBusy('build');
    const ok = await routineCapOk(userId);
    setBusy(null);
    if (ok) router.push(routineBuilderHref(stack));
  }

  /** Done in the reorder: the new order is drawn at once, then saved. */
  async function saveOrder(ordered: HomeTemplate[]) {
    setReordering(false);
    if (!rotation || ordered.every((t, i) => t.id === rotation[i]?.id)) return;
    const ids = ordered.map((t) => t.id);
    const before = mine;
    setMine((rows) =>
      rows?.map((r) => {
        const at = ids.indexOf(r.id);
        return at >= 0 ? { ...r, rotation_position: at } : r;
      }),
    );
    if (!(await home.saveRotationOrder(ids))) {
      setMine(before);
      Alert.alert('Could not save the new order.', 'Try again.');
      return;
    }
    void load();
  }

  async function removeRoutine(templateIds: string[]) {
    if (!userId) return;
    const gone = new Set(templateIds);
    setRemovedIds((ids) => [...ids, ...templateIds]);
    const saved = await home.removeRoutine(userId, templateIds);
    if (!saved) {
      setRemovedIds((ids) => ids.filter((id) => !gone.has(id)));
      Alert.alert('Could not remove that routine.', 'Try again.');
      return;
    }
    const phone = await home.getLocalHomeState(userId, weightUnit);
    setRemovedIds(phone.removedTemplateIds);
  }

  const rotationSection =
    rotation && (list.rotation.length > 0 || list.toggle) ? (
      <View style={styles.section}>
        <View style={styles.headBlock}>
          <View style={styles.headRow}>
            <Text style={[type.exerciseName, { color: c.text }]}>Your rotation</Text>
            {/* In the title's row, so it centres on the title line, not on
                the title and sub-line together. */}
            {rotation.length > 1 ? (
              <SoftPill
                label="Edit"
                accessibilityLabel="Edit rotation order"
                disabled={busy !== null}
                onPress={() => setReordering(true)}
              />
            ) : null}
          </View>
          {list.rotation.length > 0 ? (
            <Text style={[type.meta, { color: c.text2 }]}>Then these, in order</Text>
          ) : null}
        </View>
        <RoutineRows
          templates={list.rotation}
          numbered
          others={list.others}
          toggle={
            list.toggle ? { expanded, total: list.total, onPress: () => setExpanded((e) => !e) } : undefined
          }
          busyId={busy}
          disabled={busy !== null}
          onStart={startRoutine}
          onOpen={openRoutine}
          onMenu={routineMenu.openMenu}
        />
      </View>
    ) : null;

  // With no rotation: the saved routines out of it, as their own list.
  const otherList =
    others && others.length > 0 ? (
      <View style={styles.section}>
        <Text style={[type.exerciseName, { color: c.text }]}>Other routines</Text>
        <RoutineRows
          templates={others}
          busyId={busy}
          disabled={busy !== null}
          onStart={startRoutine}
          onOpen={openRoutine}
          onMenu={routineMenu.openMenu}
        />
      </View>
    ) : null;

  const saved =
    shownMine === undefined ? (
      <>
        <NextUpCardSkeleton />
        <RoutineRowsSkeleton count={2} />
      </>
    ) : hero ? (
      <>
        <NextUpCard
          template={hero}
          program={routineProgram(hero)}
          lastDone={hero.lastDone}
          eyebrow="Up next"
          lines={[routineMuscleSummary(hero), lastDoneLabel(hero.lastDone)]}
          onStart={() => startRoutine(hero)}
          onPress={() => openRoutine(hero)}
          onLongPress={() => routineMenu.openMenu(hero)}
          onMore={() => routineMenu.openMenu(hero)}
          busy={busy === hero.id}
          disabled={busy !== null}
        />
        {rotationSection}
      </>
    ) : null;

  const startCard = (
    <View style={[styles.startCard, cardSurface(scheme, c)]}>
      {/* The clip lives on an inner view, so the pressed fill keeps the
          card's corners without cutting its shadow. */}
      <View style={styles.startClip}>
        <StartRow
          icon={{ ios: 'plus', android: 'add' }}
          glyph="+"
          title="Start empty workout"
          sub="Add exercises as you go"
          busy={busy === 'empty'}
          disabled={busy !== null}
          onPress={() => void startEmpty()}
        />
        <View style={[styles.hairline, { backgroundColor: c.border }]} />
        <StartRow
          icon={{ ios: 'pencil', android: 'edit' }}
          glyph="✎"
          title="Build a routine"
          sub="Plan exercises, sets and reps ahead"
          busy={busy === 'build'}
          disabled={busy !== null}
          onPress={() => void openBuilder()}
        />
      </View>
    </View>
  );

  // A match with no programs renders nothing, so it gets no skeleton either.
  const findRoutine =
    !starter || starter.programs.length > 0 ? (
      <Reveal ready={starter != null} skeleton={<ProgramGridSkeleton title="Find a routine" />}>
        {() => (
          <ProgramGrid
            title="Find a routine"
            match={starter!}
            art={art}
            prefs={prefs!}
            disabled={busy !== null}
            onSeeAll={() => router.push(navHref({ kind: 'routines' }))}
          />
        )}
      </Reveal>
    ) : null;

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScreenHeader title="Workout" trailing={<HeaderWorkoutButton resumeOnly disabled={busy !== null} />} />
      <ScrollView {...scrollInsetProps} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {saved}
        {/* With nothing in the rotation, Find a routine leads the screen. */}
        {shownMine !== undefined && !hero ? (
          <>
            {findRoutine}
            {startCard}
            {otherList}
          </>
        ) : (
          <>
            {startCard}
            {findRoutine}
          </>
        )}

        <Pressable
          onPress={() => router.push(navHref({ kind: 'exercises' }))}
          accessibilityRole="button"
          accessibilityLabel={exerciseCount ? `Exercise library, ${exerciseCount} exercises` : 'Exercise library'}
          style={({ pressed }) => [
            styles.libraryCard,
            cardSurface(scheme, c),
            pressed && [styles.pressed, pressedFlat],
          ]}>
          <View style={styles.libraryText}>
            <Text style={[type.exerciseName, styles.centered, { color: c.text }]}>Exercise library</Text>
            {exerciseCount ? (
              <Text style={[type.meta, styles.count, styles.centered, { color: c.text2 }]}>
                {exerciseCount} exercises
              </Text>
            ) : null}
          </View>
          {/* Pinned to the right edge, centred on the card's height. */}
          <View style={styles.libraryChevron} pointerEvents="none">
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right' }}
              size={13}
              weight="semibold"
              tintColor={c.text3}
              fallback={<Text style={[styles.chevron, { color: c.text3 }]}>›</Text>}
            />
          </View>
        </Pressable>
      </ScrollView>
      {routineMenu.sheets}
      <ReorderListModal
        visible={reordering}
        title="Your rotation"
        items={rotation ?? []}
        keyOf={(t) => t.id}
        onDone={(ordered) => void saveOrder(ordered)}
        renderItem={(t) => (
          <View style={styles.listRowText}>
            <Text style={[type.exerciseName, { color: c.text }]} numberOfLines={1}>
              {t.name}
            </Text>
            <Text style={[type.meta, styles.count, { color: c.text2 }]} numberOfLines={1}>
              {routineRowMeta(t)}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

/** One row of the start card: an icon in the accent-soft circle, a title and a sub-line. */
function StartRow({
  icon,
  glyph,
  title,
  sub,
  busy,
  disabled,
  onPress,
}: {
  icon: { ios: SFSymbol; android: AndroidSymbol };
  /** The icon's text fallback. */
  glyph: string;
  title: string;
  sub: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const c = useTheme().colors;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={sub}
      accessibilityState={{ busy, disabled }}
      style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: c.surface2 }]}>
      <View style={[styles.plus, { backgroundColor: c.accentSoft }]}>
        {busy ? (
          <ActivityIndicator size="small" color={c.accentText} />
        ) : (
          <SymbolView
            name={icon}
            size={16}
            weight="semibold"
            tintColor={c.accentText}
            fallback={<Text style={[styles.plusGlyph, { color: c.accentText }]}>{glyph}</Text>}
          />
        )}
      </View>
      <View style={styles.listRowText}>
        <Text style={[type.exerciseName, { color: c.text }]}>{title}</Text>
        <Text style={[type.meta, { color: c.text2 }]}>{sub}</Text>
      </View>
    </Pressable>
  );
}

/** The chevron's width and its gap from the text. */
const CHEVRON_ROOM = 20;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.xl, paddingBottom: SCROLL_END_PADDING },
  section: { gap: spacing.md },
  headBlock: { gap: 2 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.card,
  },
  startCard: { borderRadius: radius.card },
  startClip: { borderRadius: radius.card, overflow: 'hidden' },
  hairline: { height: StyleSheet.hairlineWidth, marginLeft: spacing.card },
  libraryCard: {
    borderRadius: radius.card,
    padding: spacing.card,
    // Room for the chevron on both sides, so the text centres on the card.
    paddingHorizontal: spacing.card + CHEVRON_ROOM,
    justifyContent: 'center',
  },
  libraryText: { alignItems: 'center', gap: 2 },
  libraryChevron: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: spacing.card,
    justifyContent: 'center',
  },
  centered: { textAlign: 'center' },
  listRowText: { flex: 1, gap: 2 },
  plus: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  plusGlyph: { fontSize: 20, lineHeight: 22, fontWeight: '600' },
  count: { fontVariant: ['tabular-nums'] },
  chevron: { fontSize: 20, lineHeight: 22 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
