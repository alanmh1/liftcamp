import {
  formatPlate,
  perSideSpoken,
  plateColor,
  plateGroups,
  plateShortfall,
  plateSize,
  platesForWeight,
} from '@liftcamp/shared';
import { forwardRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BarbellFigure, PLATE_TONES } from '@/components/barbell-figure';
import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing, tabular, type } from '@/theme/tokens';

/**
 * Pro: the plate calculator. The weight as the title, the bar under it, a
 * side view of the loaded bar (BarbellFigure), then PER SIDE and one
 * circle per plate weight in load order with its count ("45 ×2"). The
 * figure and the circles are one element for VoiceOver and TalkBack, read
 * as words ("Per side, 45 times two, 5 times one"). The bare bar draws
 * the bar alone and reads "Just the bar".
 *
 * When the checked plates cannot make the weight, a line names the
 * closest one under it; with `onPick` (opened from a weight box) that
 * number is a button that puts it in the box.
 *
 * Centred throughout: it only shows something (apps/mobile/CLAUDE.md,
 * Sheets).
 */
export type PlateTarget = {
  weight: number;
  bar: number;
  plates: readonly number[];
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
  const groups = load ? plateGroups(load) : [];

  function pick(weight: number) {
    onPick?.(weight);
    (ref as React.RefObject<SheetRef | null>).current?.dismiss();
  }

  return (
    <Sheet ref={ref}>
      {target && load ? (
        <View style={styles.body}>
          <Text style={[styles.title, styles.centered, tabular, { color: c.text }]}>
            {formatPlate(target.weight)} {unitLabel}
          </Text>
          <Text style={[type.meta, styles.centered, { color: c.text2 }]}>
            {formatPlate(target.bar)} {unitLabel} bar
          </Text>

          <View style={styles.load} accessible accessibilityLabel={perSideSpoken(load)}>
            <BarbellFigure perSide={load.perSide} unit={unit} />
            <Text style={[type.label, styles.centered, { color: c.text3 }]}>Per side</Text>
            {groups.length === 0 ? (
              <Text style={[styles.words, styles.centered, { color: c.text }]}>Just the bar</Text>
            ) : (
              <View style={styles.groups}>
                {groups.map((g) => {
                  const tone = PLATE_TONES[plateColor(g.plate, unit)];
                  const small = plateSize(g.plate, unit) === 'small';
                  const d = small ? 30 : 36;
                  return (
                    <View key={g.plate} style={styles.group}>
                      <View
                        style={[
                          styles.circle,
                          { width: d, height: d, borderRadius: d / 2, backgroundColor: tone.fill },
                          tone.border ? { borderWidth: 1, borderColor: tone.border } : null,
                        ]}>
                        <Text
                          style={[styles.circleText, tabular, { color: tone.text, fontSize: small ? 12 : 14 }]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.7}>
                          {formatPlate(g.plate)}
                        </Text>
                      </View>
                      <Text style={[type.meta, tabular, { color: c.text2 }]}>×{g.count}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {short ? (
            <Text style={[type.meta, styles.centered, { color: c.text2 }]}>
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
  // A sheet that only shows something reads better centred; sheets with
  // inputs, rows or lists keep the left edge (the custom exercise form,
  // the pickers).
  body: { gap: spacing.md, alignItems: 'center' },
  centered: { textAlign: 'center' },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  // The figure stretches to the sheet's width; the rest centres under it.
  load: { alignSelf: 'stretch', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  groups: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 18,
    rowGap: spacing.sm,
  },
  group: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  circle: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  circleText: { fontWeight: '700' },
  words: { fontSize: 16 },
  done: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    marginTop: spacing.sm,
  },
  pressed: { opacity: 0.7 },
});
