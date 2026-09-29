import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useColors } from '@/theme/theme-provider';

/**
 * A weight plate seen face on, the week card's token for one workout: an
 * outer disc, a center hole, and two faint rings between them. Filled in
 * accent for a workout done, an outline for one to go. Drawn, so the
 * artwork can become a clay render later without touching the card.
 */
export function Plate({
  size,
  filled,
  style,
  animatedScale,
}: {
  size: number;
  filled: boolean;
  style?: StyleProp<ViewStyle>;
  /** Drives the fill and celebration pops. */
  animatedScale?: SharedValue<number>;
}) {
  const c = useColors();
  const r = size / 2;
  const stroke = 1.5;
  const scaled = useAnimatedStyle(() => ({ transform: [{ scale: animatedScale ? animatedScale.value : 1 }] }));

  return (
    <Animated.View style={[{ width: size, height: size }, style, scaled]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {filled ? (
          <>
            <Circle cx={r} cy={r} r={r} fill={c.accent} />
            <Circle cx={r} cy={r} r={r * 0.72} fill="none" stroke="#FFFFFF" strokeOpacity={0.25} strokeWidth={1} />
            <Circle cx={r} cy={r} r={r * 0.5} fill="none" stroke="#FFFFFF" strokeOpacity={0.25} strokeWidth={1} />
            <Circle cx={r} cy={r} r={size / 6} fill={c.surface} />
          </>
        ) : (
          <>
            <Circle cx={r} cy={r} r={r - stroke / 2} fill="none" stroke={c.border} strokeWidth={stroke} />
            <Circle cx={r} cy={r} r={r * 0.72} fill="none" stroke={c.border} strokeOpacity={0.35} strokeWidth={1} />
            <Circle cx={r} cy={r} r={r * 0.5} fill="none" stroke={c.border} strokeOpacity={0.35} strokeWidth={1} />
            <Circle cx={r} cy={r} r={size / 6} fill="none" stroke={c.border} strokeWidth={stroke} />
          </>
        )}
      </Svg>
    </Animated.View>
  );
}
