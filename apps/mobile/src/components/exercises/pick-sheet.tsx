import { forwardRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

export type PickOption<T extends string> = { key: T; label: string; icon?: ReactNode };

/**
 * A single-select list in a sheet, for the library's Muscle, Equipment and
 * Level chips. Picking an option closes the sheet; the chip's own clear
 * control is how a filter comes off.
 */
export const PickSheet = forwardRef<
  SheetRef,
  { title: string; options: PickOption<string>[]; value: string | null; onPick: (key: string) => void }
>(function PickSheet({ title, options, value, onPick }, ref) {
  const c = useColors();
  return (
    <Sheet ref={ref} scroll>
      <Text style={[styles.header, { color: c.text2 }]}>{title}</Text>
      <View style={styles.list}>
        {options.map((o) => {
          const selected = o.key === value;
          return (
            <Pressable
              key={o.key}
              onPress={() => {
                onPick(o.key);
                (ref as React.RefObject<SheetRef | null>).current?.dismiss();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.row,
                selected && { backgroundColor: c.accentSoft },
                pressed && styles.pressed,
              ]}>
              {o.icon ? <View style={styles.icon}>{o.icon}</View> : null}
              <Text style={[type.meta, styles.label, { color: selected ? c.accentText : c.text, fontSize: 15 }]}>
                {o.label}
              </Text>
              {selected ? <Text style={[type.button, { color: c.accentText }]}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
});

/**
 * A multi-select list in a sheet, for a custom exercise's secondary
 * muscles. Rows toggle; the sheet stays up until Done or a drag down.
 */
export const PickManySheet = forwardRef<
  SheetRef,
  {
    title: string;
    options: PickOption<string>[];
    values: readonly string[];
    onToggle: (key: string) => void;
  }
>(function PickManySheet({ title, options, values, onToggle }, ref) {
  const c = useColors();
  return (
    <Sheet ref={ref} scroll>
      <View style={styles.headRow}>
        <Text style={[styles.header, { color: c.text2 }]}>{title}</Text>
        <Pressable
          onPress={() => (ref as React.RefObject<SheetRef | null>).current?.dismiss()}
          hitSlop={10}
          accessibilityRole="button">
          <Text style={[type.button, { color: c.accentText }]}>Done</Text>
        </Pressable>
      </View>
      <View style={styles.list}>
        {options.map((o) => {
          const selected = values.includes(o.key);
          return (
            <Pressable
              key={o.key}
              onPress={() => onToggle(o.key)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              style={({ pressed }) => [
                styles.row,
                selected && { backgroundColor: c.accentSoft },
                pressed && styles.pressed,
              ]}>
              {o.icon ? <View style={styles.icon}>{o.icon}</View> : null}
              <Text style={[type.meta, styles.label, { color: selected ? c.accentText : c.text, fontSize: 15 }]}>
                {o.label}
              </Text>
              {selected ? <Text style={[type.button, { color: c.accentText }]}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
});

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  header: { fontSize: 15, paddingBottom: spacing.md, paddingHorizontal: 4 },
  list: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
  },
  icon: { width: 22, alignItems: 'center' },
  label: { flex: 1 },
  pressed: { opacity: 0.6 },
});
