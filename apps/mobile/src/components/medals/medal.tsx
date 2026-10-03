import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { palettes, tabular } from '@/theme/tokens';

/**
 * One streak medal: the rung's week count in a disc. Every medal in the app
 * draws through this component (the week card, Profile's row, the cabinet,
 * the streak share card and the dev gallery), so the clay art can replace
 * this placeholder here without touching any of them.
 *
 * - earned: an accent disc with a faint inner ring and the number in white.
 * - locked: the same shape as a silhouette, an outline in the border color
 *   with the number in text3.
 * - share: for the share card's plate blue, whatever the app theme: a white
 *   disc with the number in plate blue.
 *
 * No gold. Gold is PRs only, and on share cards the headline number.
 */
export type MedalVariant = 'earned' | 'locked' | 'share';

export function Medal({
  weeks,
  size,
  variant = 'earned',
  style,
  animatedScale,
}: {
  weeks: number;
  size: number;
  variant?: MedalVariant;
  style?: StyleProp<ViewStyle>;
  /** Drives the landing on the week card's celebration. */
  animatedScale?: SharedValue<number>;
}) {
  const c = useColors();
  const r = size / 2;
  const stroke = Math.max(1.5, size / 32);
  const scaled = useAnimatedStyle(() => {
    const s = animatedScale ? animatedScale.value : 1;
    return { opacity: Math.min(1, s * 2), transform: [{ scale: s }] };
  });

  const disc =
    variant === 'earned'
      ? { fill: c.accent, ring: '#FFFFFF', ringOpacity: 0.3, text: '#FFFFFF' }
      : variant === 'share'
        ? { fill: '#FFFFFF', ring: palettes.light.accent, ringOpacity: 0.25, text: palettes.light.accent }
        : { fill: 'none', ring: c.border, ringOpacity: 1, text: c.text3 };
  // Three digits need a smaller face to sit inside the ring.
  const digits = String(weeks).length;
  const fontSize = size * (digits <= 1 ? 0.44 : digits === 2 ? 0.38 : 0.3);

  return (
    <Animated.View
      style={[{ width: size, height: size }, style, scaled]}
      accessible
      accessibilityLabel={`${weeks}-week medal${variant === 'locked' ? ', locked' : ''}`}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {variant === 'locked' ? (
          <Circle cx={r} cy={r} r={r - stroke / 2} fill="none" stroke={c.border} strokeWidth={stroke} />
        ) : (
          <Circle cx={r} cy={r} r={r} fill={disc.fill} />
        )}
        <Circle
          cx={r}
          cy={r}
          r={r * 0.78}
          fill="none"
          stroke={disc.ring}
          strokeOpacity={disc.ringOpacity}
          strokeWidth={stroke * 0.7}
          strokeDasharray={variant === 'locked' ? `${stroke * 2} ${stroke * 2}` : undefined}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text allowFontScaling={false} style={[styles.number, { fontSize, lineHeight: fontSize * 1.15, color: disc.text }]}>
          {weeks}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  number: { textAlign: 'center', fontWeight: '700', ...tabular },
});
