import { customUsageLine, type CustomExerciseStatus } from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { listSurface, radius, spacing, type } from '@/theme/tokens';

/**
 * The way into the custom exercise sheet, in the library and the picker.
 * Two looks: `miss`, in place of "No exercises match", offers to create
 * the search term by name; `footer`, under the list, is the quieter
 * standing row. Free users see their count against the cap on both. At
 * the cap the row still shows (the feature should be found), and the
 * host opens the limit sheet instead of the create sheet.
 *
 * Renders nothing when the status is unknown or the flag is off, so the
 * two screens look exactly as they did for everyone else.
 */
export function CreateExerciseRow({
  status,
  variant,
  term,
  onPress,
}: {
  status: CustomExerciseStatus | null;
  variant: 'miss' | 'footer';
  /** The search that found nothing, for the `miss` row's label. */
  term?: string;
  onPress: () => void;
}) {
  const { scheme, colors: c } = useTheme();
  if (!status?.enabled) return null;
  const usage = customUsageLine(status);
  const label = variant === 'miss' && term?.trim() ? `Create "${term.trim()}"` : 'Create a custom exercise';
  return (
    <View style={variant === 'miss' ? styles.missWrap : styles.footerWrap}>
      {variant === 'miss' ? (
        <Text style={[type.meta, styles.missCopy, { color: c.text2 }]}>No exercises match.</Text>
      ) : null}
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
  missWrap: { paddingTop: spacing.lg, gap: spacing.md },
  missCopy: { textAlign: 'center' },
  footerWrap: { paddingTop: spacing.sm },
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
