import { heatColor, heatInk, type WeekCardState } from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Flame, type FlameVariant } from '@/components/streak/flame';
import { Text } from '@/components/text';
import { localDateIso, startOfWeek } from '@/data/home';
import { useColors } from '@/theme/theme-provider';
import { radius, tabular, type Palette } from '@/theme/tokens';

/**
 * The pieces the week card and the streak sheet share: the streak chip,
 * the rest-week token and the day row. The rules are in
 * docs/week-card-v2-spec.md.
 */

/** The streak chip's look. */
export type ChipVariant = 'ember' | 'hot' | 'ice' | 'out';

/** Last week was missed and the banked rest week covered it, and nothing is done yet. */
export function restWeekShowing(state: WeekCardState): boolean {
  return state.streak.restUsedLastWeek && state.done === 0;
}

/** At risk first, then a rest week covering last week, then any streak, then none. */
export function chipVariant(state: WeekCardState): ChipVariant {
  if (state.atRisk) return 'hot';
  if (restWeekShowing(state)) return 'ice';
  return state.streak.current >= 1 ? 'ember' : 'out';
}

/** What VoiceOver reads for the chip, without the action. */
export function chipLabel(state: WeekCardState): string {
  const n = state.streak.current;
  if (n < 1) return 'No streak yet';
  return `${n}-week streak${state.streak.restBanked ? ', rest week banked' : ''}`;
}

const CHIP_FLAME: Record<ChipVariant, FlameVariant> = { ember: 'ember', hot: 'ember', ice: 'ice', out: 'out' };

function chipColors(variant: ChipVariant, c: Palette) {
  switch (variant) {
    case 'hot':
      return { backgroundColor: c.surface, borderColor: c.streak, color: c.streakText };
    case 'ice':
      return { backgroundColor: c.iceSoft, borderColor: 'transparent', color: c.iceText };
    case 'out':
      return { backgroundColor: c.noStreakSoft, borderColor: 'transparent', color: c.text3 };
    default:
      return { backgroundColor: c.streakSoft, borderColor: 'transparent', color: c.streakText };
  }
}

/**
 * The streak chip: a 32 pt pill, the clay flame, then "5 weeks". Shown at
 * every streak, 0 included. At risk it is the surface with a 2 pt ember
 * ring rather than a solid ember fill, which would swallow the flame.
 * Every variant carries the 2 pt border (transparent when unused), so the
 * size never changes between them.
 */
export function StreakChip({
  state,
  onPress,
  style,
}: {
  state: WeekCardState;
  /** Opens the streak sheet. Without it the chip is not a control. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const variant = chipVariant(state);
  const { color, ...fill } = chipColors(variant, c);
  const n = state.streak.current;
  const pill = (
    <View style={[styles.chip, fill, style]}>
      <Flame variant={CHIP_FLAME[variant]} size={26} />
      <Text style={[styles.chipText, { color }]}>
        {n} {n === 1 ? 'week' : 'weeks'}
      </Text>
    </View>
  );
  if (!onPress) return pill;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${chipLabel(state)}. Open streak.`}
      style={({ pressed }) => pressed && styles.pressed}>
      {pill}
    </Pressable>
  );
}

/** "1 rest week" on ice, or "0 rest weeks" with the flame greyed. A 24 pt pill. */
export function RestToken({ count, style }: { count: number; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={[styles.token, { backgroundColor: c.iceSoft }, style]}>
      <Flame variant="ice" size={20} style={count === 0 && styles.spent} />
      <Text style={[styles.tokenText, { color: c.iceText }]}>
        {count} {count === 1 ? 'rest week' : 'rest weeks'}
      </Text>
    </View>
  );
}

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
export const DAY_CIRCLE = 30;

/**
 * This week's seven days, Monday first: the letter over a 30 pt circle.
 * The k-th training day (in date order) fills with the heat color for
 * min(k, target) / target and a check in its ink; days past the target are
 * ember. Today, untrained, is a dashed ring: ember at risk, ice on a
 * rest-week Monday, text3 otherwise. Other days are surface2.
 */
export function DayRow({
  state,
  dates,
  today,
}: {
  state: WeekCardState;
  /** Finished workout dates, YYYY-MM-DD; the ones in this week fill. */
  dates: readonly string[];
  /** Places the week; defaults to now, as on Home. */
  today?: Date;
}) {
  const c = useColors();
  const monday = startOfWeek(today);
  const todayIso = localDateIso(today);
  const days = DAY_LETTERS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return localDateIso(d);
  });
  const trained = days.filter((iso) => dates.includes(iso));
  const ring = state.atRisk ? c.streak : restWeekShowing(state) ? c.ice : c.text3;
  const target = Math.max(1, state.target);

  return (
    <View style={styles.days}>
      {days.map((iso, i) => {
        const k = trained.indexOf(iso) + 1;
        const isToday = iso === todayIso;
        let circle: ReactNode;
        if (k > 0) {
          const fill = k > target ? c.streak : heatColor(k / target);
          const ink = heatInk(k > target ? heatColor(1) : fill);
          circle = (
            <View style={[styles.circle, { backgroundColor: fill }]}>
              <SymbolView
                name={{ ios: 'checkmark', android: 'check' }}
                size={14}
                weight="bold"
                tintColor={ink}
                fallback={<Text style={[styles.check, { color: ink }]}>✓</Text>}
              />
            </View>
          );
        } else if (isToday) {
          circle = <View style={[styles.circle, styles.todayRing, { borderColor: ring }]} />;
        } else {
          circle = <View style={[styles.circle, { backgroundColor: c.surface2 }]} />;
        }
        return (
          <View key={iso} style={styles.day}>
            <Text style={[styles.letter, { color: isToday ? c.text : c.text3 }]}>{DAY_LETTERS[i]}</Text>
            {circle}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    borderWidth: 2,
    paddingLeft: 2,
    paddingRight: 10,
  },
  chipText: { fontSize: 14, fontWeight: '700', ...tabular },
  token: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.pill,
    paddingLeft: 3,
    paddingRight: 9,
  },
  tokenText: { fontSize: 12, fontWeight: '600', ...tabular },
  spent: { opacity: 0.45 },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 6 },
  letter: { fontSize: 11, fontWeight: '600' },
  circle: {
    width: DAY_CIRCLE,
    height: DAY_CIRCLE,
    borderRadius: DAY_CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayRing: { borderWidth: 2, borderStyle: 'dashed' },
  check: { fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.8 },
});
