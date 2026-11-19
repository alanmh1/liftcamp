import {
  cardExercises,
  feedNote,
  feedVolume,
  formatDuration,
  moreExercisesLine,
  setCountLabel,
  socialHandle,
  timeAgo,
  type FeedExercise,
  type FeedItem,
  type WeightUnit,
} from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { KudosButton } from '@/components/social/kudos-button';
import { MutualOnlyLine } from '@/components/social/mutual-only-line';
import { InitialsAvatar } from '@/components/social/person-row';
import { Text } from '@/components/text';
import { PrRibbon } from '@/components/workout/pr-ribbon';
import { chooseOption } from '@/lib/action-sheet';
import { useCanInteract } from '@/lib/kudos';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, pressedFlat, radius, spacing, tabular, type } from '@/theme/tokens';

/**
 * One workout from someone the user follows (docs/social-spec.md, Feed).
 * Three parts, top to bottom, each its own component so photos and
 * comments can be added without moving anything:
 *
 * - FeedCardHeader: the person, time ago, workout name, the note cut at two
 *   lines, then Time and Volume. Never scrolls sideways.
 * - FeedCardBody: today the workout summary only, one row per exercise,
 *   "4 sets" then the name (board Feed2). With photos it becomes a
 *   swipeable carousel, photos then this summary, with dots under it. The
 *   summary lists at most five exercises, so its height is bounded the way
 *   a carousel page needs.
 * - FeedActions: the kudos thumb when the two follow each other
 *   (can_interact), otherwise the mutual-only line. A comment button goes
 *   beside the thumb, and comments under the row.
 *
 * Taps: the avatar or username opens the person, the thumb gives kudos and
 * nothing else, ⋯ opens the menu (Copy workout; Report joins it), anywhere
 * else opens the workout.
 */
export function FeedCard({
  item,
  viewerUnit,
  unitLabel,
  now,
  onOpen,
  onOpenPerson,
  onCopy,
}: {
  item: FeedItem;
  viewerUnit: WeightUnit;
  unitLabel: string;
  now: number;
  onOpen: () => void;
  /** Omitted on the person's own screen, where the header leaves them out. */
  onOpenPerson?: () => void;
  /** The ⋯ menu's Copy workout. */
  onCopy: () => void;
}) {
  const { scheme, colors: c } = useTheme();
  const { session } = useAuth();
  const mutual = useCanInteract(session?.user.id ?? null, item.workout_id, item);
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityHint="Opens the workout"
      style={({ pressed }) => [styles.card, cardSurface(scheme, c), pressed && [styles.pressed, pressedFlat]]}>
      <FeedCardHeader
        item={item}
        viewerUnit={viewerUnit}
        unitLabel={unitLabel}
        now={now}
        onOpenPerson={onOpenPerson}
        onMenu={() => chooseOption([{ label: 'Copy workout', value: 'copy' as const }], () => onCopy())}
      />
      <FeedCardBody>
        <WorkoutSummaryPanel exercises={item.exercises} />
      </FeedCardBody>
      <FeedActions>
        {mutual ? (
          <KudosButton workoutId={item.workout_id} fromRead={{ given: item.kudos_given, count: item.kudos_count }} />
        ) : (
          <View style={[styles.mutual, { borderTopColor: c.border }]}>
            <MutualOnlyLine />
          </View>
        )}
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
  onMenu,
}: {
  item: FeedItem;
  viewerUnit: WeightUnit;
  unitLabel: string;
  now: number;
  onOpenPerson?: () => void;
  onMenu: () => void;
}) {
  const { colors: c } = useTheme();
  const note = feedNote(item.note);
  const volume = feedVolume(item, viewerUnit);
  const ago = item.finished_at ? timeAgo(item.finished_at, now) : '';

  const menu = (
    <Pressable
      onPress={onMenu}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="More for this workout"
      accessibilityHint="Copy workout"
      style={({ pressed }) => [styles.menu, pressed && styles.pressed]}>
      <SymbolView
        name={{ ios: 'ellipsis', android: 'more_horiz' }}
        size={20}
        tintColor={c.text2}
        fallback={<Text style={{ color: c.text2, fontSize: 18 }}>⋯</Text>}
      />
    </Pressable>
  );

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
          <Text style={[type.meta, styles.ago, { color: c.text2 }]}>{ago}</Text>
          {menu}
        </View>
      ) : (
        <View style={styles.personRow}>
          <Text style={[type.meta, styles.ago, styles.agoAlone, { color: c.text2 }]}>{ago}</Text>
          {menu}
        </View>
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
 * The workout's exercises, one row each: the completed set count ("4
 * sets") in a fixed column, then the name, with a gold ribbon after it on
 * each one that held a PR (the owner's own PR rule, written at finish).
 * No weights or reps; the workout itself has every set. "+3 more
 * exercises" past five.
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
          accessibilityLabel={`${setCountLabel(we.sets)}, ${we.name}${we.pr ? ', personal record' : ''}`}>
          <Text style={[styles.sets, { color: c.text2 }]}>{setCountLabel(we.sets)}</Text>
          <View style={styles.nameCell}>
            <Text style={[styles.exerciseName, { color: c.text }]} numberOfLines={1}>
              {we.name}
            </Text>
            {we.pr ? <PrRibbon size={16} /> : null}
          </View>
        </View>
      ))}
      {moreLine ? <Text style={[styles.more, { color: c.accentText }]}>{moreLine}</Text> : null}
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
  ago: { flexShrink: 0, marginLeft: 'auto' },
  agoAlone: { flex: 1 },
  menu: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  username: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  note: { fontSize: 15, lineHeight: 20 },
  stats: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  stat: { gap: 2 },
  body: {},
  panel: { borderRadius: radius.input, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 32 },
  // Wide enough for "10 sets" at the default size, so the names line up.
  sets: { width: 56, fontSize: 14, fontWeight: '600', ...tabular },
  nameCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  exerciseName: { flexShrink: 1, fontSize: 15, fontWeight: '600' },
  more: { fontSize: 14, fontWeight: '500', paddingTop: spacing.xs },
  actions: { flexDirection: 'row', alignItems: 'center' },
  mutual: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.xs },
  pressed: { opacity: 0.8 },
});
