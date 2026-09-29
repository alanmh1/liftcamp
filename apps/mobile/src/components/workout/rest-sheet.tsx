import { forwardRef } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { Text } from '@/components/text';
import { mmss } from '@/components/workout/rest-row';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/** The preset rest lengths, in seconds. */
export const REST_PRESETS = [60, 90, 120, 180] as const;

/** What -15s and +15s move the running timer by, in seconds. */
export const REST_STEP = 15;

/**
 * The rest sheet, opened from the rest row. Every control acts on the
 * running timer at once: -15s and +15s, the presets, which set the rest's
 * full length from when the set was checked, and Skip rest. The toggle
 * saves the current length as the exercise's rest, the default for its
 * sets from then on, and while it is on, changes here update the saved
 * length too.
 */
export const RestSheet = forwardRef<
  SheetRef,
  {
    remaining: number;
    total: number;
    /** The exercise whose set started the rest; null hides the toggle. */
    exerciseName: string | null;
    savedForExercise: boolean;
    onAdjust: (deltaSeconds: number) => void;
    onPreset: (seconds: number) => void;
    onSaveForExercise: (save: boolean) => void;
    onSkip: () => void;
  }
>(function RestSheet(
  { remaining, total, exerciseName, savedForExercise, onAdjust, onPreset, onSaveForExercise, onSkip },
  ref,
) {
  const c = useColors();

  const stepButton = (delta: number) => (
    <Pressable
      onPress={() => onAdjust(delta)}
      accessibilityRole="button"
      accessibilityLabel={delta < 0 ? `${REST_STEP} seconds less` : `${REST_STEP} seconds more`}
      style={({ pressed }) => [styles.step, { backgroundColor: c.surface2 }, pressed && styles.pressed]}>
      <Text style={[type.button, styles.tabular, { color: c.text }]}>
        {delta < 0 ? `−${REST_STEP}s` : `+${REST_STEP}s`}
      </Text>
    </Pressable>
  );

  return (
    <Sheet ref={ref}>
      <Text style={[type.label, styles.center, { color: c.accentText }]}>Rest</Text>

      <View style={styles.timeRow}>
        {stepButton(-REST_STEP)}
        <Text
          accessibilityLiveRegion="polite"
          style={[type.restTime, styles.time, { color: c.text }]}>
          {mmss(remaining)}
        </Text>
        {stepButton(REST_STEP)}
      </View>

      <View style={styles.presets}>
        {REST_PRESETS.map((p) => {
          const selected = p === total;
          return (
            <Pressable
              key={p}
              onPress={() => onPreset(p)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.preset,
                selected
                  ? { backgroundColor: c.accent }
                  : { backgroundColor: c.surface2 },
                pressed && styles.pressed,
              ]}>
              <Text style={[type.button, styles.tabular, { color: selected ? '#FFFFFF' : c.text }]}>
                {mmss(p)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {exerciseName ? (
        <View style={[styles.toggleRow, { borderColor: c.border }]}>
          <View style={styles.toggleText}>
            <Text style={[type.button, { color: c.text }]}>Use for this exercise next time</Text>
            <Text style={[type.meta, { color: c.text2 }]} numberOfLines={1}>
              {`${exerciseName}, ${mmss(total)}`}
            </Text>
          </View>
          <Switch
            value={savedForExercise}
            onValueChange={onSaveForExercise}
            trackColor={{ true: c.accent }}
            accessibilityLabel="Use for this exercise next time"
          />
        </View>
      ) : null}

      <Pressable
        onPress={onSkip}
        accessibilityRole="button"
        style={({ pressed }) => [styles.skip, { borderColor: c.accent }, pressed && styles.pressed]}>
        <Text style={[type.button, { color: c.accentText }]}>Skip rest</Text>
      </Pressable>
    </Sheet>
  );
});

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  time: {
    fontSize: 44,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  step: {
    width: 64,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presets: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  preset: {
    flex: 1,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toggleText: { flex: 1, gap: 2 },
  skip: {
    marginTop: spacing.lg,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});
