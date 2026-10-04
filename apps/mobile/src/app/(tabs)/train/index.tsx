import { routineArtByProgram, type TemplateRow } from '@liftcamp/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { ExerciseLibrary } from '@/components/exercises/exercise-library';
import { HeaderWorkoutButton } from '@/components/header-workout-button';
import { RoutineCardSkeleton } from '@/components/home/routine-card';
import {
  confirmRemoveRoutine,
  SavedRoutineGroups,
  savedRoutineGroups,
  useRoutineMenu,
} from '@/components/home/saved-routines';
import { StarterRoutines, StarterRoutinesSkeleton } from '@/components/home/starter-routines';
import { ScreenHeader } from '@/components/screen-header';
import { Reveal } from '@/components/skeleton';
import { useStartGate } from '@/components/start-gate';
import { useNavHref } from '@/components/tab-layout';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { getLastDoneDates } from '@/data/exercise-progress';
import * as home from '@/data/home';
import type { HomeTemplate, TrainingPrefs } from '@/data/home';
import { networkFailedSince } from '@/lib/network';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

/**
 * The Workout tab, with the social flag (docs/social-spec.md, Navigation):
 * the saved routines, the programs and the exercise library as sections
 * of one list, with the header's "+ Workout" or "Resume" pill for an empty
 * workout.
 *
 * - Saved routines are Home's list without the flag, every day of each,
 *   with the same Start, long-press menu and trash. Next up stays on Home.
 * - Programs is Home's starter grid, matched to the profile's level and
 *   equipment, and See all pushes the full browser on this stack.
 * - The library is the Exercises tab's; a row pushes the exercise here.
 *
 * Reads on focus. The saved routines and the prefs start from Home's last
 * full load, so the tab draws them at once and keeps them with no signal.
 * Routines removed on the phone and not yet synced stay hidden.
 */
export default function WorkoutTab() {
  const { session } = useAuth();
  const router = useRouter();
  const navHref = useNavHref();
  const c = useColors();
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
  const [lastDone, setLastDone] = useState<Map<string, string>>(new Map());
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
      getLastDoneDates(userId).then((m) => {
        if (gen === loadGen.current) setLastDone(m);
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

  const header = (
    <View style={styles.sections}>
      {shownMine === undefined ? (
        <View style={styles.section}>
          <Text style={[type.exerciseName, { color: c.text }]}>Saved routines</Text>
          <RoutineCardSkeleton nameWidth="55%" />
        </View>
      ) : hasRoutine ? (
        <View style={styles.section}>
          <Text style={[type.exerciseName, { color: c.text }]}>Saved routines</Text>
          <SavedRoutineGroups
            groups={savedRoutineGroups(home.groupUserTemplates(shownMine))}
            busyId={busy}
            disabled={busy !== null}
            onStart={(t) => void run(t.id, () => home.startFromTemplate(userId!, t, weightUnit))}
            onMenu={routineMenu.openMenu}
            onRemove={(program, ids) => confirmRemoveRoutine(program, false, () => void removeRoutine(ids))}
          />
        </View>
      ) : null}

      {!starter || starter.programs.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[type.exerciseName, { color: c.text }]}>Programs</Text>
            <Pressable onPress={() => router.push(navHref({ kind: 'routines' }))} hitSlop={8}>
              <Text style={[type.button, { color: c.accentText, fontSize: 14 }]}>See all</Text>
            </Pressable>
          </View>
          {/* Waits for the saved routines too: they decide whether the grid
              starts open, which it reads only when it mounts. */}
          <Reveal ready={starter != null && shownMine !== undefined} skeleton={<StarterRoutinesSkeleton />}>
            {() => (
              <StarterRoutines
                match={starter!}
                art={art}
                prefs={prefs!}
                defaultOpen={!hasRoutine}
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
        </View>
      ) : null}

      <Text style={[type.exerciseName, { color: c.text }]}>Exercises</Text>
    </View>
  );

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScreenHeader title="Workout" trailing={<HeaderWorkoutButton disabled={busy !== null} />} />
      <ExerciseLibrary
        lastDone={lastDone}
        onSelect={(e) => router.push(navHref({ kind: 'exercise', id: e.id }))}
        header={header}
      />
      {routineMenu.sheets}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sections: { gap: spacing.xl, paddingBottom: spacing.xs },
  section: { gap: spacing.md },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
