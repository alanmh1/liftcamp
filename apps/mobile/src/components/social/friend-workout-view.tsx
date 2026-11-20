import {
  feedNote,
  feedVolume,
  formatDuration,
  isCardioSet,
  socialHandle,
  toUserUnit,
  type WeightUnit,
} from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ExerciseThumb } from '@/components/exercise-media';
import { useAuth } from '@/components/auth-provider';
import { SetTable } from '@/components/history/set-table';
import { CopyWorkoutSheet, type CopyWorkoutSheetRef } from '@/components/social/copy-workout-sheet';
import { KudosButton } from '@/components/social/kudos-button';
import { MutualOnlyLine } from '@/components/social/mutual-only-line';
import { InitialsAvatar } from '@/components/social/person-row';
import { ReportSheet, type ReportSheetRef } from '@/components/social/report-sheet';
import { useNavHref } from '@/components/tab-layout';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { PrRibbon } from '@/components/workout/pr-ribbon';
import { socialWorkout, type FriendWorkout, type FriendWorkoutExercise } from '@/data/social';
import { chooseOption } from '@/lib/action-sheet';
import { useCanInteract } from '@/lib/kudos';
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
 * who, when, the note in full, Time, Volume and Sets, kudos (or the
 * mutual-only line when the two don't follow each other), Copy workout,
 * then each exercise with its sets in the viewer's unit, weight left and
 * reps right, or time and distance for cardio. No beige here: the note
 * sits on white and the set rows stripe in rowStripe, a pale blue.
 * The PR ribbon sits on the exercise, from what the owner's phone wrote at
 * finish; no per-set ribbons, since a friend cannot see the history they
 * are measured against. ⋯ beside the person opens Report, with this
 * workout; blocking from there goes back, since the workout is gone.
 */
export function FriendWorkoutView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navHref = useNavHref();
  const { colors: c } = useTheme();
  const { label: unitLabel, unit: viewerUnit } = useWeightUnit();
  const { session } = useAuth();
  const copyRef = useRef<CopyWorkoutSheetRef>(null);
  const reportRef = useRef<ReportSheetRef>(null);
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
  const mutual = useCanInteract(session?.user.id ?? null, id ?? '', workout ?? {});

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
            <View style={styles.personRow}>
              <Pressable
                onPress={() => router.push(navHref({ kind: 'person', id: workout.user_id }))}
                accessibilityRole="button"
                accessibilityHint="Opens their profile"
                style={({ pressed }) => [styles.person, pressed && styles.pressed]}>
                <InitialsAvatar username={workout.username} userId={workout.user_id} size={36} />
                <View style={styles.personText}>
                  <Text style={[styles.username, { color: c.text }]} numberOfLines={1}>
                    {socialHandle(workout.username)}
                  </Text>
                  <Text style={[type.meta, { color: c.text2 }]}>{dateLine(workout.workout_date, workout.created_at)}</Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() =>
                  chooseOption([{ label: 'Report', value: 'report' as const }], () =>
                    reportRef.current?.open({ userId: workout.user_id, username: workout.username, workoutId: workout.id }),
                  )
                }
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="More for this workout"
                accessibilityHint="Report"
                style={({ pressed }) => [styles.menu, pressed && styles.pressed]}>
                <SymbolView
                  name={{ ios: 'ellipsis', android: 'more_horiz' }}
                  size={20}
                  tintColor={c.text2}
                  fallback={<Text style={{ color: c.text2, fontSize: 18 }}>⋯</Text>}
                />
              </Pressable>
            </View>

            {note ? (
              <View style={[styles.note, { backgroundColor: c.surface, borderColor: c.divider }]}>
                <Text style={[styles.noteText, { color: c.text }]}>{note}</Text>
              </View>
            ) : null}

            <View style={styles.stats}>
              <Stat label="Time" value={formatDuration(workout.created_at, workout.finished_at)} />
              {volume != null ? <Stat label="Volume" value={`${Math.round(volume).toLocaleString()} ${unitLabel}`} /> : null}
              <Stat label="Sets" value={String(workout.completed_sets)} />
            </View>

            {mutual ? (
              <KudosButton
                workoutId={workout.id}
                fromRead={{ given: workout.kudos_given, count: workout.kudos_count }}
              />
            ) : (
              <MutualOnlyLine />
            )}

            <Pressable
              onPress={() => copyRef.current?.open(workout.id, workout)}
              accessibilityRole="button"
              accessibilityHint="Start it now or save it as a routine"
              style={({ pressed }) => [styles.copy, { backgroundColor: c.accent }, pressed && styles.pressed]}>
              <SymbolView
                name={{ ios: 'doc.on.doc', android: 'content_copy' }}
                size={18}
                tintColor="#FFFFFF"
                fallback={<View />}
              />
              <Text style={[type.button, styles.copyLabel]}>Copy workout</Text>
            </Pressable>

            {workout.exercises.map((we) => (
              <ExerciseBlock key={we.id} we={we} unitLabel={unitLabel} viewerUnit={viewerUnit} />
            ))}
          </>
        )}
      </ScrollView>
      <CopyWorkoutSheet ref={copyRef} />
      <ReportSheet ref={reportRef} onBlocked={() => router.back()} />
    </View>
  );
}

