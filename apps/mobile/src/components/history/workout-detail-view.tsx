import { formatDuration, isCardio, routineFromWorkout, workingSetCount, workStat } from '@liftcamp/shared';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { SheetRef } from '@/components/BottomSheet';
import { useAuth } from '@/components/auth-provider';
import { ExerciseInfoSheet } from '@/components/exercise-info-sheet';
import { ExerciseThumb } from '@/components/exercise-media';
import { confirmDeleteWorkout } from '@/components/history/delete-workout';
import { SaveRoutineSheet } from '@/components/history/save-routine-sheet';
import { SetTable, SetTableSkeleton } from '@/components/history/set-table';
import { confirmUpdateRoutine, useRoutineUpdate } from '@/components/history/update-routine';
import { Reveal, Skeleton, SkeletonText } from '@/components/skeleton';
import { useStartGate } from '@/components/start-gate';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { getPrSetIds, getWorkoutDetail, type DetailExercise, type WorkoutDetail } from '@/data/history';
import { repeatWorkout } from '@/data/home';
import { getBodyweight, type ExerciseInfo } from '@/data/workouts';
import { chooseOption } from '@/lib/action-sheet';
import { markScreen } from '@/lib/launch-timing';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
import { dateLine } from '@/lib/workout-date-line';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';

/** Same header thumbnail size as the active workout's exercise card. */
const THUMB = 40;

/**
 * One finished workout. Reached from a history row, the Last workout card
 * on Home, and from an exercise's records and sessions. Photos and sharing
 * are later sessions. Under the stats, Repeat (the primary action) and
 * beside it:
 *
 * - Save routine, for a workout not started from a routine, when some set
 *   was completed.
 * - Update routine, for one started from a routine the user owns, when it
 *   added, removed or replaced an exercise and is that routine's most
 *   recent finished workout (useRoutineUpdate). An older workout would
 *   overwrite newer changes.
 * - Otherwise nothing, and Repeat takes the row.
 *
 * The header's ellipsis, for the owner only, opens Edit workout and Delete
 * workout. Edit opens the workout screen in edit mode
 * (`/workout/[id]?mode=edit`); its Save queues the changes, and the read
 * on focus shows them here at once, from the queue when there is no
 * signal. After Delete's confirm the delete is queued and the screen pops
 * back to wherever it was opened from, which reads again without the
 * workout.
 *
 * A component rather than a route so two stacks can host it: Profile's
 * `profile/workout/[id]` and Workout's `train/workout/[id]`, so a workout
 * opened from an exercise stays in that tab and Back returns to the
 * exercise.
 */
