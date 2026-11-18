import { rangeFor, rangeLabel, type RangeChoice, type RangePreset } from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DateRangeSheet, type DateRangeSheetRef } from '@/components/date-range-sheet';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

const BUTTON = 40;

/**
 * The range control on Profile and Trends: a segmented track of presets
 * and a round calendar button that opens the custom range sheet. The
 * button is accent-soft when idle and solid accent while a custom range is
 * on, and a custom range shows its dates under the track.
 */
export function RangeControl({
  presets,
  choice,
  onChange,
  firstWorkoutDate,
}: {
  presets: readonly RangePreset[];
  choice: RangeChoice;
  onChange: (next: RangeChoice) => void;
  firstWorkoutDate: string | null;
}) {
  const { scheme, colors: c } = useTheme();
  const sheet = useRef<DateRangeSheetRef>(null);
  const custom = typeof choice !== 'string';
  const selectedFill = scheme === 'dark' ? c.border : '#FFFFFF';

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={[styles.track, { backgroundColor: c.surface2 }]} accessibilityRole="tablist">
          {presets.map((p) => {
            const selected = choice === p;
            return (
              <Pressable
                key={p}
                onPress={() => onChange(p)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={rangeLabel(rangeFor(p, new Date()))}
                style={[styles.segment, selected && [styles.selected, { backgroundColor: selectedFill }]]}>
                <Text style={[styles.segmentLabel, { color: selected ? c.text : c.text2 }]}>{p}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={() => sheet.current?.open(choice)}
          accessibilityRole="button"
          accessibilityLabel="Custom range"
          accessibilityState={{ selected: custom }}
          style={({ pressed }) => [
            styles.calendar,
            { backgroundColor: custom ? c.accent : c.accentSoft },
            pressed && styles.pressed,
          ]}>
          <SymbolView
            name={{ ios: 'calendar', android: 'calendar_month' }}
            size={18}
            tintColor={custom ? '#FFFFFF' : c.accentText}
            fallback={<Text style={{ color: custom ? '#FFFFFF' : c.accentText }}>▦</Text>}
          />
        </Pressable>
      </View>
      {custom ? (
        <Text style={[type.meta, styles.customLabel, { color: c.text2 }]}>{rangeLabel(rangeFor(choice, new Date()))}</Text>
      ) : null}
      <DateRangeSheet ref={sheet} firstWorkoutDate={firstWorkoutDate} onApply={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { flex: 1, flexDirection: 'row', borderRadius: radius.pill, padding: 3, height: BUTTON },
  segment: { flex: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  selected: {
    shadowColor: '#221F1B',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentLabel: { fontSize: 13, fontWeight: '600' },
  calendar: { width: BUTTON, height: BUTTON, borderRadius: BUTTON / 2, alignItems: 'center', justifyContent: 'center' },
  customLabel: { paddingHorizontal: spacing.xs },
  pressed: { opacity: 0.7 },
});
