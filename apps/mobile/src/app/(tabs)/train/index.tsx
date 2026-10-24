import {
  lastDoneLabel,
  routineArtByProgram,
  routineMuscleSummary,
  routineProgram,
  routinesByStaleness,
  type TemplateRow,
} from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { HeaderWorkoutButton } from '@/components/header-workout-button';
import { ProgramRow, ProgramRowSkeleton } from '@/components/home/program-row';
import { NextUpCard, NextUpCardSkeleton } from '@/components/home/routine-card';
import {
  confirmRemoveRoutine,
  RoutineRows,
  RoutineRowsSkeleton,
  useRoutineMenu,
} from '@/components/home/saved-routines';
import { ScreenHeader } from '@/components/screen-header';
import { Reveal } from '@/components/skeleton';
import { useStartGate } from '@/components/start-gate';
import { useNavHref } from '@/components/tab-layout';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import * as home from '@/data/home';
import type { HomeTemplate, TrainingPrefs } from '@/data/home';
import { peekAllExercises, searchExercises, startAdHocWorkout } from '@/data/workouts';
import { networkFailedSince } from '@/lib/network';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, pressedFlat, radius, spacing, type } from '@/theme/tokens';

/**
 * The Workout tab (docs/workout-tab-spec.md), one scroll, top to bottom:
 *
 * - Up next: the saved day done longest ago (`routinesByStaleness`), as a
 *   large card with the accent Start and a ⋯ for the routine menu.
 *   The card body, a row body and a starter tile push the routine's
 *   detail on this stack.
 * - Your routines: every other saved day, stalest first, as compact rows
 *   in one card. A day done today is dimmed. No trash here; Remove is in
 *   the routine menu (⋯ or a long press) and takes the whole routine.
 * - Start empty workout. The header pill shows only as Resume.
 * - Find a routine: the starter row, matched to the profile's level and
 *   equipment, with See all for the full browser on this stack.
 * - Exercise library, one row with the library's count.
 *
 * With no saved routine, Up next and Your routines are absent and Find a
 * routine leads. Every start goes through the start gate.
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
      void load();
    }, [load]),
  );

  const shownMine = useMemo(() => {
    if (!mine) return undefined;
    const removed = new Set(removedIds);
    return mine.filter((t) => !removed.has(t.id));
  }, [mine, removedIds]);
  const sorted = useMemo(() => (shownMine ? routinesByStaleness(shownMine) : undefined), [shownMine]);
  const hero = sorted?.[0];
  const rows = sorted?.slice(1) ?? [];
  const art = useMemo(() => routineArtByProgram(system ?? []), [system]);
  const starter = system && prefs ? home.starterPrograms(system, prefs) : null;

  /** Remove from the menu takes the whole routine: every saved day that shares its program. */
  function askRemove(t: HomeTemplate) {
    const program = routineProgram(t);
    const ids = program ? (shownMine ?? []).filter((d) => routineProgram(d) === program).map((d) => d.id) : [t.id];
    confirmRemoveRoutine(program ?? t.name, () => void removeRoutine(ids));
  }

  const routineMenu = useRoutineMenu({ userId, reload: load, onRemove: askRemove });

  /** Every start here, through the start gate, as on Home. */
  async function run(key: string, fn: () => Promise<string | null>) {
    if (!userId || busy) return;
    setBusy(key);
    await guardStart(async () => {
      setBusy(key);
      const id = await fn();
      setBusy(null);
      if (id) router.push({ pathname: '/workout/[id]', params: { id } });
      else Alert.alert('Could not start that workout.', 'Try again.');
    });
    setBusy(null);
  }

  function openRoutine(t: HomeTemplate) {
    router.push(navHref({ kind: 'routine', id: t.id }));
  }

  function startRoutine(t: HomeTemplate) {
    void run(t.id, () => home.startFromTemplate(userId!, t, weightUnit));
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

  const saved =
    sorted === undefined ? (
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
        {rows.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.head}>
              <Text style={[type.exerciseName, { color: c.text }]}>Your routines</Text>
              <Text style={[type.meta, { color: c.text3 }]}>Sorted by last done</Text>
            </View>
            <RoutineRows
              templates={rows}
              busyId={busy}
              disabled={busy !== null}
              onStart={startRoutine}
              onOpen={openRoutine}
              onMenu={routineMenu.openMenu}
            />
          </View>
        ) : null}
      </>
    ) : null;

  const emptyStart = (
    <Pressable
      onPress={() => void startEmpty()}
      disabled={busy !== null}
      accessibilityRole="button"
      accessibilityLabel="Start empty workout"
      accessibilityHint="Add exercises as you go, save it as a routine after"
      accessibilityState={{ busy: busy === 'empty', disabled: busy !== null }}
      style={({ pressed }) => [styles.listRow, cardSurface(scheme, c), pressed && [styles.pressed, pressedFlat]]}>
      <View style={[styles.plus, { backgroundColor: c.accentSoft }]}>
        {busy === 'empty' ? (
          <ActivityIndicator size="small" color={c.accentText} />
        ) : (
          <SymbolView
            name={{ ios: 'plus', android: 'add' }}
            size={16}
            weight="semibold"
            tintColor={c.accentText}
            fallback={<Text style={[styles.plusGlyph, { color: c.accentText }]}>+</Text>}
          />
        )}
      </View>
      <View style={styles.listRowText}>
        <Text style={[type.exerciseName, { color: c.text }]}>Start empty workout</Text>
        <Text style={[type.meta, { color: c.text2 }]}>Add exercises as you go, save it as a routine after</Text>
      </View>
    </Pressable>
  );

  // A match with no programs renders nothing, so it gets no skeleton either.
  const findRoutine =
    !starter || starter.programs.length > 0 ? (
      <Reveal ready={starter != null} skeleton={<ProgramRowSkeleton title="Find a routine" />}>
        {() => (
          <ProgramRow
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
        {/* With no saved routine, Find a routine leads the screen. */}
        {sorted !== undefined && !hero ? (
          <>
            {findRoutine}
            {emptyStart}
          </>
        ) : (
          <>
            {emptyStart}
            {findRoutine}
          </>
        )}

        <Pressable
          onPress={() => router.push(navHref({ kind: 'exercises' }))}
          accessibilityRole="button"
          accessibilityLabel={exerciseCount ? `Exercise library, ${exerciseCount} exercises` : 'Exercise library'}
          style={({ pressed }) => [
            styles.listRow,
            cardSurface(scheme, c),
            pressed && [styles.pressed, pressedFlat],
          ]}>
          <View style={styles.listRowText}>
            <Text style={[type.exerciseName, { color: c.text }]}>Exercise library</Text>
            {exerciseCount ? (
              <Text style={[type.meta, styles.count, { color: c.text2 }]}>{exerciseCount} exercises</Text>
            ) : null}
          </View>
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right' }}
            size={13}
            weight="semibold"
            tintColor={c.text3}
            fallback={<Text style={[styles.chevron, { color: c.text3 }]}>›</Text>}
          />
        </Pressable>
      </ScrollView>
      {routineMenu.sheets}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.xl, paddingBottom: SCROLL_END_PADDING },
  section: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.card,
    padding: spacing.card,
  },
  listRowText: { flex: 1, gap: 2 },
  plus: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  plusGlyph: { fontSize: 20, lineHeight: 22, fontWeight: '600' },
  count: { fontVariant: ['tabular-nums'] },
  chevron: { fontSize: 20, lineHeight: 22 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
