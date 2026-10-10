import type { KudosState } from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { Text } from '@/components/text';
import { tapKudos, useKudos } from '@/lib/kudos';
import { useColors } from '@/theme/theme-provider';
import { spacing, tabular } from '@/theme/tokens';

/**
 * The thumbs up and the kudos count: no label, no outline. Filled in the
 * accent once given. A tap gives kudos or takes it back (lib/kudos.ts);
 * nothing else on the card reacts to it.
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

  return (
    <Pressable
      onPress={() => {
        if (me) void tapKudos(me, workoutId, state);
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={state.given ? 'Takes your kudos back' : 'Gives kudos'}
      accessibilityState={{ selected: state.given }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <SymbolView
        name={{ ios: state.given ? 'hand.thumbsup.fill' : 'hand.thumbsup', android: 'thumb_up' }}
        size={22}
        tintColor={tint}
        fallback={<Text style={{ color: tint, fontSize: 18 }}>👍</Text>}
      />
      <Text style={[styles.count, { color: tint }]}>{state.count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingRight: spacing.sm },
  count: { fontSize: 15, fontWeight: '600', ...tabular },
  pressed: { opacity: 0.6 },
});
