import { SymbolView } from 'expo-symbols';
import { Children, Fragment, isValidElement } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, View } from 'react-native';

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
  footerColor,
  children,
}: {
  title?: string;
  footer?: string;
  /** Overrides the muted footer color, for a footer that reports an error. */
  footerColor?: string;
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
      {footer ? <Text style={[type.meta, styles.groupFooter, { color: footerColor ?? c.text3 }]}>{footer}</Text> : null}
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
 * A ListRow with a switch on the right in place of the value. `value`
 * null shows a skeleton and holds the switch, as `loading` does on a
 * ListRow, so a setting that has not been read never shows as off.
 *
 * Same height and padding as a ListRow; a `hint` adds a muted line under
 * the label and grows the row. The label (with its hint) and the switch
 * each sit in a column the full height of the row, centred on its own, so
 * the switch is centred against whatever text is beside it.
 *
 * The off track is filled (`ios_backgroundColor` on iOS, `trackColor.false`
 * on Android) so it reads against the row: `border` on light, `checkGlyph`
 * on dark, where `border` is too close to the row's surface.
 */
export function ListSwitch({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean | null;
  onChange: (next: boolean) => void;
  /** A muted line under the label. */
  hint?: string;
}) {
  const { scheme, colors: c } = useTheme();
  const offTrack = scheme === 'dark' ? c.checkGlyph : c.border;
  return (
    <View style={[styles.listRow, hint ? styles.listRowWithHint : null]}>
      <View style={styles.labelColumn}>
        <Text style={[styles.rowLabel, { color: c.text }]}>{label}</Text>
        {hint ? <Text style={[type.meta, { color: c.text3 }]}>{hint}</Text> : null}
      </View>
      <View style={styles.switchColumn}>
        {value == null ? (
          <SkeletonText variant={styles.rowValue} width={48} />
        ) : (
          <Switch
            value={value}
            onValueChange={onChange}
            trackColor={{ false: offTrack, true: c.accent }}
            ios_backgroundColor={offTrack}
            accessibilityLabel={label}
          />
        )}
      </View>
    </View>
  );
}

/**
 * A ListRow with a number between minus and plus buttons on the right.
 * Each tap moves the value by one inside `min` and `max`; a button at its
 * end is disabled.
 */
export function ListStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const c = useTheme().colors;
  const button = (sign: -1 | 1) => {
    const next = value + sign;
    const disabled = next < min || next > max;
    return (
      <Pressable
        onPress={() => onChange(next)}
        disabled={disabled}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={sign < 0 ? `${label}, decrease` : `${label}, increase`}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [styles.stepButton, { borderColor: c.border }, pressed && styles.pressed]}>
        <Text style={[styles.stepGlyph, { color: disabled ? c.text3 : c.accentText }]}>{sign < 0 ? '−' : '+'}</Text>
      </Pressable>
    );
  };
  return (
    <View style={styles.listRow} accessibilityLabel={`${label}, ${value}`}>
      <Text style={[styles.rowLabel, { color: c.text }]}>{label}</Text>
      <View style={styles.stepper}>
        {button(-1)}
        <Text style={[styles.rowValue, styles.stepValue, { color: c.text }]}>{value}</Text>
        {button(1)}
      </View>
    </View>
  );
}

/**
 * A row that does something rather than showing a value, in the row's own
 * color and the same height as a ListRow. Two shapes:
 * - `centered`: a single action like Sign out, the label centred in the
 *   button type the app's other action buttons use.
 * - otherwise a row that opens something, the label on the left and a
 *   chevron on the right when `chevron` is set.
 * Either shows a spinner at the right edge while its action runs.
 */
export function ListAction({
  label,
  color,
  onPress,
  chevron,
  centered,
  busy,
}: {
  label: string;
  color: string;
  onPress: () => void;
  /** For a row that opens another screen. */
  chevron?: boolean;
  /** A single centred action, like Sign out. */
  centered?: boolean;
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
      style={({ pressed }) => [styles.listRow, centered && styles.listActionCentered, pressed && styles.pressed]}>
      <Text style={[centered ? type.button : styles.rowLabel, { color }]}>{label}</Text>
      {busy ? (
        // Absolute when centred, so the label does not shift to make room.
        <ActivityIndicator color={c.text3} style={centered && styles.actionSpinner} />
      ) : chevron && !centered ? (
        <SymbolView
          name={{ ios: 'chevron.right', android: 'chevron_right' }}
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
  listRowWithHint: { paddingVertical: spacing.md },
  labelColumn: { flex: 1, gap: 2, alignSelf: 'stretch', justifyContent: 'center' },
  switchColumn: { alignSelf: 'stretch', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepGlyph: { fontSize: 20, lineHeight: 22, fontWeight: '500' },
  stepValue: { minWidth: 24, textAlign: 'center', fontVariant: ['tabular-nums'] },
  chevron: { fontSize: 20, lineHeight: 22 },
  listActionCentered: { justifyContent: 'center' },
  actionSpinner: { position: 'absolute', right: spacing.card },
  rowLabel: { fontSize: 16 },
  rowValue: { fontSize: 16, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  pressed: { opacity: 0.7 },
});
