import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/** A row of equal segments, one selected. Plain pressables in the app's tokens. */
export function Segmented<T extends string>({
  segments,
  value,
  onChange,
}: {
  segments: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const c = useColors();
  return (
    <View style={[styles.track, { backgroundColor: c.surface2 }]}>
      {segments.map((s) => {
        const selected = s.key === value;
        return (
          <Pressable
            key={s.key}
            onPress={() => onChange(s.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.segment,
              selected && { backgroundColor: c.surface },
              pressed && !selected && styles.pressed,
            ]}>
            <Text style={[type.button, { fontSize: 14, color: selected ? c.text : c.text2 }]}>{s.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: radius.input, padding: 3 },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.input - 3,
  },
  pressed: { opacity: 0.6 },
});
