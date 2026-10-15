import { mixHex, progressWidths, type WorkoutProgress } from '@liftcamp/shared';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useColors } from '@/theme/theme-provider';

const HEIGHT = 4;
const TIMING = { duration: 250, easing: Easing.out(Easing.cubic) };

/**
 * The workout's progress as the header's bottom edge: 4 pt, full bleed, no
 * label. Two layers on a `border` track. The tint is every checked set as
 * partial credit (setFraction / total); the solid on top is whole exercises
 * done (done / total). Only exercises with a set count (workoutProgress in
 * shared), so adding one can shrink the bar and an empty card never holds
 * it short.
 *
 * The solid deepens with progress, linear RGB from `progressStart` at
 * nothing done to `accent` at all done; the tint is the solid mixed half
 * with the card surface. Widths and colors ease out over 250 ms. The left
 * end is square and each layer's right end is rounded.
 */
export function WorkoutProgressBar({ progress }: { progress: WorkoutProgress }) {
  const c = useColors();
  const { solid, tint } = progressWidths(progress);
  const solidW = useSharedValue(solid);
  const tintW = useSharedValue(tint);

  useEffect(() => {
    solidW.value = withTiming(solid, TIMING);
    tintW.value = withTiming(tint, TIMING);
  }, [solid, tint, solidW, tintW]);

  // The tint's ends, so interpolating them matches mixing each solid color.
  const start = c.progressStart;
  const end = c.accent;
  const tintStart = mixHex(start, c.surface, 0.5);
  const tintEnd = mixHex(end, c.surface, 0.5);

  // The color follows the solid width, which is done / total.
  const solidStyle = useAnimatedStyle(() => ({
    width: `${solidW.value * 100}%`,
    backgroundColor: interpolateColor(solidW.value, [0, 1], [start, end]),
  }));
  const tintStyle = useAnimatedStyle(() => ({
    width: `${tintW.value * 100}%`,
    backgroundColor: interpolateColor(solidW.value, [0, 1], [tintStart, tintEnd]),
  }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: progress.total,
        now: progress.done,
        text: `${progress.done} of ${progress.total} exercises`,
      }}
      style={[styles.track, { backgroundColor: c.border }]}>
      <Animated.View style={[styles.layer, tintStyle]} />
      <Animated.View style={[styles.layer, solidStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: HEIGHT, width: '100%', overflow: 'hidden' },
  layer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderTopRightRadius: HEIGHT / 2,
    borderBottomRightRadius: HEIGHT / 2,
  },
});
