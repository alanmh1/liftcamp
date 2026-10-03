import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/text';
import { mmss, RestRing, restFraction } from '@/components/workout/rest-row';
import { useColors } from '@/theme/theme-provider';
import { palettes, tabular } from '@/theme/tokens';

const RING = 52;
const STROKE = 5;
const SLIDE = { duration: 220, easing: Easing.out(Easing.cubic) };
/** Off screen before the first layout is measured. */
const FALLBACK_HEIGHT = 160;

/**
 * The rest timer, pinned to the bottom of the workout screen while a rest
 * runs. One row: the depleting ring, "Rest" over the time, −15, +15 and an
 * outlined Skip. It slides up when a rest starts and down when it ends.
 *
 * Not modal: no backdrop, taps outside go through to the list, and nothing
 * outside dismisses it. −15 and +15 never dismiss; the screen ends the rest
 * when −15 takes it to zero, the same way as running out. Skip ends it at
 * once. Checking another set restarts the rest, and the tray stays up.
 *
 * A tap on the ring or the time opens the rest sheet, which keeps the rest
 * length presets and "Remember for <exercise>".
 *
 * `onHeight` reports the tray's height while it is up and 0 once it is
 * down, so the screen can pad the list for the last set to scroll above it.
 */
export function RestTray({
  active,
  remaining,
  total,
  bottomInset,
  onAdjust,
  onSkip,
  onOpenOptions,
  onHeight,
}: {
  /** A rest is running. */
  active: boolean;
  /** Seconds left. */
  remaining: number;
  /** The rest's full length in seconds, for the ring. */
  total: number;
  /** The screen's bottom safe area inset. */
  bottomInset: number;
  onAdjust: (deltaSeconds: number) => void;
  onSkip: () => void;
  onOpenOptions: () => void;
  onHeight: (height: number) => void;
}) {
  const c = useColors();
  const reduceMotion = useReducedMotion();
  // Mounted from the slide up until the slide down has finished.
  const [mounted, setMounted] = useState(active);
  const [height, setHeight] = useState(0);
  // The last time and length shown, held while the tray slides away.
  const [shown, setShown] = useState({ remaining, total });
  const y = useSharedValue(active ? 0 : FALLBACK_HEIGHT);

  if (active && (shown.remaining !== remaining || shown.total !== total)) {
    setShown({ remaining, total });
  }

  useEffect(() => {
    if (active) {
      setMounted(true);
      y.value = reduceMotion ? 0 : withTiming(0, SLIDE);
    } else {
      const off = height || FALLBACK_HEIGHT;
      if (reduceMotion) {
        y.value = off;
        setMounted(false);
      } else {
        y.value = withTiming(off, SLIDE, (finished) => {
          if (finished) runOnJS(setMounted)(false);
        });
      }
    }
    // `height` is read for the slide's distance, not a reason to slide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduceMotion, y]);

  useEffect(() => {
    onHeight(active ? height : 0);
  }, [active, height, onHeight]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  if (!mounted) return null;

  return (
    <Animated.View
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        // Starts below its own height on the first frame, then slides up.
        if (!height && active && !reduceMotion) {
          y.value = h;
          y.value = withTiming(0, SLIDE);
        }
        setHeight(h);
      }}
      style={[
        styles.tray,
        { backgroundColor: c.surface, paddingBottom: Math.max(bottomInset - 8, 16) },
        slide,
      ]}>
      <Pressable
        onPress={onOpenOptions}
        accessibilityRole="button"
        accessibilityLabel={`Rest, ${mmss(shown.remaining)} left`}
        accessibilityHint="Opens rest options"
        style={({ pressed }) => [styles.timer, pressed && styles.pressed]}>
        <RestRing
          size={RING}
          stroke={STROKE}
          fraction={restFraction(shown.remaining, shown.total)}
          trackColor={c.accentSoft}
        />
        <View style={styles.text}>
          <Text style={[styles.label, { color: c.text2 }]}>Rest</Text>
          <Text style={[styles.time, { color: c.text }]}>{mmss(shown.remaining)}</Text>
        </View>
      </Pressable>

      <Pressable
        onPress={() => onAdjust(-15)}
        accessibilityRole="button"
        accessibilityLabel="Subtract 15 seconds"
        style={({ pressed }) => [styles.step, { backgroundColor: c.surface2 }, pressed && styles.pressed]}>
        <Text style={[styles.button, { color: c.text }]}>{'−15'}</Text>
      </Pressable>
      <Pressable
        onPress={() => onAdjust(15)}
        accessibilityRole="button"
        accessibilityLabel="Add 15 seconds"
        style={({ pressed }) => [styles.step, { backgroundColor: c.surface2 }, pressed && styles.pressed]}>
        <Text style={[styles.button, { color: c.text }]}>+15</Text>
      </Pressable>
      <Pressable
        onPress={onSkip}
        accessibilityRole="button"
        accessibilityLabel="Skip rest"
        style={({ pressed }) => [styles.skip, { borderColor: c.accentText }, pressed && styles.pressed]}>
        <Text style={[styles.button, { color: c.accentText }]}>Skip</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tray: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 16,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    // A soft lift upward, about 0 -6 20 at 8% ink.
    shadowColor: palettes.light.text,
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 8,
  },
  // The ring and the text column: the tray's flexible part.
  timer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  text: { flex: 1 },
  label: { fontSize: 13, fontWeight: '500' },
  time: { fontSize: 30, fontWeight: '700', lineHeight: 33, ...tabular },
  step: { width: 48, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  skip: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: { fontSize: 15, fontWeight: '600', ...tabular },
  pressed: { opacity: 0.7 },
});
