import { useEffect, useRef, type ReactNode } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  makeMutable,
  useAnimatedStyle,
  useReducedMotion,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useColors } from '@/theme/theme-provider';
import { radius as radii } from '@/theme/tokens';

/** How long real content takes to fade in over its skeleton. */
export const REVEAL_MS = 150;

/** One half of the pulse, and how far it dims. */
const PULSE_MS = 750;
const PULSE_LOW = 0.5;

/**
 * One opacity shared by every skeleton on screen, so a screen of blocks
 * pulses in step rather than each starting from its own mount. It runs
 * only while at least one pulsing skeleton is mounted.
 */
const pulse = makeMutable(1);
let pulsing = 0;

function startPulse() {
  if (pulsing++ > 0) return;
  pulse.value = withRepeat(
    withTiming(PULSE_LOW, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }),
    -1,
    true,
  );
}

function stopPulse() {
  if (--pulsing > 0) return;
  cancelAnimation(pulse);
  pulse.value = 1;
}

type BlockProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * A placeholder block in `surface2`. It pulses gently, or sits still as a
 * flat tint under Reduce Motion. Hidden from VoiceOver: the `Reveal`
 * around a screen's skeleton announces the loading state once.
 */
export function Skeleton({ width = '100%', height = 16, radius = radii.input, style }: BlockProps) {
  const c = useColors();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    startPulse();
    return stopPulse;
  }, [reduceMotion]);

  const animated = useAnimatedStyle(() => ({ opacity: reduceMotion ? 1 : pulse.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: c.surface2 }, style, animated]}
    />
  );
}

/**
 * A line of text that has not loaded. Takes the style the real text will
 * use and holds that line's height, so the layout does not move when the
 * words arrive; the bar inside is shorter than the line, the way a word's
 * x-height is.
 */
export function SkeletonText({
  variant,
  width = '60%',
  style,
}: {
  variant: { fontSize: number };
  width?: DimensionValue;
  style?: StyleProp<ViewStyle>;
}) {
  // Outfit's default line height is about 1.26 of its size.
  const line = Math.round(variant.fontSize * 1.26);
  const bar = Math.max(6, Math.round(variant.fontSize * 0.72));
  return (
    <View style={[{ height: line, justifyContent: 'center', width }, style]}>
      <Skeleton height={bar} radius={bar / 2} />
    </View>
  );
}

/** A round placeholder, for an avatar or a thumbnail. */
export function SkeletonCircle({ size, style }: { size: number; style?: StyleProp<ViewStyle> }) {
  return <Skeleton width={size} height={size} radius={size / 2} style={style} />;
}

/**
 * Shows `skeleton` until `ready`, then the content, faded in over
 * `REVEAL_MS` while the skeleton fades out. Content that is ready on the
 * first render (cached data) shows at once with no fade, because nothing
 * was waiting for it.
 *
 * `children` can be a function so content that reads loaded data is not
 * evaluated while that data is still null.
 */
export function Reveal({
  ready,
  skeleton,
  children,
  style,
}: {
  ready: boolean;
  skeleton: ReactNode;
  children: ReactNode | (() => ReactNode);
  style?: StyleProp<ViewStyle>;
}) {
  // Only content that replaces a skeleton fades. Latched, so a later
  // refresh that briefly unsets `ready` does not matter either way.
  const waited = useRef(!ready);
  if (!ready) waited.current = true;

  if (!ready) {
    return (
      <Animated.View
        key="skeleton"
        exiting={FadeOut.duration(REVEAL_MS)}
        accessible
        accessibilityLabel="Loading"
        style={style}>
        {skeleton}
      </Animated.View>
    );
  }
  const content = typeof children === 'function' ? children() : children;
  return (
    <Animated.View key="content" entering={waited.current ? FadeIn.duration(REVEAL_MS) : undefined} style={style}>
      {content}
    </Animated.View>
  );
}

/** Stacks skeleton rows with a gap, for list placeholders. */
export function SkeletonList({
  count,
  gap,
  children,
}: {
  count: number;
  gap: number;
  children: (index: number) => ReactNode;
}) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i}>{children(i)}</View>
      ))}
    </View>
  );
}
