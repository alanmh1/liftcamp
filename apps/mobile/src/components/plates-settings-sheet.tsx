import { BAR_WEIGHT_OPTIONS, formatPlate, PLATE_OPTIONS, type WeightUnit } from '@liftcamp/shared';
import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { Chip, settingsStyles } from '@/components/settings-ui';
import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

/**
 * Pro: Settings → Plates. The bar (one of three chips) and the plates the
 * gym has (any of eight), in the user's unit. Each tap saves through
 * `onChange`. The last checked plate cannot be unchecked, so the plate
 * calculator always has something to load.
 */
export const PlatesSettingsSheet = forwardRef<
  SheetRef,
  {
    unit: WeightUnit;
    /** "lbs" or "kg". */
    unitLabel: string;
    bar: number;
    plates: readonly number[];
    onChange: (next: { bar: number; plates: number[] }) => void;
  }
>(function PlatesSettingsSheet({ unit, unitLabel, bar, plates, onChange }, ref) {
  const c = useColors();
  const has = (p: number) => plates.some((x) => Math.abs(x - p) < 0.001);

  function toggle(p: number) {
    const next = has(p) ? plates.filter((x) => Math.abs(x - p) >= 0.001) : [...plates, p];
    if (next.length === 0) return;
    onChange({ bar, plates: PLATE_OPTIONS[unit].filter((o) => next.some((x) => Math.abs(x - o) < 0.001)) });
  }

  return (
    <Sheet ref={ref}>
      <Text style={[styles.header, { color: c.text2 }]}>Bar weight</Text>
      <View style={settingsStyles.row}>
        {BAR_WEIGHT_OPTIONS[unit].map((b) => (
          <Chip
            key={b}
            label={`${formatPlate(b)} ${unitLabel}`}
            selected={Math.abs(b - bar) < 0.001}
            onPress={() => onChange({ bar: b, plates: [...plates] })}
            c={c}
            numeral
          />
        ))}
      </View>
      <Text style={[styles.header, styles.second, { color: c.text2 }]}>Plates at your gym</Text>
      <View style={settingsStyles.row}>
        {PLATE_OPTIONS[unit].map((p) => (
          <Chip key={p} label={formatPlate(p)} selected={has(p)} onPress={() => toggle(p)} c={c} numeral />
        ))}
      </View>
      <Text style={[type.meta, styles.hint, { color: c.text2 }]}>
        The plate calculator loads only the plates you pick, a pair at a time.
      </Text>
    </Sheet>
  );
});

const styles = StyleSheet.create({
  header: { fontSize: 15, paddingBottom: spacing.md, paddingHorizontal: 4 },
  second: { paddingTop: spacing.lg },
  hint: { paddingTop: spacing.md, paddingHorizontal: 4 },
});
