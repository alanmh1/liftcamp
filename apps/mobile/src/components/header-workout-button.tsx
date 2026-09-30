import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ReactElement } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import * as home from '@/data/home';
import { startAdHocWorkout } from '@/data/workouts';
import { useColors } from '@/theme/theme-provider';
import { radius, type } from '@/theme/tokens';

/**
 * "+ Workout", the accent pill on the right of the large-title header on
 * Home, History and Exercises. A native header item, so it stays put when
 * the list scrolls and the title collapses. Not on Profile, whose header
 * has the gear.
 *
 * A tap starts an empty workout through the same instant start as
 * everywhere else (startAdHocWorkout: queued, copied to the phone, no
 * server wait, works offline). While a workout is in progress the pill
 * reads "Resume" and opens that one instead. Before any start it checks
 * the phone's workout copies again, so a tap never starts a second workout
 * even when what the pill shows is stale.
 *
 * No haptic: it is not one of the five call sites in lib/haptics.ts.
 */
type Props = {
  /**
   * The screen's own answer, when it has one: Home's in-progress workout,
   * which already merges the server and the phone and drops a Resume card
   * swiped away. Undefined means the pill looks it up on each focus.
   */
  openWorkoutId?: string | null;
  /** Home greys every start control while one start runs. */
  disabled?: boolean;
  /**
   * Runs before a start. Home queues a discard still waiting on Undo, so
   * the workout just swiped away does not count as open.
   */
  beforeStart?: () => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
};

/**
 * The pill's text is capped at this Dynamic Type multiplier. The native
 * bar is a fixed 44 pt tall, and at the largest accessibility sizes an
 * unscaled pill would overflow it; 1.5 keeps "+ Workout" at 22 pt.
 */
const MAX_SCALE = 1.5;

export function HeaderWorkoutButton({ openWorkoutId, disabled, beforeStart, onBusyChange }: Props) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const router = useRouter();
  const c = useColors();
  const { unit: weightUnit } = useWeightUnit();
  const [found, setFound] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The phone's copies answer first, then the server adds a workout started
  // elsewhere. The newest of the two wins, the same rule as Home's card.
  useFocusEffect(
    useCallback(() => {
      if (!userId || openWorkoutId !== undefined) return;
      let cancelled = false;
      void (async () => {
        const device = await home.getDeviceOpenWorkout(userId);
        if (cancelled) return;
        setFound(device?.id ?? null);
        const server = await home.getInProgressWorkout(userId).catch(() => null);
        if (cancelled) return;
        const newest = [device, server]
          .filter((w) => w != null)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        setFound(newest?.id ?? null);
      })();
      return () => {
        cancelled = true;
      };
    }, [userId, openWorkoutId]),
  );

  const openId = openWorkoutId !== undefined ? openWorkoutId : found;

  function open(id: string) {
    router.push({ pathname: '/workout/[id]', params: { id } });
  }

  async function onPress() {
    if (!userId || busy) return;
    if (openId) {
      open(openId);
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    try {
      await beforeStart?.();
      const already = await home.getDeviceOpenWorkout(userId);
      const id = already?.id ?? (await startAdHocWorkout(userId, weightUnit));
      if (id) open(id);
      else Alert.alert('Could not start that workout.', 'Try again.');
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return (
    <Pressable
      onPress={() => void onPress()}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={openId ? 'Resume workout' : 'Start an empty workout'}
      hitSlop={8}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: c.accent },
        (pressed || busy || disabled) && styles.dimmed,
      ]}>
      <Text maxFontSizeMultiplier={MAX_SCALE} numberOfLines={1} style={[type.button, styles.label]}>
        {openId ? 'Resume' : '+ Workout'}
      </Text>
    </Pressable>
  );
}

/**
 * Stack.Screen options that put the pill on the right of the header. On
 * iOS it is a custom bar item with hidesSharedBackground, so iOS 26 does
 * not wrap it in a glass capsule; headerRight covers Android, where the
 * items API does not apply.
 */
export function workoutPillOptions(pill: ReactElement) {
  return {
    headerRight: () => pill,
    unstable_headerRightItems: () => [{ type: 'custom' as const, element: pill, hidesSharedBackground: true }],
  };
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Accent is the same blue in both modes, and white on it is 6.5:1.
  label: { color: '#FFFFFF' },
  dimmed: { opacity: 0.6 },
});
