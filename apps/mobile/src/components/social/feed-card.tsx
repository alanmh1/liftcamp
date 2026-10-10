import {
  cardExercises,
  feedNote,
  feedVolume,
  formatDuration,
  moreExercisesLine,
  socialHandle,
  timeAgo,
  type FeedExercise,
  type FeedItem,
  type WeightUnit,
} from '@liftcamp/shared';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { KudosButton } from '@/components/social/kudos-button';
import { InitialsAvatar } from '@/components/social/person-row';
import { Text } from '@/components/text';
import { PrRibbon } from '@/components/workout/pr-ribbon';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, pressedFlat, radius, spacing, tabular, type } from '@/theme/tokens';

/**
 * One workout from someone the user follows (docs/social-spec.md, Feed).
 * Three parts, top to bottom, each its own component so photos and
 * comments can be added without moving anything:
 *
 * - FeedCardHeader: the person, time ago, workout name, the note cut at two
 *   lines, then Time and Volume. Never scrolls sideways.
 * - FeedCardBody: today the workout summary only. With photos it becomes a
 *   swipeable carousel, photos then this summary, with dots under it. The
 *   summary lists at most five exercises, so its height is bounded the way
 *   a carousel page needs.
 * - FeedActions: the kudos thumb. A comment button goes beside it, and
 *   comments under the row.
 *
 * Taps: the avatar or username opens the person, the thumb gives kudos and
 * nothing else, anywhere else opens the workout.
 */
export function FeedCard({
  item,
  viewerUnit,
  unitLabel,
  now,
  onOpen,
  onOpenPerson,
}: {
  item: FeedItem;
  viewerUnit: WeightUnit;
  unitLabel: string;
  now: number;
  onOpen: () => void;
  /** Omitted on the person's own screen, where the header leaves them out. */
  onOpenPerson?: () => void;
}) {
  const { scheme, colors: c } = useTheme();
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityHint="Opens the workout"
      style={({ pressed }) => [styles.card, cardSurface(scheme, c), pressed && [styles.pressed, pressedFlat]]}>
      <FeedCardHeader item={item} viewerUnit={viewerUnit} unitLabel={unitLabel} now={now} onOpenPerson={onOpenPerson} />
      <FeedCardBody>
        <WorkoutSummaryPanel exercises={item.exercises} />
      </FeedCardBody>
      <FeedActions>
        <KudosButton workoutId={item.workout_id} fromRead={{ given: item.kudos_given, count: item.kudos_count }} />
      </FeedActions>
    </Pressable>
  );
}

function FeedCardHeader({
  item,
  viewerUnit,
  unitLabel,
  now,
  onOpenPerson,
}: {
  item: FeedItem;
  viewerUnit: WeightUnit;
  unitLabel: string;
  now: number;
  onOpenPerson?: () => void;
}) {
  const { colors: c } = useTheme();
  const note = feedNote(item.note);
  const volume = feedVolume(item, viewerUnit);
  const ago = item.finished_at ? timeAgo(item.finished_at, now) : '';

  return (
    <View style={styles.header}>
      {onOpenPerson ? (
        <View style={styles.personRow}>
          <Pressable
            onPress={onOpenPerson}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${socialHandle(item.username)}, ${ago}`}
            accessibilityHint="Opens their profile"
            style={({ pressed }) => [styles.person, pressed && styles.pressed]}>
            <InitialsAvatar username={item.username} size={36} />
            <Text style={[styles.username, { color: c.text }]} numberOfLines={1}>
              {socialHandle(item.username)}
            </Text>
          </Pressable>
          <Text style={[type.meta, { color: c.text2 }]}>{ago}</Text>
        </View>
      ) : (
        <Text style={[type.meta, { color: c.text2 }]}>{ago}</Text>
      )}

      <Text style={[type.exerciseName, { color: c.text }]} numberOfLines={2}>
        {item.name?.trim() || 'Workout'}
      </Text>
      {note ? (
        <Text style={[styles.note, { color: c.text2 }]} numberOfLines={2} ellipsizeMode="tail">
          {note}
        </Text>
      ) : null}

      <View style={styles.stats}>
        {item.finished_at ? <Stat label="Time" value={formatDuration(item.created_at, item.finished_at)} /> : null}
        {volume != null ? <Stat label="Volume" value={`${Math.round(volume).toLocaleString()} ${unitLabel}`} /> : null}
      </View>
    </View>
  );
}

/** Today a plain container; the photo carousel and its dots go here later. */
function FeedCardBody({ children }: { children: ReactNode }) {
  return <View style={styles.body}>{children}</View>;
}

/** The action row. Kudos today; a comment button joins it later. */
function FeedActions({ children }: { children: ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

/**
 * The workout's exercises with their completed set counts, a gold ribbon on
 * each one that held a PR (the owner's own PR rule, written at finish), and
 * "and 3 more" past five.
 */
export function WorkoutSummaryPanel({ exercises }: { exercises: FeedExercise[] }) {
  const { colors: c } = useTheme();
  const { shown, more } = cardExercises(exercises);
  const moreLine = moreExercisesLine(more);
  if (shown.length === 0) return null;
  return (
    <View style={[styles.panel, { backgroundColor: c.surface2 }]}>
      {shown.map((we) => (
        <View
          key={we.workout_exercise_id}
          style={styles.exerciseRow}
          accessible
          accessibilityLabel={`${we.name}, ${we.sets} ${we.sets === 1 ? 'set' : 'sets'}${we.pr ? ', personal record' : ''}`}>
          <Text style={[styles.exerciseName, { color: c.text }]} numberOfLines={1}>
            {we.name}
          </Text>
          {we.pr ? <PrRibbon size={16} /> : null}
          <Text style={[styles.sets, { color: c.text2 }]}>
            {we.sets} {we.sets === 1 ? 'set' : 'sets'}
          </Text>
        </View>
      ))}
      {moreLine ? <Text style={[type.meta, { color: c.text2 }]}>{moreLine}</Text> : null}
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
  card: { borderRadius: radius.card, padding: spacing.card, gap: spacing.md },
  header: { gap: spacing.xs },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  username: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  note: { fontSize: 15, lineHeight: 20 },
  stats: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  stat: { gap: 2 },
  body: {},
  panel: { borderRadius: radius.input, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 26 },
  exerciseName: { flex: 1, fontSize: 15 },
  sets: { fontSize: 15, ...tabular },
  actions: { flexDirection: 'row', alignItems: 'center' },
  pressed: { opacity: 0.8 },
});
