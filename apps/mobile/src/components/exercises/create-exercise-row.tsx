import { customUsageLine, type CustomExerciseStatus } from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { listSurface, radius, spacing, type } from '@/theme/tokens';

/**
 * The way into the custom exercise sheet from a search that found
 * nothing: in place of "No exercises match", it offers to create the
 * term by name. (The standing way in is New in the header.) Free users
 * see their count against the cap. At the cap the row still shows, and
 * the host opens the limit sheet instead of the create sheet.
 *
 * The hosts render it only when the way in shows at all, so the two
 * screens look exactly as they did for everyone else.
 */
export function CreateExerciseRow({
  status,
  term,
  onPress,
}: {
  status: CustomExerciseStatus;
  /** The search that found nothing, for the label. */
  term: string;
  onPress: () => void;
}) {
  const { scheme, colors: c } = useTheme();
  // The hosts decide whether the row shows (showCustomEntry in shared);
  // a guest gets it too, with no count, since the tap asks them to sign up.
  const usage = status.enabled ? customUsageLine(status) : null;
  const label = term.trim() ? `Create "${term.trim()}"` : 'Create a custom exercise';
  return (
    <View style={styles.wrap}>
      <Text style={[type.meta, styles.copy, { color: c.text2 }]}>No exercises match.</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, listSurface(scheme, c), pressed && styles.pressed]}>
        <View style={[styles.plus, { backgroundColor: c.accentSoft }]}>
          <SymbolView
            name={{ ios: 'plus', android: 'add' }}
            size={20}
            tintColor={c.accentText}
            fallback={<Text style={[type.button, { color: c.accentText }]}>+</Text>}
          />
        </View>
        <View style={styles.text}>
          <Text style={[type.exerciseName, { color: c.accentText }]} numberOfLines={1}>
            {label}
          </Text>
          {usage ? (
            <Text style={[type.meta, { color: c.text2 }]} numberOfLines={1}>
              {usage}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: spacing.lg, gap: spacing.md },
  copy: { textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.bar,
    padding: spacing.md,
  },
  plus: {
    width: 44,
    height: 44,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  pressed: { opacity: 0.7 },
});
