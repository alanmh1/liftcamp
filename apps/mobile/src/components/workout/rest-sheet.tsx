import { forwardRef } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { Text } from '@/components/text';
import { mmss, RestRing, restFraction } from '@/components/workout/rest-row';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/** The preset rest lengths, in seconds. */
export const REST_PRESETS = [60, 90, 120, 180] as const;

/** What -15s and +15s move the running timer by, in seconds. */
export const REST_STEP = 15;

/**
 * The hero ring. With the sections below it the sheet stands about 395pt
 * including the grab handle and home indicator, under half of a 6.1-inch
 * iPhone (852pt), so the set just checked usually stays visible above it.
 */
const HERO_RING = 136;
const HERO_STROKE = 8;
const STEP_SIZE = 48;

/** Every gap between the sheet's sections. */
const SECTION_GAP = spacing.lg;

/**
 * The rest sheet, opened from the rest row. Every control acts on the
 * running timer at once: -15s and +15s, the Rest length presets, which set
 * the rest's full length from when the set was checked, and Skip rest. The
 * toggle saves the current length as the exercise's rest, the default for
 * its sets from then on, and while it is on, changes here update the saved
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
  const { scheme, colors: c } = useTheme();

  const stepButton = (delta: number) => (
    <Pressable
      onPress={() => onAdjust(delta)}
      accessibilityRole="button"
      accessibilityLabel={delta < 0 ? `${REST_STEP} seconds less` : `${REST_STEP} seconds more`}
      hitSlop={6}
      style={({ pressed }) => [styles.step, { backgroundColor: c.surface2 }, pressed && styles.pressed]}>
      <Text style={[type.button, styles.stepLabel, { color: c.text }]}>
        {delta < 0 ? `−${REST_STEP}s` : `+${REST_STEP}s`}
      </Text>
    </Pressable>
  );

  return (
    <Sheet ref={ref}>
      <View style={styles.body}>
        <View style={styles.hero}>
          {stepButton(-REST_STEP)}
          <View style={styles.ring}>
            <RestRing size={HERO_RING} stroke={HERO_STROKE} fraction={restFraction(remaining, total)} />
            <View style={styles.ringCenter} pointerEvents="none">
              <Text style={[type.label, { color: c.accentText }]}>Rest</Text>
              <Text
                accessibilityLiveRegion="polite"
                style={[type.restTime, styles.time, { color: c.text }]}>
                {mmss(remaining)}
              </Text>
            </View>
          </View>
          {stepButton(REST_STEP)}
        </View>

        <View style={styles.lengthSection}>
          <Text style={[type.meta, { color: c.text2 }]}>Rest length</Text>
          <View
            accessibilityRole="radiogroup"
            style={[styles.track, { backgroundColor: c.surface2 }]}>
            {REST_PRESETS.map((p) => {
              const selected = p === total;
              return (
                <Pressable
                  key={p}
                  onPress={() => onPreset(p)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`Rest length ${mmss(p)}`}
                  style={({ pressed }) => [
                    styles.segment,
                    selected && [
                      { backgroundColor: c.surface },
                      scheme === 'light' && styles.chipShadow,
                    ],
                    pressed && !selected && styles.pressed,
                  ]}>
                  <Text style={[type.button, styles.tabular, { color: c.text }]}>{mmss(p)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {exerciseName ? (
          <View style={styles.toggleRow}>
            <Text style={[type.button, styles.toggleLabel, { color: c.text }]} numberOfLines={1}>
              {`Remember for ${exerciseName}`}
            </Text>
            <Text style={[type.restTime, { color: c.text2 }]}>{mmss(total)}</Text>
            <Switch
              value={savedForExercise}
              onValueChange={onSaveForExercise}
              trackColor={{ true: c.accent }}
              accessibilityLabel={`Remember ${mmss(total)} for ${exerciseName}`}
            />
          </View>
        ) : null}

        <Pressable
          onPress={onSkip}
          accessibilityRole="button"
          style={({ pressed }) => [styles.skip, { borderColor: c.accent }, pressed && styles.pressed]}>
          <Text style={[type.button, { color: c.accentText }]}>Skip rest</Text>
        </Pressable>
      </View>
    </Sheet>
  );
});

const styles = StyleSheet.create({
  body: { gap: SECTION_GAP },
  tabular: { fontVariant: ['tabular-nums'] },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  ring: {
    width: HERO_RING,
    height: HERO_RING,
  },
  ringCenter: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  time: {
    fontSize: 36,
    fontWeight: '600',
  },
  step: {
    width: STEP_SIZE,
    height: STEP_SIZE,
    borderRadius: STEP_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  lengthSection: { gap: spacing.sm },
  track: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.pill,
  },
  segment: {
    flex: 1,
    minHeight: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  toggleLabel: { flex: 1 },
  skip: {
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});
