import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

const ROW_HEIGHT = 52;

/** Separators stop short of the tile edge, so the fill reads as one block. */
const SEPARATOR_INSET = '5%';

export type SheetMenuItem<T extends string = string> = {
  key: T;
  label: string;
  /** Renders in the danger colour. Put destructive rows last. */
  destructive?: boolean;
};

/**
 * One grouped tile of tappable rows, the iOS settings pattern.
 *
 * Separators are drawn on the rows rather than between them so the tile keeps
 * its rounded corners without clipping, and the last row never carries one.
 */
export function SheetMenu<T extends string>({
  items,
  onSelect,
}: {
  items: SheetMenuItem<T>[];
  onSelect: (key: T) => void;
}) {
  const c = useColors();

  return (
    <View style={[styles.tile, { backgroundColor: c.surface2 }]}>
      {items.map((item, i) => (
        <View key={item.key}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onSelect(item.key)}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: `${c.text}0D` }]}>
            <Text style={[styles.label, { color: item.destructive ? c.danger : c.text }]}>
              {item.label}
            </Text>
          </Pressable>
          {i < items.length - 1 ? (
            <View style={[styles.separator, { backgroundColor: c.border }]} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: radius.bar,
    overflow: 'hidden',
  },
  row: {
    height: ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 17,
  },
  separator: {
    height: 1,
    marginHorizontal: SEPARATOR_INSET,
  },
});
