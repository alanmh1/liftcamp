import {
  formatPlate,
  perSideLabel,
  plateColor,
  platesForWeight,
  plateShortfall,
  type PlateColor,
} from '@liftcamp/shared';
import { forwardRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing, tabular, type } from '@/theme/tokens';

/**
 * Pro: the plate calculator. The weight as the title, a row of plate chips
 * for one side of the bar, heaviest first, and the same plates in words
 * ("Per side 45, 25, 10") for VoiceOver and for anyone who would rather
 * read. When the checked plates cannot make the weight, a line names the
 * closest one under it; with `onPick` (opened from a weight box) that
 * number is a button that puts it in the box.
 *
 * Plates follow the competition colours (`plateColor` in shared) in Chalk
 * tones. The yellow plate is a muted ochre, since flat in-app gold is for
 * PRs only.
 */
export type PlateTarget = {
  weight: number;
  bar: number;
  plates: readonly number[];
};

const PLATE_TONES: Record<PlateColor, { fill: string; text: string; border?: string }> = {
  blue: { fill: '#1B5FA8', text: '#FFFFFF' },
  yellow: { fill: '#C49A2C', text: '#221F1B' },
  green: { fill: '#2E8A57', text: '#FFFFFF' },
  white: { fill: '#FDFCFB', text: '#221F1B', border: '#DCD6CD' },
  red: { fill: '#B8402F', text: '#FFFFFF' },
  small: { fill: '#5A554C', text: '#FFFFFF' },
};

export const PlateSheet = forwardRef<
  SheetRef,
  {
    target: PlateTarget | null;
    /** "lbs" or "kg", as the app prints the unit. */
    unitLabel: string;
    unit: 'lb' | 'kg';
    /** Puts the closest weight in the box the sheet was opened from. */
    onPick?: (weight: number) => void;
  }
>(function PlateSheet({ target, unitLabel, unit, onPick }, ref) {
  const { colors: c } = useTheme();
  const load = target ? platesForWeight(target.weight, target.bar, target.plates) : null;
  const short = target && load ? plateShortfall(target.weight, load) : null;

  function pick(weight: number) {
    onPick?.(weight);
    (ref as React.RefObject<SheetRef | null>).current?.dismiss();
  }

  return (
    <Sheet ref={ref}>
      {target && load ? (
        <View style={styles.body}>
          <Text style={[styles.title, tabular, { color: c.text }]}>
            {formatPlate(target.weight)} {unitLabel}
          </Text>
          <Text style={[type.meta, { color: c.text2 }]}>
            {formatPlate(target.bar)} {unitLabel} bar
          </Text>

          {load.perSide.length > 0 ? (
            <View style={styles.plates} accessible={false} importantForAccessibility="no-hide-descendants">
              {load.perSide.map((p, i) => {
                const tone = PLATE_TONES[plateColor(p, unit)];
                return (
                  <View
                    key={i}
                    style={[
                      styles.plate,
                      { backgroundColor: tone.fill, borderColor: tone.border ?? tone.fill },
                    ]}>
                    <Text style={[styles.plateText, tabular, { color: tone.text }]}>{formatPlate(p)}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          <Text style={[styles.words, tabular, { color: c.text }]}>{perSideLabel(load)}</Text>

          {short ? (
            <Text style={[type.meta, { color: c.text2 }]}>
              {short.before}
              {onPick ? (
                <Text
                  onPress={() => pick(short.closest)}
                  accessibilityRole="button"
                  style={[type.button, tabular, { color: c.accentText }]}>
                  {formatPlate(short.closest)}
                </Text>
              ) : (
                <Text style={tabular}>{formatPlate(short.closest)}</Text>
              )}
            </Text>
          ) : null}

          <Pressable
            onPress={() => (ref as React.RefObject<SheetRef | null>).current?.dismiss()}
            accessibilityRole="button"
            style={({ pressed }) => [styles.done, { backgroundColor: c.accent }, pressed && styles.pressed]}>
            <Text style={[type.button, { color: '#FFFFFF' }]}>Done</Text>
          </Pressable>
        </View>
      ) : null}
    </Sheet>
  );
});

const styles = StyleSheet.create({
  body: { gap: spacing.md },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  plates: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.sm },
  plate: {
    minWidth: 52,
    height: 52,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.input,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateText: { fontSize: 17, fontWeight: '700' },
  words: { fontSize: 16 },
  done: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    marginTop: spacing.sm,
  },
  pressed: { opacity: 0.7 },
});
