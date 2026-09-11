import { Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import type { InProgressWorkout } from '@/data/home';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';

function elapsed(fromIso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(fromIso).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h} h ${String(mins % 60).padStart(2, '0')} min`;
}

/**
 * The unfinished workout from the last 24 hours. Resume opens it; swipe left
 * to discard, with the undo toast the screen owns.
 */
export function ResumeCard({
  workout,
  onResume,
  onDiscard,
}: {
  workout: InProgressWorkout;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const { scheme, colors: c } = useTheme();

  return (
    <Swipeable
      friction={1}
      rightThreshold={40}
      // The Swipeable's container clips its children by default, which was
      // swallowing the card shadow and making this read as a flat block next
      // to the This Week card. Letting it overflow restores the shadow; the
      // revealed Discard action still clips inside its own absolute view.
      containerStyle={styles.swipeContainer}
      renderRightActions={() => (
        <View style={styles.actionWrap}>
          <Pressable
            onPress={onDiscard}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.discard,
              { backgroundColor: c.danger },
              pressed && styles.pressed,
            ]}>
            <Text style={[type.button, styles.discardLabel]}>Discard</Text>
          </Pressable>
        </View>
      )}>
      <View style={[styles.card, cardSurface(scheme, c)]}>
        <View style={styles.text}>
          <Text style={[type.label, { color: c.accentText }]}>In progress</Text>
          <Text style={[type.exerciseName, { color: c.text }]} numberOfLines={1}>
            {workout.name ?? 'Workout'}
          </Text>
          <Text style={[type.meta, { color: c.text2 }]}>
            <Text style={[type.prevNumeral, { color: c.text2 }]}>{elapsed(workout.createdAt)}</Text>
            {`  ·  ${workout.exerciseCount} ${workout.exerciseCount === 1 ? 'exercise' : 'exercises'}`}
          </Text>
        </View>
        <Pressable
          onPress={onResume}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.resume,
            { backgroundColor: c.accent },
            pressed && styles.pressed,
          ]}>
          <Text style={[type.button, { color: '#FFFFFF' }]}>Resume</Text>
        </Pressable>
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  swipeContainer: { overflow: 'visible' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.card,
    padding: spacing.card,
  },
  text: { flex: 1, gap: 2 },
  resume: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  actionWrap: { justifyContent: 'center', marginLeft: spacing.sm },
  discard: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: radius.input,
  },
  discardLabel: { color: '#FFFFFF' },
  pressed: { opacity: 0.8 },
});