export function WorkoutDetailView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { guardStart } = useStartGate();
  const router = useRouter();
  const { scheme, colors: c } = useTheme();
  const { label: unit, unit: weightUnit, loading: unitLoading } = useWeightUnit();
  const userId = session?.user.id;

  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  // Null while loading and when the scan was abandoned; either way no ribbon.
  const [prSetIds, setPrSetIds] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const infoRef = useRef<SheetRef>(null);
  const [infoExercise, setInfoExercise] = useState<ExerciseInfo | null>(null);
  const saveRef = useRef<SheetRef>(null);
  const { update: routineUpdate, onUpdated: onRoutineUpdated } = useRoutineUpdate(userId, workout, {
    latestOnly: true,
  });
  const [updatingRoutine, setUpdatingRoutine] = useState(false);
  // Bumped when the screen comes back into focus, so an edit saved over it
  // shows on return. The first focus is the mount, which loads anyway.
  const [focusLoads, setFocusLoads] = useState(0);
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) setFocusLoads((n) => n + 1);
      focusedOnce.current = true;
    }, []),
  );

  useEffect(() => {
    markScreen('history-detail', 'open');
  }, []);

  useEffect(() => {
    if (!userId || !id || unitLoading) return;
    let cancelled = false;
    (async () => {
      // Bodyweight scores bodyweight exercises in both the volume and the PR
      // pass, but only after each has fetched, so all three run at once and
      // the other two take it pending. It is usually cached.
      const bodyweight = getBodyweight(userId);
      const [detail, prs] = await Promise.all([
        getWorkoutDetail(userId, id, bodyweight, weightUnit),
        getPrSetIds(userId, bodyweight, weightUnit),
      ]);
      if (cancelled) return;
      if (!detail) {
        // Unknown id, someone else's workout, or not finished. Nothing to
        // show, so back to wherever this was opened from.
        router.back();
        return;
      }
      setWorkout(detail);
      setPrSetIds(prs);
      markScreen('history-detail', 'content');
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, id, router, weightUnit, unitLoading, focusLoads]);

  function openInfo(exercise: ExerciseInfo) {
    setInfoExercise(exercise);
    infoRef.current?.present();
  }

  /** Through the start gate: a guest's second workout waits behind the create-account sheet. */
  async function onRepeat() {
    if (!userId || !workout || busy) return;
    const source = workout;
    setBusy(true);
    await guardStart(async () => {
      setBusy(true);
      const newId = await repeatWorkout(
        userId,
        {
          name: source.name,
          templateId: source.templateId,
          exercises: source.exercises.map((we) => ({ exercise: we.exercise, setCount: workingSetCount(we.sets) })),
        },
        weightUnit,
      );
      setBusy(false);
      if (newId) router.push({ pathname: '/workout/[id]', params: { id: newId } });
      else Alert.alert('Could not start that workout.', 'Try again.');
    });
    setBusy(false);
  }

  async function onUpdateRoutine() {
    if (!userId || !routineUpdate || updatingRoutine) return;
    setUpdatingRoutine(true);
    const ok = await confirmUpdateRoutine(userId, routineUpdate);
    setUpdatingRoutine(false);
    if (ok) onRoutineUpdated();
  }

  function openMenu() {
    chooseOption(
      [
        { label: 'Edit workout', value: 'edit' as const },
        { label: 'Delete workout', value: 'delete' as const, destructive: true },
      ],
      (choice) => {
        if (choice === 'edit') onEdit();
        else void onDelete();
      },
    );
  }

  function onEdit() {
    if (!workout) return;
    router.push({ pathname: '/workout/[id]', params: { id: workout.id, mode: 'edit' } });
  }

  async function onDelete() {
    if (!userId || !workout || deleting) return;
    setDeleting(true);
    const deleted = await confirmDeleteWorkout(userId, workout.id);
    setDeleting(false);
    if (deleted) router.back();
  }

  // RLS holds anyway; the menu shows only to the workout's owner.
  const isOwner = workout != null && userId != null && workout.userId === userId;

  const title = workout?.name?.trim() || 'Workout';
  // What Save routine would write. Empty hides the button, and so does a
  // link to a routine: that workout gets Update routine or nothing.
  const routine = useMemo(
    () =>
      routineFromWorkout(
        (workout?.exercises ?? []).map((we) => ({
          exerciseId: we.exercise.id,
          sets: we.sets,
          cardio: isCardio(we.exercise),
        })),
      ),
    [workout],
  );

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <Stack.Screen
        options={{
          title: workout ? title : '',
          headerRight: isOwner
            ? () => (
                <Pressable
                  onPress={openMenu}
                  disabled={deleting}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Workout options"
                  style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}>
                  {/* The exercise card's vertical ellipsis: SF Symbols has no
                      bare `ellipsis.vertical`, so `ellipsis` turned 90°. */}
                  <SymbolView
                    name={{ ios: 'ellipsis', android: 'more_horiz' }}
                    size={22}
                    weight="bold"
                    tintColor={c.accentText}
                    style={styles.menuSymbol}
                    fallback={<Text style={[styles.menuGlyph, { color: c.accentText }]}>⋮</Text>}
                  />
                </Pressable>
              )
            : undefined,
        }}
      />

      <Reveal ready={workout != null} skeleton={<DetailSkeleton />} style={styles.fill}>
        {() =>
          workout && (
            <ScrollView
              {...scrollInsetProps}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}>
              <Text style={[type.meta, { color: c.text2 }]}>
                {dateLine(workout.workoutDate, workout.createdAt)}
              </Text>

              <View style={styles.stats}>
                <Stat label="Time" value={formatDuration(workout.createdAt, workout.finishedAt)} c={c} />
                <Stat {...workStat(workout.volume, workout.cardioSeconds, unit)} c={c} />
                <Stat label="Sets" value={String(workout.completedSets)} c={c} />
              </View>

              <View style={styles.actions}>
                <Pressable
                  onPress={() => void onRepeat()}
                  disabled={busy}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.action,
                    { backgroundColor: c.accent, borderColor: c.accent },
                    (pressed || busy) && styles.pressed,
                  ]}>
                  <Text style={[type.button, { color: '#FFFFFF' }]}>{busy ? '…' : 'Repeat'}</Text>
                </Pressable>
                {!workout.templateId && routine.length > 0 ? (
                  <Pressable
                    onPress={() => saveRef.current?.present()}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.action,
                      { backgroundColor: c.surface, borderColor: c.border },
                      pressed && styles.pressed,
                    ]}>
                    <Text style={[type.button, { color: c.text }]}>Save routine</Text>
                  </Pressable>
                ) : routineUpdate ? (
                  <Pressable
                    onPress={() => void onUpdateRoutine()}
                    disabled={updatingRoutine}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.action,
                      { backgroundColor: c.surface, borderColor: c.border },
                      (pressed || updatingRoutine) && styles.pressed,
                    ]}>
                    <Text style={[type.button, { color: c.text }]}>Update routine</Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Photo strip goes here, between the stats and the note, when
                  photos arrive with the post-workout summary session. */}

              {workout.notes?.trim() ? (
                <View style={[styles.note, { backgroundColor: c.surface2 }]}>
                  <Text style={[type.meta, { color: c.text }]}>{workout.notes.trim()}</Text>
                </View>
              ) : null}

              {workout.exercises.map((we) => (
                <ExerciseBlock
                  key={we.id}
                  we={we}
                  unit={unit}
                  prSetIds={prSetIds}
                  onOpenInfo={() => openInfo(we.exercise)}
                />
              ))}

            </ScrollView>
          )
        }
      </Reveal>

      <ExerciseInfoSheet ref={infoRef} exercise={infoExercise} />
      <SaveRoutineSheet
        ref={saveRef}
        userId={userId}
        workoutId={workout?.id ?? id}
        initialName={title}
        exercises={routine}
        onSaved={(name, routineId) => {
          // Mirrors the stamp saveWorkoutAsRoutine writes, so a Repeat
          // tapped now carries the link.
          setWorkout((w) =>
            w && !w.templateId
              ? { ...w, templateId: routineId, name: w.name?.trim() ? w.name : name }
              : w,
          );
          Alert.alert('Routine saved', `${name} is in your routines on Workout.`);
        }}
      />
    </View>
  );
}

