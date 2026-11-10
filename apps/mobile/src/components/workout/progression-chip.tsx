import type { ProgressionChip as ChipModel } from '@liftcamp/shared';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line, Polyline } from 'react-native-svg';

import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';

/**
 * The Pro progression chip under an exercise's name: "+5 lb", "+1 rep",
 * "Hold". Tapping it opens the progression sheet.
 *
 * Blue for a step forward, warm gray for hold, deload and welcome back.
 * Light colors are the approved mockup's; dark uses the palette's soft
 * accent and surface so it does not glare.
 *
 * `intro` plays the first-appearance moment once: the chip widens to show
 * "· <short reason>", a soft blue ring pulses twice, a shine crosses it
 * once, and after about 3 s it narrows again and calls `onIntroDone`. With
 * Reduce Motion the reason shows and goes with no movement.
 */

const HEIGHT = 26;
const ICON = 15;
/** Pads the 26pt chip's hit area to 44pt. */
const HIT_SLOP = { top: 9, bottom: 9, left: 6, right: 6 };
const INTRO_MS = 3000;
const PULSE_MS = 700;
const SHINE_MS = 650;
const SHINE_WIDTH = 22;

const LIGHT = {
  up: { fill: '#EEF4FB', border: '#C9DAEE', text: '#1B5FA8' },
  neutral: { fill: '#F4F1EC', border: '#E4DFD6', text: '#5A554C' },
};

function ChipIcon({ icon, color }: { icon: ChipModel['icon']; color: string }) {
  const stroke = { stroke: color, strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      {icon === 'up' ? (
        <>
          <Polyline points="22 7 13.5 15.5 8.5 10.5 2 17" {...stroke} />
          <Polyline points="16 7 22 7 22 13" {...stroke} />
        </>
      ) : icon === 'down' ? (
        <>
          <Polyline points="22 17 13.5 8.5 8.5 13.5 2 7" {...stroke} />
          <Polyline points="16 17 22 17 22 11" {...stroke} />
        </>
      ) : (
        <>
          <Line x1="5" y1="9" x2="19" y2="9" {...stroke} />
          <Line x1="5" y1="15" x2="19" y2="15" {...stroke} />
        </>
      )}
    </Svg>
  );
}

export function ProgressionChip({
  chip,
  intro = false,
  onPress,
  onIntroDone,
}: {
  chip: ChipModel;
  intro?: boolean;
  onPress: () => void;
  onIntroDone?: () => void;
}) {
  const { scheme, colors: c } = useTheme();
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [width, setWidth] = useState(0);
  const pulse = useSharedValue(0);
  const shine = useSharedValue(0);

  const colors =
    scheme === 'dark'
      ? chip.tone === 'up'
        ? { fill: c.accentSoft, border: c.accentSoft, text: c.accentText }
        : { fill: c.surface2, border: c.border, text: c.text2 }
      : LIGHT[chip.tone];

  useEffect(() => {
    if (!intro) return;
    setExpanded(true);
    if (!reduceMotion) {
      // Two pulses, then the shine once while the second fades.
      pulse.value = withRepeat(withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) }), 2, false);
      shine.value = withDelay(PULSE_MS / 2, withTiming(1, { duration: SHINE_MS, easing: Easing.inOut(Easing.quad) }));
    }
    const t = setTimeout(() => {
      setExpanded(false);
      onIntroDone?.();
    }, INTRO_MS);
    return () => {
      clearTimeout(t);
      setExpanded(false);
    };
    // Plays once per mount of an intro chip; the caller stops passing `intro` after.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intro]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: pulse.value === 0 ? 0 : 0.55 * (1 - pulse.value),
    transform: [{ scaleX: 1 + 0.12 * pulse.value }, { scaleY: 1 + 0.45 * pulse.value }],
  }));
  const shineStyle = useAnimatedStyle(() => ({
    opacity: shine.value > 0 && shine.value < 1 ? 1 : 0,
    transform: [{ translateX: -SHINE_WIDTH + shine.value * (width + SHINE_WIDTH * 2) }, { skewX: '-20deg' }],
  }));

  const label = expanded ? `${chip.label} · ${chip.short}` : chip.label;

  return (
    <View style={styles.wrap}>
      {reduceMotion ? null : (
        <Animated.View
          pointerEvents="none"
          style={[styles.ring, { borderColor: scheme === 'dark' ? c.accentText : '#1B5FA8' }, ringStyle]}
        />
      )}
      <Animated.View layout={reduceMotion ? undefined : LinearTransition.duration(250)}>
        <Pressable
          onPress={onPress}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={`${label}. Today's progression`}
          accessibilityHint="Shows how today's sets were worked out"
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
          style={({ pressed }) => [
            styles.chip,
            { backgroundColor: colors.fill, borderColor: colors.border },
            pressed && styles.pressed,
          ]}>
          <ChipIcon icon={chip.icon} color={colors.text} />
          <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
            {chip.label}
          </Text>
          {expanded ? (
            <Animated.View
              entering={reduceMotion ? undefined : FadeIn.duration(200)}
              exiting={reduceMotion ? undefined : FadeOut.duration(150)}>
              <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
                {`· ${chip.short}`}
              </Text>
            </Animated.View>
          ) : null}
          {reduceMotion ? null : (
            <Animated.View pointerEvents="none" style={[styles.shine, shineStyle]} />
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  chip: {
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    overflow: 'hidden',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  ring: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: HEIGHT / 2,
    borderWidth: 2,
  },
  shine: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    left: 0,
    width: SHINE_WIDTH,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  pressed: { opacity: 0.7 },
});
