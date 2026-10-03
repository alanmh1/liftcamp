import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { tabular } from '@/theme/tokens';

import art from '../../../assets/images/medals/medals.json';

/**
 * One streak medal: the clay art for the rung with its week count pressed
 * into the face. Every medal in the app draws through this component (the
 * week card, Profile's row, the cabinet, the streak share card and the dev
 * gallery).
 *
 * - earned: the rung's art, the number in the metal's ink.
 * - locked: the same art desaturated at 35% opacity, the number in text3.
 * - share: the earned art as is, for the share card's plate blue.
 *
 * The art is metal: bronze for 2 and 4, silver for 8 and 12, gold from 26.
 * Rungs past 104 (156, 208 and on) reuse the 104 art with their own number.
 * That gold is the medal's metal, not the flat UI gold (#F5D272), which
 * stays for PRs only.
 *
 * assets/images/medals holds the 600 px art and medals.json, which gives
 * the face's center and radius as fractions of the image (the same for
 * every medal) and each medal's metal. The locked art is a grayscale copy
 * at 300 px (3x the largest locked size, the cabinet's 96 pt), rendered
 * ahead of time because iOS ignores the grayscale style filter unless a
 * native feature flag is on.
 */
export type MedalVariant = 'earned' | 'locked' | 'share';

type ArtRung = 2 | 4 | 8 | 12 | 26 | 52 | 78 | 104;
type Metal = 'bronze' | 'silver' | 'gold';

/** Static requires: Metro cannot resolve a path built at runtime. */
const EARNED: Record<ArtRung, number> = {
  2: require('../../../assets/images/medals/medal-2.png'),
  4: require('../../../assets/images/medals/medal-4.png'),
  8: require('../../../assets/images/medals/medal-8.png'),
  12: require('../../../assets/images/medals/medal-12.png'),
  26: require('../../../assets/images/medals/medal-26.png'),
  52: require('../../../assets/images/medals/medal-52.png'),
  78: require('../../../assets/images/medals/medal-78.png'),
  104: require('../../../assets/images/medals/medal-104.png'),
};

const LOCKED: Record<ArtRung, number> = {
  2: require('../../../assets/images/medals/medal-2-locked.png'),
  4: require('../../../assets/images/medals/medal-4-locked.png'),
  8: require('../../../assets/images/medals/medal-8-locked.png'),
  12: require('../../../assets/images/medals/medal-12-locked.png'),
  26: require('../../../assets/images/medals/medal-26-locked.png'),
  52: require('../../../assets/images/medals/medal-52-locked.png'),
  78: require('../../../assets/images/medals/medal-78-locked.png'),
  104: require('../../../assets/images/medals/medal-104-locked.png'),
};

/** The number's ink on each metal. Cream on bronze, graphite on silver and gold. */
const INK: Record<Metal, string> = { bronze: '#F1EDE7', silver: '#221F1B', gold: '#221F1B' };

const LOCKED_OPACITY = 0.35;

/** The art a rung draws: its own, or the 104's past it. */
function artRung(weeks: number): ArtRung {
  return weeks in EARNED ? (weeks as ArtRung) : 104;
}

function metalOf(rung: ArtRung): Metal {
  return (art.medals as Record<string, { metal: Metal }>)[String(rung)].metal;
}

/**
 * Pressed into the clay: on dark ink a light edge below the strokes, on
 * cream ink a dark edge above them, a hair wide at any size.
 */
function pressedShadow(ink: string, size: number): TextStyle {
  const d = Math.max(0.5, size / 120);
  return ink === INK.bronze
    ? { textShadowColor: 'rgba(34, 31, 27, 0.45)', textShadowOffset: { width: 0, height: -d }, textShadowRadius: d }
    : { textShadowColor: 'rgba(255, 255, 255, 0.45)', textShadowOffset: { width: 0, height: d }, textShadowRadius: d };
}

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
  const scaled = useAnimatedStyle(() => {
    const s = animatedScale ? animatedScale.value : 1;
    return { opacity: Math.min(1, s * 2), transform: [{ scale: s }] };
  });

  const rung = artRung(weeks);
  const locked = variant === 'locked';
  const ink = locked ? c.text3 : INK[metalOf(rung)];

  // The face, from medals.json, in points.
  const { cx, cy, r } = art.face;
  const faceSize = r * 2 * size;
  // Three digits need a smaller face to fit across the face.
  const digits = String(weeks).length;
  const fontSize = faceSize * (digits <= 2 ? 0.5 : 0.38);

  return (
    <Animated.View
      style={[{ width: size, height: size }, style, scaled]}
      accessible
      accessibilityLabel={`${weeks}-week medal${locked ? ', locked' : ''}`}>
      <Image
        source={locked ? LOCKED[rung] : EARNED[rung]}
        style={[styles.art, locked && styles.locked]}
        contentFit="contain"
        cachePolicy="memory-disk"
        accessibilityIgnoresInvertColors
      />
      <View
        pointerEvents="none"
        style={[styles.face, { left: (cx - r) * size, top: (cy - r) * size, width: faceSize, height: faceSize }]}>
        <Text
          allowFontScaling={false}
          style={[
            styles.number,
            { fontSize, lineHeight: fontSize * 1.15, color: ink },
            locked ? null : pressedShadow(ink, size),
          ]}>
          {weeks}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  art: { width: '100%', height: '100%' },
  locked: { opacity: LOCKED_OPACITY },
  face: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  number: { textAlign: 'center', fontWeight: '700', ...tabular },
});
