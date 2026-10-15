import { routineArtByProgram, type TemplateRow } from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { HeaderWorkoutButton } from '@/components/header-workout-button';
import { ProgramRow, ProgramRowSkeleton } from '@/components/home/program-row';
import { RoutineCardSkeleton } from '@/components/home/routine-card';
import {
  confirmRemoveRoutine,
  SavedRoutineGroups,
  savedRoutineGroups,
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
import { peekAllExercises, searchExercises } from '@/data/workouts';
import { networkFailedSince } from '@/lib/network';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, pressedFlat, radius, spacing, type } from '@/theme/tokens';

/**
 * The Workout tab (docs/social-spec.md, Navigation):
 * three sections on one screen, with the header's "+ Workout" or "Resume"
 * pill for an empty workout.
 *
 * - Saved routines, every day of each,
 *   with the same Start, long-press menu and trash. Next up stays on Home.
 * - Programs, the starter row Home shows too: up to six programs matched
 *   to the profile's level and equipment, then a See all tile. See all
 *   pushes the full browser on this stack.
 * - Exercises, one row with the library's count, which pushes the library
 *   (search and the four filters) on this stack.
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
  // The routine id whose start runs; any value disables every Start.
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

  const routineMenu = useRoutineMenu({ userId, reload: load });

  const shownMine = useMemo(() => {
    if (!mine) return undefined;
    const removed = new Set(removedIds);
    return mine.filter((t) => !removed.has(t.id));
  }, [mine, removedIds]);
  const hasRoutine = !!shownMine && shownMine.length > 0;
  const art = useMemo(() => routineArtByProgram(system ?? []), [system]);
  const starter = system && prefs ? home.starterPrograms(system, prefs) : null;

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

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScreenHeader title="Workout" trailing={<HeaderWorkoutButton disabled={busy !== null} />} />
      <ScrollView {...scrollInsetProps} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {shownMine === undefined ? (
          <View style={styles.section}>
            <Text style={[type.exerciseName, { color: c.text }]}>Your routines</Text>
            <RoutineCardSkeleton nameWidth="55%" />
          </View>
        ) : hasRoutine ? (
          <View style={styles.section}>
            <Text style={[type.exerciseName, { color: c.text }]}>Your routines</Text>
            <SavedRoutineGroups
              groups={savedRoutineGroups(home.groupUserTemplates(shownMine))}
              busyId={busy}
              disabled={busy !== null}
              onStart={(t) => void run(t.id, () => home.startFromTemplate(userId!, t, weightUnit))}
              onMenu={routineMenu.openMenu}
              onRemove={(program, ids) => confirmRemoveRoutine(program, () => void removeRoutine(ids))}
            />
          </View>
        ) : null}

        {/* A match with no programs renders nothing, so it gets no skeleton either. */}
        {!starter || starter.programs.length > 0 ? (
          <Reveal ready={starter != null} skeleton={<ProgramRowSkeleton title="Routines" />}>
            {() => (
              <ProgramRow
                title="Routines"
                match={starter!}
                art={art}
                prefs={prefs!}
                disabled={busy !== null}
                onUse={async (g) => {
                  if (!userId) return false;
                  const ok = await home.saveProgramCopy(userId, g);
                  if (ok) await load();
                  return ok;
                }}
                onSeeAll={() => router.push(navHref({ kind: 'routines' }))}
              />
            )}
          </Reveal>
        ) : null}

        <Pressable
          onPress={() => router.push(navHref({ kind: 'exercises' }))}
          accessibilityRole="button"
          accessibilityLabel={exerciseCount ? `Exercise library, ${exerciseCount} exercises` : 'Exercise library'}
          style={({ pressed }) => [
            styles.exercisesRow,
            cardSurface(scheme, c),
            pressed && [styles.pressed, pressedFlat],
          ]}>
          <View style={styles.exercisesText}>
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
  exercisesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.card,
    padding: spacing.card,
  },
  exercisesText: { flex: 1, gap: 2 },
  count: { fontVariant: ['tabular-nums'] },
  chevron: { fontSize: 20, lineHeight: 22 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
