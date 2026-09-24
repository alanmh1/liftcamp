import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/**
 * The building blocks Profile and Settings share: a labelled section, a
 * selectable chip, and a tappable value row that opens an editor.
 */

type Colors = ReturnType<typeof useTheme>['colors'];

export function Section({
  title,
  c,
  children,
}: {
  title: string;
  c: Colors;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[type.label, { color: c.text3 }]}>{title}</Text>
      {children}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  c,
  numeral,
  capitalize = true,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  c: Colors;
  numeral?: boolean;
  /** Off for labels that are already cased, like "Prefer not to say". */
  capitalize?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? c.accentSoft : c.surface2,
          borderColor: selected ? c.accent : 'transparent',
        },
      ]}>
      <Text
        style={[
          numeral ? type.setNumeral : type.button,
          {
            color: selected ? c.accentText : c.text,
            textTransform: numeral || !capitalize ? undefined : 'capitalize',
          },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A bordered row: the value on the left, an action word on the right. */
export function ValueRow({
  value,
  action,
  onPress,
  accessibilityLabel,
  c,
}: {
  /** Null shows nothing on the left, for a field with no value yet. */
  value: string | null;
  action: string;
  onPress: () => void;
  accessibilityLabel: string;
  c: Colors;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.valueRow, { borderColor: c.border }, pressed && styles.pressed]}>
      <Text style={[type.meta, { color: c.text, fontSize: 15 }]}>{value ?? ' '}</Text>
      <Text style={[type.button, { color: c.accentText, fontSize: 14 }]}>{action}</Text>
    </Pressable>
  );
}

export const settingsStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  pressed: { opacity: 0.7 },
});

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  chip: {
    minWidth: 56,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.bar,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.7 },
});
