import { groupPrograms, routineProgram, type RoutineLastDone, type TemplateRow } from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import {
  PrimaryAction,
  ProgramDetail,
  RoutineActions,
  SavedRoutineDetail,
} from '@/components/home/routine-detail';
import { confirmRemoveRoutine, useRoutineMenu } from '@/components/home/saved-routines';
import { SkeletonText } from '@/components/skeleton';
import { useStartGate } from '@/components/start-gate';
import { useNavHref } from '@/components/tab-layout';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import * as home from '@/data/home';
import type { HomeTemplate } from '@/data/home';
import { getRoutineLastDone } from '@/data/routine-detail';
import { getBodyweight } from '@/data/workouts';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

/**
 * The routine detail screens (docs/workout-tab-spec.md, Routine detail
 * screen), pushed on Workout's stack and on Home's: `routine/[id]` for a
 * saved day and `program/[name]` for a starter. Components rather than
 * routes so both stacks can host them, like WorkoutDetailView.
 *
 * Start and Use routine sit under the meta lines, inside the scroll,
 * where the workout detail keeps Repeat: a footer pinned to the bottom
 * would sit under the floating tab bar.
 */

/**
 * One saved day. Opens from the last read of the saved routines, so it
 * draws at once from the Workout tab, then reads them again and the last
 * time the day was done. The header's ⋯ is the routine menu: Remove takes
 * the whole routine and pops back.
 */
export function SavedRoutineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const router = useRouter();
  const navHref = useNavHref();
  const c = useColors();
  const { guardStart } = useStartGate();
  const { unit, label: unitLabel } = useWeightUnit();

  // Undefined until read; null once the read finds no such routine.
  const [template, setTemplate] = useState<HomeTemplate | null | undefined>(() =>
    userId ? home.peekUserTemplate(userId, id) : undefined,
  );
  const [all, setAll] = useState<HomeTemplate[]>([]);
  const [last, setLast] = useState<RoutineLastDone | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    await Promise.all([
      home.getUserTemplates(userId).then((rows) => {
        setAll(rows);
        setTemplate((prev) => rows.find((t) => t.id === id) ?? (rows.length > 0 ? null : (prev ?? null)));
      }),
      getRoutineLastDone(userId, id, unit, getBodyweight(userId)).then(setLast),
    ]);
  }, [userId, id, unit]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function askRemove(t: HomeTemplate) {
    const program = routineProgram(t);
    const ids = program ? all.filter((d) => routineProgram(d) === program).map((d) => d.id) : [t.id];
    confirmRemoveRoutine(program ?? t.name, () => void remove(ids.length > 0 ? ids : [t.id]));
  }

  async function remove(ids: string[]) {
    if (!userId) return;
    const saved = await home.removeRoutine(userId, ids);
    if (!saved) {
      Alert.alert('Could not remove that routine.', 'Try again.');
      return;
    }
    router.back();
  }

  const routineMenu = useRoutineMenu({ userId, reload: load, onRemove: askRemove });

  async function start() {
    if (!userId || !template || busy) return;
    setBusy(true);
    await guardStart(async () => {
      setBusy(true);
      const workoutId = await home.startFromTemplate(userId, template, unit);
      setBusy(false);
      if (workoutId) router.push({ pathname: '/workout/[id]', params: { id: workoutId } });
      else Alert.alert('Could not start that workout.', 'Try again.');
    });
    setBusy(false);
  }

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <Stack.Screen
        options={{
          title: template?.name ?? '',
          headerRight: template
            ? () => (
                <Pressable
                  onPress={() => routineMenu.openMenu(template)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`More for ${template.name}`}
                  style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}>
                  <SymbolView
                    name={{ ios: 'ellipsis', android: 'more_horiz' }}
                    size={22}
                    weight="bold"
                    tintColor={c.accentText}
                    fallback={<Text style={[styles.menuGlyph, { color: c.accentText }]}>⋯</Text>}
                  />
                </Pressable>
              )
            : undefined,
        }}
      />
      <ScrollView {...scrollInsetProps} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {template ? (
          <SavedRoutineDetail
            template={template}
            last={last}
            unit={unit}
            unitLabel={unitLabel}
            action={
              <RoutineActions>
                <PrimaryAction label="Start" onPress={() => void start()} busy={busy} />
              </RoutineActions>
            }
            onOpenExercise={(exerciseId) => router.push(navHref({ kind: 'exercise', id: exerciseId }))}
          />
        ) : template === null ? (
          <Text style={[type.meta, styles.gone, { color: c.text2 }]}>This routine is no longer in your routines.</Text>
        ) : (
          <DetailSkeleton />
        )}
      </ScrollView>
      {routineMenu.sheets}
    </View>
  );
}

/**
 * A starter routine, from the session's system routines. Use routine
 * saves every variation as the user's own and pops back to where it was
 * opened, which reads again with the routine in it.
 */
export function StarterRoutineScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const router = useRouter();
  const navHref = useNavHref();
  const c = useColors();

  const [system, setSystem] = useState<TemplateRow[] | undefined>(() => home.peekSystemTemplates());
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void home.getSystemTemplates().then((rows) => {
        if (live) setSystem(rows);
      });
      return () => {
        live = false;
      };
    }, []),
  );

  const group = useMemo(
    () => (system ? (groupPrograms(system.filter((t) => t.program?.trim() === name))[0] ?? null) : undefined),
    [system, name],
  );

  async function use() {
    if (!userId || !group || busy) return;
    setBusy(true);
    const ok = await home.saveProgramCopy(userId, group);
    setBusy(false);
    if (!ok) {
      Alert.alert('Could not save that routine.', 'Try again.');
      return;
    }
    Alert.alert('Saved', `${group.program} is in your routines on Workout.`);
    router.back();
  }

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ title: group?.program ?? name ?? '' }} />
      <ScrollView {...scrollInsetProps} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {group ? (
          <ProgramDetail
            group={group}
            action={
              <RoutineActions>
                <PrimaryAction label="Use routine" onPress={() => void use()} busy={busy} />
              </RoutineActions>
            }
            onOpenExercise={(exerciseId) => router.push(navHref({ kind: 'exercise', id: exerciseId }))}
          />
        ) : group === null ? (
          <Text style={[type.meta, styles.gone, { color: c.text2 }]}>This routine is not available.</Text>
        ) : (
          <DetailSkeleton />
        )}
      </ScrollView>
    </View>
  );
}

function DetailSkeleton() {
  return (
    <View style={styles.skeleton}>
      <SkeletonText variant={type.meta} width="64%" />
      <SkeletonText variant={type.meta} width="48%" />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.lg, paddingBottom: SCROLL_END_PADDING },
  skeleton: { gap: spacing.sm },
  gone: { fontSize: 15 },
  menuButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  menuGlyph: { fontSize: 22, lineHeight: 24, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
