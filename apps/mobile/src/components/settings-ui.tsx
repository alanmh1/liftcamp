import { SymbolView } from 'expo-symbols';
import { Children, Fragment, isValidElement } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { SkeletonText } from '@/components/skeleton';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { listSurface, radius, spacing, type } from '@/theme/tokens';

/**
 * The building blocks Profile and Settings share: a labelled section, a
 * selectable chip, and the grouped list Settings is built from.
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

/**
 * A grouped list: an optional label above, flat rows with hairlines between
 * them, and an optional muted footer line below. Flat per the elevation
 * rule, so no shadow.
 */
export function ListGroup({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: React.ReactNode;
}) {
  const { scheme, colors: c } = useTheme();
  // Fragments and nulls from conditional rows are flattened out, so the
  // hairline only ever sits between two real rows.
  const rows: React.ReactNode[] = [];
  const collect = (nodes: React.ReactNode) =>
    Children.forEach(nodes, (child) => {
      if (isValidElement<{ children?: React.ReactNode }>(child) && child.type === Fragment) collect(child.props.children);
      else if (child != null && child !== false) rows.push(child);
    });
  collect(children);
  return (
    <View style={styles.group}>
      {title ? <Text style={[type.label, styles.groupTitle, { color: c.text3 }]}>{title}</Text> : null}
      <View style={[styles.groupBody, listSurface(scheme, c)]}>
        {rows.map((row, i) => (
          <View key={i} style={i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.border }}>
            {row}
          </View>
        ))}
      </View>
      {footer ? <Text style={[type.meta, styles.groupFooter, { color: c.text3 }]}>{footer}</Text> : null}
    </View>
  );
}

/**
 * One 52 pt row: the label on the left, the value on the right in the
 * accent. An empty value reads "Add". The whole row is the tap target;
 * without `onPress` it is plain text and the value is muted.
 *
 * `loading` shows a skeleton line in place of the value and holds the tap,
 * so a field that has not been read yet never reads "Add".
 */
export function ListRow({
  label,
  value,
  onPress,
  loading = false,
}: {
  label: string;
  value: string | null;
  onPress?: () => void;
  loading?: boolean;
}) {
  const c = useTheme().colors;
  const shown = value ?? 'Add';
  const body = (
    <>
      <Text style={[styles.rowLabel, { color: c.text }]}>{label}</Text>
      {loading ? (
        <SkeletonText variant={styles.rowValue} width={72} />
      ) : (
        <Text style={[styles.rowValue, { color: onPress ? c.accentText : c.text2 }]} numberOfLines={1}>
          {shown}
        </Text>
      )}
    </>
  );
  if (!onPress || loading) {
    return (
      <View
        style={styles.listRow}
        accessible={loading || undefined}
        accessibilityLabel={loading ? `${label}, loading` : undefined}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${shown}`}
      style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

/**
 * A row that does something rather than showing a value: the label on the
 * left in the row's own color, the same size and padding as a ListRow. A
 * chevron on the right when it opens another screen, a spinner while its
 * action runs.
 */
export function ListAction({
  label,
  color,
  onPress,
  chevron,
  busy,
}: {
  label: string;
  color: string;
  onPress: () => void;
  /** For a row that opens another screen. */
  chevron?: boolean;
  /** Disables the row and shows a spinner on the right while an action runs. */
  busy?: boolean;
}) {
  const c = useTheme().colors;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ busy: !!busy, disabled: !!busy }}
      style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}>
      <Text style={[styles.rowLabel, { color }]}>{label}</Text>
      {busy ? (
        <ActivityIndicator color={c.text3} />
      ) : chevron ? (
        <SymbolView
          name="chevron.right"
          size={14}
          tintColor={c.text3}
          fallback={<Text style={[styles.chevron, { color: c.text3 }]}>›</Text>}
        />
      ) : null}
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
  group: { gap: spacing.sm },
  groupTitle: { paddingHorizontal: spacing.xs },
  groupBody: { borderRadius: radius.bar, overflow: 'hidden' },
  groupFooter: { paddingHorizontal: spacing.xs },
  listRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.card,
  },
  chevron: { fontSize: 20, lineHeight: 22 },
  rowLabel: { fontSize: 16 },
  rowValue: { fontSize: 16, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  pressed: { opacity: 0.7 },
});
