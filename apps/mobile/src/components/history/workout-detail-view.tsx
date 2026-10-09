import { formatDuration, routineFromWorkout } from '@liftcamp/shared';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { SheetRef } from '@/components/BottomSheet';
import { useAuth } from '@/components/auth-provider';
import { ExerciseInfoSheet } from '@/components/exercise-info-sheet';
import { ExerciseThumb } from '@/components/exercise-media';
import { SaveRoutineSheet } from '@/components/history/save-routine-sheet';
import { SetTable, SetTableSkeleton } from '@/components/history/set-table';
import { Reveal, Skeleton, SkeletonText } from '@/components/skeleton';
import { useStartGate } from '@/components/start-gate';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { getPrSetIds, getWorkoutDetail, type DetailExercise, type WorkoutDetail } from '@/data/history';
import { repeatWorkout } from '@/data/home';
import { getBodyweight, type ExerciseInfo } from '@/data/workouts';
import { markScreen } from '@/lib/launch-timing';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';

/** Same header thumbnail size as the active workout's exercise card. */
const THUMB = 40;

/** "Wednesday, September 9 · 6:40 PM", from the local date. US English whatever the device. */
function dateLine(workoutDate: string, createdAt: string): string {
  // Local midnight, not `new Date(iso)`, which parses as UTC.
  const d = new Date(`${workoutDate}T00:00:00`);
  const day = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const time = new Date(createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

/**
 * One finished workout, read-only. Reached from a history row, the Last
 * workout card on Home, and from an exercise's records and sessions.
 * Editing, deleting, photos and sharing are later sessions; this shows
 * what happened. Under the stats, Repeat (the primary action) and Save
 * routine, which shows only when some set was completed.
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
  const infoRef = useRef<SheetRef>(null);
  const [infoExercise, setInfoExercise] = useState<ExerciseInfo | null>(null);
  const saveRef = useRef<SheetRef>(null);

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
  }, [userId, id, router, weightUnit, unitLoading]);

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
        { name: source.name, exercises: source.exercises.map((we) => ({ exercise: we.exercise, setCount: we.sets.length })) },
        weightUnit,
      );
      setBusy(false);
      if (newId) router.push({ pathname: '/workout/[id]', params: { id: newId } });
      else Alert.alert('Could not start that workout.', 'Try again.');
    });
    setBusy(false);
  }

  const title = workout?.name?.trim() || 'Workout';
  // What Save routine would write. Empty hides the button.
  const routine = useMemo(
    () =>
      routineFromWorkout(
        (workout?.exercises ?? []).map((we) => ({ exerciseId: we.exercise.id, sets: we.sets })),
      ),
    [workout],
  );

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ title: workout ? title : '' }} />

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
                <Stat label="Volume" value={`${Math.round(workout.volume).toLocaleString()} ${unit}`} c={c} />
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
                {routine.length > 0 ? (
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
        initialName={title}
        exercises={routine}
        onSaved={(name) => Alert.alert('Routine saved', `${name} is in Your routines on Workout.`)}
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
      <SetTable sets={we.sets} weightType={we.exercise.weight_type} unit={unit} prSetIds={prSetIds} />
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
  // Equal halves of the row; Repeat takes it all when Save routine is hidden.
  action: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.8 },
});