/**
 * One exercise: thumbnail, name and the PR ribbon, then its sets in the
 * viewer's unit. The thumbnail and name open the exercise's How to, except
 * for a custom exercise.
 */
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
  const router = useRouter();
  const navHref = useNavHref();
  // A friend's own exercise is not readable by the viewer (RLS), so its
  // header stays plain. Any other opens on the How to tab.
  const custom = we.exercise.is_custom === true;
  const headBody = (
    <>
      <ExerciseThumb exercise={we.exercise} size={THUMB} />
      <Text style={[type.exerciseName, styles.headName, { color: c.text }]} numberOfLines={2}>
        {we.exercise.name}
      </Text>
    </>
  );
  // social_workout carries no exercise set_type, so cardio is told by its sets.
  const cardio = we.sets.some(isCardioSet);
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
      duration_seconds: row.duration_seconds ?? null,
      distance_meters: row.distance_meters ?? null,
      incline_percent: row.incline_percent ?? null,
    };
  });
  return (
    <View style={[styles.card, cardSurface(scheme, c)]}>
      <View style={styles.head}>
        {custom ? (
          <View style={styles.headMain}>{headBody}</View>
        ) : (
          <Pressable
            onPress={() => router.push(navHref({ kind: 'exercise', id: we.exercise.id, tab: 'howto' }))}
            accessibilityRole="button"
            accessibilityLabel={`How to do ${we.exercise.name}`}
            style={({ pressed }) => [styles.headMain, pressed && styles.pressed]}>
            {headBody}
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right' }}
              size={13}
              weight="semibold"
              tintColor={c.text3}
              fallback={<Text style={{ color: c.text3 }}>›</Text>}
            />
          </Pressable>
        )}
        {we.pr ? <PrRibbon size={18} /> : null}
      </View>
      <SetTable
        sets={sets}
        weightType={we.exercise.weight_type}
        unit={unitLabel}
        prSetIds={null}
        cardio={cardio}
        stripe={c.rowStripe}
        valueStyle={styles.setValue}
        rowStyle={styles.setRow}
      />
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
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  menu: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  personText: { flex: 1, gap: 2 },
  username: { fontSize: 15, fontWeight: '600' },
  note: { borderRadius: radius.input, padding: spacing.md, borderWidth: 1 },
  noteText: { fontSize: 15, lineHeight: 20 },
  stats: { flexDirection: 'row', gap: spacing.xl },
  stat: { gap: 2 },
  card: { borderRadius: radius.card, padding: spacing.card, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headName: { flex: 1 },
  // The feed card's exercise rows: 15pt regular. Rows shrink to suit.
  setValue: { fontSize: 15, fontWeight: '400' },
  setRow: { paddingVertical: 6 },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radius.pill,
  },
  copyLabel: { color: '#FFFFFF', fontSize: 17 },
  pressed: { opacity: 0.7 },
});