/**
 * The detail's shape before it loads: the date line, three stats, and two
 * exercise cards with a few set rows each.
 */
function DetailSkeleton() {
  const { scheme, colors: c } = useTheme();
  return (
    <ScrollView
      scrollEnabled={false}
      {...scrollInsetProps}
      contentContainerStyle={styles.content}>
      <SkeletonText variant={type.meta} width="58%" />
      <View style={styles.stats}>
        {[52, 76, 28].map((w, i) => (
          <View key={i} style={styles.stat}>
            <SkeletonText variant={type.restTime} width={w} />
            <SkeletonText variant={type.label} width={34} />
          </View>
        ))}
      </View>
      {[3, 4].map((rows, i) => (
        <View key={i} style={[styles.card, cardSurface(scheme, c)]}>
          <View style={styles.head}>
            <Skeleton width={THUMB} height={THUMB} radius={radius.input} />
            <SkeletonText variant={type.exerciseName} width={i === 0 ? '52%' : '64%'} />
          </View>
          <SetTableSkeleton rows={rows} />
        </View>
      ))}
    </ScrollView>
  );
}

/** Same numeral-over-label cell as the Home card's stats. */
function Stat({ label, value, c }: { label: string; value: string; c: { text: string; text3: string } }) {
  return (
    <View style={styles.stat}>
      <Text style={[type.restTime, { color: c.text }]}>{value}</Text>
      <Text style={[type.label, { color: c.text3 }]}>{label}</Text>
    </View>
  );
}

/** One exercise: a tappable header that opens the info sheet, then its set table. */
function ExerciseBlock({
  we,
  unit,
  prSetIds,
  onOpenInfo,
}: {
  we: DetailExercise;
  unit: string;
  prSetIds: Set<string> | null;
  onOpenInfo: () => void;
}) {
  const { scheme, colors: c } = useTheme();
  return (
    <View style={[styles.card, cardSurface(scheme, c)]}>
      <Pressable
        onPress={onOpenInfo}
        accessibilityRole="button"
        accessibilityLabel={`About ${we.exercise.name}`}
        style={({ pressed }) => [styles.head, pressed && styles.headPressed]}>
        <ExerciseThumb exercise={we.exercise} size={THUMB} />
        <Text style={[type.exerciseName, styles.headName, { color: c.text }]} numberOfLines={2}>
          {we.exercise.name}
        </Text>
      </Pressable>
      <SetTable
        sets={we.sets}
        weightType={we.exercise.weight_type}
        unit={unit}
        prSetIds={prSetIds}
        cardio={isCardio(we.exercise)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.lg, paddingBottom: SCROLL_END_PADDING },
  stats: { flexDirection: 'row', gap: spacing.xl },
  stat: { gap: 2 },
  note: { borderRadius: radius.input, padding: spacing.md },
  card: { borderRadius: radius.card, padding: spacing.card, gap: spacing.sm },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // Bleed into the card padding so the pressed tint has room, then pad
    // back, so the content does not move. Same as the active card's header.
    marginLeft: -spacing.sm,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.input,
  },
  headPressed: { opacity: 0.6 },
  headName: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.md },
  // Equal halves of the row; Repeat takes it all when the second action is hidden.
  action: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.8 },
  menuButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  menuSymbol: { width: 22, height: 22, transform: [{ rotate: '90deg' }] },
  menuGlyph: { fontSize: 22, lineHeight: 24, fontWeight: '700' },
});
