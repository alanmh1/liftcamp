import { feedNote, feedVolume, formatDuration, socialHandle, toUserUnit, type WeightUnit } from '@liftcamp/shared';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ExerciseThumb } from '@/components/exercise-media';
import { SetTable } from '@/components/history/set-table';
import { KudosButton } from '@/components/social/kudos-button';
import { InitialsAvatar } from '@/components/social/person-row';
import { useNavHref } from '@/components/tab-layout';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { PrRibbon } from '@/components/workout/pr-ribbon';
import { socialWorkout, type FriendWorkout, type FriendWorkoutExercise } from '@/data/social';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';

const THUMB = 40;

/** "Wednesday, September 9 · 6:40 PM", from the local date. US English whatever the device. */
function dateLine(workoutDate: string, createdAt: string): string {
  const d = new Date(`${workoutDate}T00:00:00`);
  const day = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const time = new Date(createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

/**
 * Another person's finished workout, read-only (social_workout). Pushed on
 * Home from a feed card and on Profile from a person's workouts.
 *
 * The same shape as the user's own detail without Repeat and Save routine:
 * who, when, the note in full, Time, Volume and Sets, kudos, then each
 * exercise with its sets in the viewer's unit, weight left and reps right.
 * The PR ribbon sits on the exercise, from what the owner's phone wrote at
 * finish; no per-set ribbons, since a friend cannot see the history they
 * are measured against.
 */
export function FriendWorkoutView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navHref = useNavHref();
  const { colors: c } = useTheme();
  const { label: unitLabel, unit: viewerUnit } = useWeightUnit();
  // Undefined while loading, null when it cannot be seen or the read failed.
  const [workout, setWorkout] = useState<FriendWorkout | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let cancelled = false;
      socialWorkout(id)
        .then((result) => {
          if (cancelled) return;
          if (result.ok) setWorkout(result.data ?? null);
          else setWorkout((held) => held ?? null);
        })
        .catch(() => {
          if (!cancelled) setWorkout((held) => held ?? null);
        });
      return () => {
        cancelled = true;
      };
    }, [id]),
  );

  const title = workout?.name?.trim() || 'Workout';
  const note = feedNote(workout?.note);
  const volume = workout ? feedVolume(workout, viewerUnit) : null;

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ title: workout ? title : '' }} />
      <ScrollView {...scrollInsetProps} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {workout === undefined ? (
          <ActivityIndicator style={styles.loading} />
        ) : workout === null ? (
          <Text style={[type.meta, styles.line, { color: c.text2 }]}>This workout is not available.</Text>
        ) : (
          <>
            <Pressable
              onPress={() => router.push(navHref({ kind: 'person', id: workout.user_id }))}
              accessibilityRole="button"
              accessibilityHint="Opens their profile"
              style={({ pressed }) => [styles.person, pressed && styles.pressed]}>
              <InitialsAvatar username={workout.username} size={36} />
              <View style={styles.personText}>
                <Text style={[styles.username, { color: c.text }]} numberOfLines={1}>
                  {socialHandle(workout.username)}
                </Text>
                <Text style={[type.meta, { color: c.text2 }]}>{dateLine(workout.workout_date, workout.created_at)}</Text>
              </View>
            </Pressable>

            {note ? (
              <View style={[styles.note, { backgroundColor: c.surface2 }]}>
                <Text style={[styles.noteText, { color: c.text }]}>{note}</Text>
              </View>
            ) : null}

            <View style={styles.stats}>
              <Stat label="Time" value={formatDuration(workout.created_at, workout.finished_at)} />
              {volume != null ? <Stat label="Volume" value={`${Math.round(volume).toLocaleString()} ${unitLabel}`} /> : null}
              <Stat label="Sets" value={String(workout.completed_sets)} />
            </View>

            <KudosButton
              workoutId={workout.id}
              fromRead={{ given: workout.kudos_given, count: workout.kudos_count }}
            />

            {workout.exercises.map((we) => (
              <ExerciseBlock key={we.id} we={we} unitLabel={unitLabel} viewerUnit={viewerUnit} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** One exercise: thumbnail, name and the PR ribbon, then its sets in the viewer's unit. */
function ExerciseBlock({
  we,
  unitLabel,
  viewerUnit,
}: {
  we: FriendWorkoutExercise;
  unitLabel: string;
  viewerUnit: WeightUnit;
}) {
  const { scheme, colors: c } = useTheme();
  const sets = we.sets.map((row) => {
    const s = toUserUnit(row, viewerUnit);
    return {
      id: s.id,
      weight: s.weight,
      weight_value: s.weight_value,
      reps: s.reps,
      completed: s.completed,
      note: null,
      set_type: row.set_type ?? null,
    };
  });
  return (
    <View style={[styles.card, cardSurface(scheme, c)]}>
      <View style={styles.head}>
        <ExerciseThumb exercise={we.exercise} size={THUMB} />
        <Text style={[type.exerciseName, styles.headName, { color: c.text }]} numberOfLines={2}>
          {we.exercise.name}
        </Text>
        {we.pr ? <PrRibbon size={18} /> : null}
      </View>
      <SetTable sets={sets} weightType={we.exercise.weight_type} unit={unitLabel} prSetIds={null} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors: c } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[type.restTime, { color: c.text }]}>{value}</Text>
      <Text style={[type.label, { color: c.text3 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.screen, gap: spacing.lg, paddingBottom: SCROLL_END_PADDING },
  loading: { marginTop: spacing.xl },
  line: { fontSize: 15 },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  personText: { flex: 1, gap: 2 },
  username: { fontSize: 15, fontWeight: '600' },
  note: { borderRadius: radius.input, padding: spacing.md },
  noteText: { fontSize: 15, lineHeight: 20 },
  stats: { flexDirection: 'row', gap: spacing.xl },
  stat: { gap: 2 },
  card: { borderRadius: radius.card, padding: spacing.card, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headName: { flex: 1 },
  pressed: { opacity: 0.7 },
});
