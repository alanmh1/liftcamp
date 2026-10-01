import type { ProgressionSheet as SheetModel } from '@liftcamp/shared';
import { forwardRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { palettes, radius, spacing, type } from '@/theme/tokens';

/**
 * Opened from a card's progression chip: what today's sets are and why.
 * A kicker, a title, a plain explanation, each set against last time, how
 * far the reps are from the next weight jump, Got it, and a link to how
 * progression works.
 *
 * Kept mounted by the workout screen with the model of the chip last
 * tapped; `model` is null before the first tap.
 */
export const ProgressionSheet = forwardRef<
  SheetRef,
  { model: SheetModel | null; onDone: () => void; onHowItWorks: () => void }
>(function ProgressionSheet({ model, onDone, onHowItWorks }, ref) {
  const { colors: c } = useTheme();

  return (
    <Sheet ref={ref}>
      {model ? (
        <View style={styles.body}>
          <View style={styles.head}>
            <Text style={[type.label, { color: c.accentText }]}>{model.kicker}</Text>
            <Text style={[styles.title, { color: c.text }]}>{model.title}</Text>
            <Text style={[styles.explain, { color: c.text2 }]}>{model.body}</Text>
          </View>

          <View style={[styles.table, { borderColor: c.border }]}>
            <View style={[styles.row, styles.headerRow, { borderBottomColor: c.border }]}>
              <Text style={[type.label, styles.setCol, { color: c.text3 }]}>Set</Text>
              <Text style={[type.label, styles.valueCol, { color: c.text3 }]}>Last time</Text>
              <View style={styles.arrowCol} />
              <Text style={[type.label, styles.valueCol, { color: c.text3 }]}>Today</Text>
            </View>
            {model.rows.map((row, i) => (
              <View
                key={i}
                style={[
                  styles.row,
                  i < model.rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
                ]}>
                <Text style={[type.prevNumeral, styles.setCol, { color: c.text2 }]}>{row.set}</Text>
                <Text style={[type.prevNumeral, styles.valueCol, styles.value, { color: c.text2 }]}>{row.last}</Text>
                <Text style={[type.prevNumeral, styles.arrowCol, { color: c.text3 }]}>→</Text>
                <Text
                  style={[
                    type.prevNumeral,
                    styles.valueCol,
                    styles.value,
                    { color: row.changed ? c.accentText : c.text },
                    row.changed && styles.changed,
                  ]}>
                  {row.today}
                </Text>
              </View>
            ))}
          </View>

          {model.progress ? (
            <View style={styles.progress}>
              <Text style={[type.meta, { color: c.text2 }]}>{model.progress.label}</Text>
              <View
                style={[styles.track, { backgroundColor: c.surface2 }]}
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: model.progress.max, now: model.progress.value }}>
                <View
                  style={[
                    styles.fill,
                    {
                      backgroundColor: c.accent,
                      width: `${Math.round((100 * model.progress.value) / Math.max(model.progress.max, 1))}%`,
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={onDone}
            accessibilityRole="button"
            style={({ pressed }) => [styles.done, { backgroundColor: c.accent }, pressed && styles.pressed]}>
            <Text style={[type.button, { color: palettes.light.bg }]}>Got it</Text>
          </Pressable>
          <Pressable
            onPress={onHowItWorks}
            accessibilityRole="link"
            hitSlop={8}
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
            <Text style={[type.button, { color: c.accentText }]}>How progression works</Text>
          </Pressable>
        </View>
      ) : null}
    </Sheet>
  );
});

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  head: { gap: spacing.xs },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  explain: { fontSize: 15, lineHeight: 21 },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.input, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 38 },
  headerRow: { minHeight: 30, borderBottomWidth: StyleSheet.hairlineWidth },
  setCol: { width: 36 },
  valueCol: { flex: 1 },
  arrowCol: { width: 24, textAlign: 'center' },
  value: { fontSize: 15 },
  changed: { fontWeight: '600' },
  progress: { gap: spacing.sm },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  done: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
  },
  link: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  pressed: { opacity: 0.7 },
});
