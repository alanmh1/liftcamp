import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useColors } from '@/theme/theme-provider';

const PIECES = 48;
const DURATION_MS = 900;

/**
 * A burst that falls once and is gone, under a second, with nothing to tap
 * away. Absolutely positioned over the screen and ignoring touches, so the
 * screen never waits on it. Plate blue and its soft tint only; gold marks
 * personal records and is not confetti.
 */
export function Confetti() {
  const { width, height } = useWindowDimensions();
  const c = useColors();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: DURATION_MS, easing: Easing.out(Easing.quad) });
  }, [progress]);

  // Fixed for the life of the burst, so a re-render does not reshuffle it.
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => ({
        x: Math.random() * width,
        drift: (Math.random() - 0.5) * 120,
        delay: Math.random() * 0.3,
        spin: (Math.random() - 0.5) * 720,
        size: 6 + Math.random() * 8,
        tall: Math.random() > 0.5,
        color: i % 3 === 0 ? c.accentSoft : c.accent,
      })),
    [width, c.accent, c.accentSoft],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => (
        <Piece key={i} piece={p} progress={progress} height={height} />
      ))}
    </View>
  );
}

function Piece({
  piece,
  progress,
  height,
}: {
  piece: { x: number; drift: number; delay: number; spin: number; size: number; tall: boolean; color: string };
  progress: SharedValue<number>;
  height: number;
}) {
  const style = useAnimatedStyle(() => {
    // Each piece runs the same 0 to 1 curve, offset by its own delay.
    const t = Math.max(0, Math.min(1, (progress.value - piece.delay) / (1 - piece.delay)));
    return {
      opacity: interpolate(t, [0, 0.1, 0.8, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: piece.x + piece.drift * t },
        { translateY: interpolate(t, [0, 1], [-40, height * 0.7]) },
        { rotate: `${piece.spin * t}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.piece,
        {
          width: piece.tall ? piece.size * 0.6 : piece.size,
          height: piece.tall ? piece.size * 1.6 : piece.size,
          backgroundColor: piece.color,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, left: 0, borderRadius: 2 },
});
