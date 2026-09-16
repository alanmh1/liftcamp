import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useColors } from '@/theme/theme-provider';

const PIECES = 140;
export const CONFETTI_DURATION_MS = 2000;

/**
 * A curtain that falls once and is gone, about two seconds, with nothing
 * to tap away. Absolutely positioned over the screen and ignoring touches,
 * so the screen never waits on it. Pieces start along the whole top edge,
 * staggered, and fall past the bottom. Plate blue and its soft tint only;
 * gold marks personal records and is not confetti.
 *
 * `onDone` fires when the last piece has landed, so the screen can start
 * whatever it was holding for the burst.
 */
export function Confetti({ onDone }: { onDone?: () => void }) {
  const { width, height } = useWindowDimensions();
  const c = useColors();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: CONFETTI_DURATION_MS, easing: Easing.inOut(Easing.quad) },
      (finished) => {
        if (finished && onDone) runOnJS(onDone)();
      },
    );
    // Mount only. A new onDone should not restart the burst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  // Fixed for the life of the burst, so a re-render does not reshuffle it.
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => ({
        // Along the full width, and a little past both edges so the sides
        // are as dense as the middle once the pieces drift.
        x: -20 + Math.random() * (width + 40),
        startY: -30 - Math.random() * height * 0.25,
        drift: (Math.random() - 0.5) * 160,
        sway: 10 + Math.random() * 30,
        delay: Math.random() * 0.35,
        spin: (Math.random() - 0.5) * 900,
        size: 6 + Math.random() * 8,
        tall: Math.random() > 0.5,
        color: i % 3 === 0 ? c.accentSoft : c.accent,
      })),
    [width, height, c.accent, c.accentSoft],
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
  piece: {
    x: number;
    startY: number;
    drift: number;
    sway: number;
    delay: number;
    spin: number;
    size: number;
    tall: boolean;
    color: string;
  };
  progress: SharedValue<number>;
  height: number;
}) {
  const style = useAnimatedStyle(() => {
    // Each piece runs the same 0 to 1 curve, offset by its own delay.
    const t = Math.max(0, Math.min(1, (progress.value - piece.delay) / (1 - piece.delay)));
    return {
      opacity: interpolate(t, [0, 0.08, 0.9, 1], [0, 1, 1, 0]),
      transform: [
        // A drift across the fall plus a slow side-to-side, so the pieces
        // flutter rather than drop in straight lines.
        { translateX: piece.x + piece.drift * t + Math.sin(t * Math.PI * 2) * piece.sway },
        { translateY: interpolate(t, [0, 1], [piece.startY, height + 40]) },
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
