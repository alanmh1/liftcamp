import {
  addMonths,
  calendarTitle,
  draftFromChoice,
  draftLabel,
  draftRange,
  EMPTY_RANGE_DRAFT,
  formatDateLabel,
  isoFromLocalDate,
  monthGrid,
  RANGE_SHORTCUTS,
  rangeDayEnabled,
  rangeRowCells,
  shortcutRange,
  tapRangeDay,
  type CustomRange,
  type RangeChoice,
  type RangeDraft,
} from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, tabular, type } from '@/theme/tokens';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_SIZE = 36;

export type DateRangeSheetRef = {
  /** Opens on the applied range when it is custom, else empty, at its end month. */
  open: (current: RangeChoice) => void;
};

/**
 * The custom range sheet (spec P4). A sheet with inputs, so it keeps the
 * left edge. Shortcut chips apply at once and close; otherwise two taps on
 * the grid pick the ends (tapRangeDay in shared) and Apply sets them.
 * Days after today and before the first finished workout are disabled.
 */
export const DateRangeSheet = forwardRef<
  DateRangeSheetRef,
  { firstWorkoutDate: string | null; onApply: (range: CustomRange) => void }
>(function DateRangeSheet({ firstWorkoutDate, onApply }, ref) {
  const c = useColors();
  const sheet = useRef<SheetRef>(null);
  const today = new Date();
  const todayIso = isoFromLocalDate(today);
  const thisMonth = todayIso.slice(0, 7);
  const firstMonth = firstWorkoutDate ? firstWorkoutDate.slice(0, 7) : thisMonth;
  const [draft, setDraft] = useState<RangeDraft>(EMPTY_RANGE_DRAFT);
  const [month, setMonth] = useState(thisMonth);

  useImperativeHandle(ref, () => ({
    open: (current) => {
      const d = draftFromChoice(current);
      setDraft(d);
      const m = (d.end ?? todayIso).slice(0, 7);
      setMonth(m > thisMonth ? thisMonth : m < firstMonth ? firstMonth : m);
      sheet.current?.present();
    },
  }));

  const range = draftRange(draft);
  const canBack = month > firstMonth;
  const canForward = month < thisMonth;

  function apply(r: CustomRange) {
    onApply(r);
    sheet.current?.dismiss();
  }

  return (
    <Sheet ref={sheet}>
      <View style={styles.header}>
        <Pressable onPress={() => sheet.current?.dismiss()} accessibilityRole="button" hitSlop={10} style={styles.headerSide}>
          <Text style={[type.button, { color: c.accentText }]}>Cancel</Text>
        </Pressable>
        <View style={styles.headerMid}>
          <Text style={[type.exerciseName, styles.centered, { color: c.text }]}>Custom range</Text>
          <Text style={[type.meta, styles.centered, { color: c.text2 }]} numberOfLines={1}>
            {draftLabel(draft, today)}
          </Text>
        </View>
        <Pressable
          onPress={() => setDraft(EMPTY_RANGE_DRAFT)}
          accessibilityRole="button"
          hitSlop={10}
          style={[styles.headerSide, styles.headerRight]}>
          <Text style={[type.button, { color: c.text2 }]}>Reset</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {RANGE_SHORTCUTS.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => apply(shortcutRange(s.id, today, firstWorkoutDate))}
            accessibilityRole="button"
            style={({ pressed }) => [styles.chip, { backgroundColor: c.surface2 }, pressed && styles.pressed]}>
            <Text style={[styles.chipLabel, { color: c.text }]}>{s.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.monthRow}>
        <Text style={[type.exerciseName, styles.monthTitle, { color: c.text }]} accessibilityRole="header">
          {calendarTitle(month)}
        </Text>
        <RoundButton direction="left" enabled={canBack} onPress={() => setMonth(addMonths(month, -1))} />
        <RoundButton direction="right" enabled={canForward} onPress={() => setMonth(addMonths(month, 1))} />
      </View>

      <View style={styles.week}>
        {DAY_LETTERS.map((letter, i) => (
          <Text key={i} style={[styles.letter, { color: c.text3 }]} importantForAccessibility="no">
            {letter}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {monthGrid(month).map((week, w) => {
          const cells = rangeRowCells(week, draft);
          return (
            <View key={w} style={styles.week}>
              {week.map((iso, d) => {
                if (!iso) return <View key={d} style={styles.cell} />;
                const cell = cells[d];
                const enabled = rangeDayEnabled(iso, today, firstWorkoutDate);
                const end = cell.isStart || cell.isEnd;
                const half = DAY_SIZE / 2;
                return (
                  <Pressable
                    key={d}
                    disabled={!enabled}
                    onPress={() => setDraft(tapRangeDay(draft, iso))}
                    accessibilityRole="button"
                    accessibilityLabel={dayLabel(iso)}
                    accessibilityState={{ disabled: !enabled, selected: end || cell.inBand }}
                    style={styles.cell}>
                    {cell.inBand && !(cell.isStart && cell.isEnd) ? (
                      <View
                        style={[
                          styles.band,
                          { backgroundColor: c.accentSoft },
                          cell.isStart && { left: '50%' },
                          cell.isEnd && { right: '50%' },
                          cell.roundLeft && !cell.isStart && { borderTopLeftRadius: half, borderBottomLeftRadius: half },
                          cell.roundRight && !cell.isEnd && { borderTopRightRadius: half, borderBottomRightRadius: half },
                        ]}
                      />
                    ) : null}
                    <View style={[styles.day, end && { backgroundColor: c.accent }]}>
                      <Text
                        style={[
                          styles.number,
                          { color: end ? '#FFFFFF' : enabled ? c.text : c.text3 },
                          end && styles.numberStrong,
                        ]}>
                        {String(Number(iso.slice(8)))}
                      </Text>
                      {iso === todayIso ? (
                        <View style={[styles.todayDot, { backgroundColor: end ? '#FFFFFF' : c.accentText }]} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </View>

      <Pressable
        onPress={() => range && apply(range)}
        disabled={!range}
        accessibilityRole="button"
        accessibilityState={{ disabled: !range }}
        style={({ pressed }) => [
          styles.apply,
          { backgroundColor: c.accent },
          !range && styles.disabled,
          pressed && styles.pressed,
        ]}>
        <Text style={[type.button, styles.applyLabel]}>Apply</Text>
      </Pressable>
    </Sheet>
  );
});

/** "Monday, November 3", with the year when it is not this year. */
function dayLabel(iso: string): string {
  return formatDateLabel(iso, { weekday: 'long', month: 'long' });
}

function RoundButton({ direction, enabled, onPress }: { direction: 'left' | 'right'; enabled: boolean; onPress: () => void }) {
  const c = useColors();
  const tint = enabled ? c.accentText : c.text3;
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={direction === 'left' ? 'Previous month' : 'Next month'}
      accessibilityState={{ disabled: !enabled }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.round,
        { backgroundColor: c.surface2 },
        !enabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <SymbolView
        name={
          direction === 'left'
            ? { ios: 'chevron.left', android: 'chevron_left' }
            : { ios: 'chevron.right', android: 'chevron_right' }
        }
        size={15}
        weight="semibold"
        tintColor={tint}
        fallback={<Text style={[styles.chevronText, { color: tint }]}>{direction === 'left' ? '‹' : '›'}</Text>}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.md },
  headerSide: { minWidth: 64, paddingVertical: spacing.sm },
  headerRight: { alignItems: 'flex-end' },
  headerMid: { flex: 1, gap: 2 },
  centered: { textAlign: 'center' },
  chips: { gap: spacing.sm, paddingBottom: spacing.md },
  chip: { borderRadius: radius.pill, paddingHorizontal: spacing.md, minHeight: 34, justifyContent: 'center' },
  chipLabel: { fontSize: 14, fontWeight: '600' },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.sm },
  monthTitle: { flex: 1 },
  round: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  chevronText: { fontSize: 20, lineHeight: 22 },
  week: { flexDirection: 'row' },
  grid: { gap: 4, paddingTop: spacing.xs, paddingBottom: spacing.lg },
  letter: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '600' },
  cell: { flex: 1, height: DAY_SIZE, alignItems: 'center', justifyContent: 'center' },
  band: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  day: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: { fontSize: 15, fontWeight: '400', ...tabular },
  numberStrong: { fontWeight: '600' },
  todayDot: { position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 2 },
  apply: { alignSelf: 'stretch', alignItems: 'center', borderRadius: radius.bar, paddingVertical: spacing.lg },
  applyLabel: { color: '#FFFFFF', fontSize: 17 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});
