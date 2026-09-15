import { formatDuration, formatSetWeight } from '@liftcamp/shared';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { SheetRef } from '@/components/BottomSheet';
import { useAuth } from '@/components/auth-provider';
import { ExerciseInfoSheet } from '@/components/exercise-info-sheet';
import { ExerciseThumb } from '@/components/exercise-media';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { PrRibbon } from '@/components/workout/pr-ribbon';
import { getPrSetIds, getWorkoutDetail, type DetailExercise, type WorkoutDetail } from '@/data/history';
import { repeatWorkout } from '@/data/home';
import { getBodyweight, type ExerciseInfo } from '@/data/workouts';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, COLUMNS, COLUMNS_BASE_WIDTH, radius, spacing, type } from '@/theme/tokens';

/** Same header thumbnail size as the active workout's exercise card. */
const THUMB = 40;

/** Dims a set the user left unchecked. It happened, it just was not done. */
const INCOMPLETE_OPACITY = 0.45;

/** "Wednesday, 9 September" and the start time, from the local date. */
function dateLine(workoutDate: string, createdAt: string): string {
  // Local midnight, not `new Date(iso)`, which parses as UTC.
  const d = new Date(`${workoutDate}T00:00:00`);
  const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
  const month = d.toLocaleDateString(undefined, { month: 'long' });
  const time = new Date(createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${weekday}, ${d.getDate()} ${month} · ${time}`;
}

/**
 * One finished workout, read-only. Reached from a history row or the Last
 * workout card on Home. Editing, deleting, photos and sharing are later
 * sessions; this screen shows what happened and offers Repeat.
 */
export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const { scheme, colors: c } = useTheme();
  const { label: unit } = useWeightUnit();
  const userId = session?.user.id;

  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  // Null while loading and when the scan was abandoned; either way no ribbon.
  const [prSetIds, setPrSetIds] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const infoRef = useRef<SheetRef>(null);
  const [infoExercise, setInfoExercise] = useState<ExerciseInfo | null>(null);

  useEffect(() => {
    if (!userId || !id) return;
    let cancelled = false;
    (async () => {
      // Bodyweight scores bodyweight exercises in both the volume and the PR
      // pass, so it comes first; the other two are independent of each other.
      const bodyweight = await getBodyweight(userId);
      const [detail, prs] = await Promise.all([
        getWorkoutDetail(userId, id, bodyweight),
        getPrSetIds(userId, bodyweight),
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
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, id, router]);

  function openInfo(exercise: ExerciseInfo) {
    setInfoExercise(exercise);
    infoRef.current?.present();
  }

  async function onRepeat() {
    if (!userId || !workout || busy) return;
    setBusy(true);
    const newId = await repeatWorkout(userId, workout);
    setBusy(false);
    if (newId) router.push({ pathname: '/workout/[id]', params: { id: newId } });
    else Alert.alert('Could not start that workout.', 'Try again.');
  }

  const title = workout?.name?.trim() || 'Workout';

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ title: workout ? title : '' }} />

      {!workout ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
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

          <Pressable
            onPress={() => void onRepeat()}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.repeat,
              { borderColor: c.accent },
              (pressed || busy) && styles.pressed,
            ]}>
            <Text style={[type.button, { color: c.accentText }]}>{busy ? '…' : 'Repeat'}</Text>
          </Pressable>
        </ScrollView>
      )}

      <ExerciseInfoSheet ref={infoRef} exercise={infoExercise} />
    </View>
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

/**
 * One exercise and its set table. The set column is the active screen's
 * `COLUMNS.set` scaled to this card's width, so the numbers sit where they
 * did while logging; the ribbon cell is the width of that screen's done
 * column. Weight and reps share the middle.
 */
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
  const [inner, setInner] = useState(0);
  const factor = inner > 0 ? inner / COLUMNS_BASE_WIDTH : 1;
  const setWidth = COLUMNS.set * factor;
  const prWidth = COLUMNS.done * factor;

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

      <View style={styles.table} onLayout={(e) => setInner(e.nativeEvent.layout.width)}>
        <View style={styles.columns}>
          <Text style={[type.label, styles.centerText, { color: c.text3, width: setWidth }]}>Set</Text>
          <Text style={[type.label, styles.fill, { color: c.text3 }]}>Weight & reps</Text>
          <View style={{ width: prWidth }} />
        </View>

        {we.sets.map((s, i) => {
          const isPr = s.completed && prSetIds != null && prSetIds.has(s.id);
          const reps = s.reps == null ? '' : `× ${s.reps}`;
          return (
            <View
              key={s.id}
              style={[
                styles.setRow,
                i % 2 === 1 && { backgroundColor: c.surface2 },
                !s.completed && styles.incomplete,
              ]}>
              <View style={styles.setLine}>
                <Text style={[type.prevNumeral, styles.centerText, { color: c.text3, width: setWidth }]}>
                  {i + 1}
                </Text>
                <Text style={[type.setNumeral, styles.fill, { color: c.text }]} numberOfLines={1}>
                  {formatSetWeight(s, we.exercise.weight_type, unit)}
                  {reps ? <Text style={[type.setNumeral, { color: c.text2 }]}> {reps}</Text> : null}
                </Text>
                <View style={[styles.prCell, { width: prWidth }]}>
                  {isPr ? <PrRibbon size={18} /> : null}
                </View>
              </View>
              {s.note?.trim() ? (
                <Text style={[type.meta, styles.setNote, { color: c.text2, marginLeft: setWidth }]}>
                  {s.note.trim()}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  content: { padding: spacing.screen, gap: spacing.lg },
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
  table: { gap: 2 },
  columns: { flexDirection: 'row', alignItems: 'center', paddingBottom: 2 },
  setRow: { borderRadius: radius.input, paddingVertical: spacing.sm },
  setLine: { flexDirection: 'row', alignItems: 'center' },
  prCell: { alignItems: 'center' },
  setNote: { paddingTop: spacing.xs, paddingRight: spacing.sm },
  incomplete: { opacity: INCOMPLETE_OPACITY },
  repeat: {
    alignSelf: 'center',
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  pressed: { opacity: 0.8 },
});
