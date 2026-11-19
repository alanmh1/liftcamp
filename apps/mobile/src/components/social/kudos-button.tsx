import type { KudosState } from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useAuth } from '@/components/auth-provider';
import { useCommunityRules } from '@/components/social/community-rules-sheet';
import { Text } from '@/components/text';
import { confirm } from '@/lib/haptics';
import { tapKudos, useKudos } from '@/lib/kudos';
import { useColors } from '@/theme/theme-provider';
import { spacing, tabular } from '@/theme/tokens';

/**
 * The thumbs up and the kudos count: no label, no outline. Filled in the
 * accent once given. A tap gives kudos or takes it back (lib/kudos.ts);
 * nothing else on the card reacts to it.
 *
 * Giving kudos pops the thumb once: up to 1.3x with a 12 degree tilt, then
 * a spring back, about 350 ms, with a light haptic. It runs from the tap
 * only, so taking kudos back, and the store undoing a refused like (42501),
 * just switch the icon. Reduce Motion skips the pop and keeps the haptic.
 *
 * Giving kudos asks for the community rules first, once per account;
 * taking kudos back never does.
 *
 * SF Symbol on iOS, Material Symbol on Android, so no image assets.
 */
export function KudosButton({ workoutId, fromRead }: { workoutId: string; fromRead: KudosState }) {
  const c = useColors();
  const { session } = useAuth();
  const me = session?.user.id ?? null;
  const state = useKudos(me, workoutId, fromRead);
  const tint = state.given ? c.accentText : c.text2;
  const label = `${state.count} kudos${state.given ? ', given by you' : ''}`;
  const reduceMotion = useReducedMotion();
  const requireRules = useCommunityRules();
  const pop = useSharedValue(0);
  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.3 * pop.value }, { rotate: `${-12 * pop.value}deg` }],
  }));

  return (
    <Pressable
      onPress={() => {
        if (!me) return;
        if (state.given) {
          void tapKudos(me, workoutId, state);
          return;
        }
        void requireRules(() => {
          confirm();
          if (!reduceMotion) {
            pop.value = withSequence(
              withTiming(1, { duration: 120 }),
              withSpring(0, { damping: 9, stiffness: 260, mass: 0.6 }),
            );
          }
          return tapKudos(me, workoutId, state);
        });
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={state.given ? 'Takes your kudos back' : 'Gives kudos'}
      accessibilityState={{ selected: state.given }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Animated.View style={popStyle}>
        <SymbolView
          name={{ ios: state.given ? 'hand.thumbsup.fill' : 'hand.thumbsup', android: 'thumb_up' }}
          size={22}
          tintColor={tint}
          fallback={<Text style={{ color: tint, fontSize: 18 }}>👍</Text>}
        />
      </Animated.View>
      <Text style={[styles.count, { color: tint }]}>{state.count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingRight: spacing.sm },
  count: { fontSize: 15, fontWeight: '600', ...tabular },
  pressed: { opacity: 0.6 },
});
