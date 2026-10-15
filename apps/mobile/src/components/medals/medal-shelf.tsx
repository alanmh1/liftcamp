import type { MedalCabinet } from '@liftcamp/shared';
import { Pressable, StyleSheet, View } from 'react-native';

import { Medal } from '@/components/medals/medal';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, pressedFlat, radius, spacing, tabular, type } from '@/theme/tokens';

/** The art's face is 40% of the image, so the number needs this much medal to read. */
const SIZE = 56;
/** Earned medals the row shows at most, the highest ones; the cabinet has the rest. */
const MAX_EARNED = 3;

/** "1 week to go", "7 weeks to go". */
export function weeksToGo(n: number): string {
  return `${n} ${n === 1 ? 'week' : 'weeks'} to go`;
}

/**
 * Profile's medal row, under the streak stats: the earned medals (each
 * rung once, a ×N under one earned more than once), then the next one as
 * a locked silhouette with the weeks it still needs. Tapping opens the
 * cabinet (app/medals.tsx).
 */
export function MedalShelf({ cabinet, onPress }: { cabinet: MedalCabinet; onPress: () => void }) {
  const { scheme, colors: c } = useTheme();
  const shown = cabinet.earned.slice(-MAX_EARNED);
  const { next } = cabinet;
  const label =
    cabinet.earned.length > 0
      ? `Medals. ${cabinet.earned.length} earned. Next, ${next.weeks} weeks, ${weeksToGo(next.toGo)}. Open all medals.`
      : `Medals. Next, ${next.weeks} weeks, ${weeksToGo(next.toGo)}. Open all medals.`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.card, cardSurface(scheme, c), pressed && [styles.pressed, pressedFlat]]}>
      <View style={styles.header}>
        <Text style={[type.label, { color: c.text3 }]}>Medals</Text>
        <Text style={[type.meta, styles.seeAll, { color: c.accentText }]}>See all</Text>
      </View>
      <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {shown.map((m) => (
          <View key={m.weeks} style={styles.slot}>
            <Medal weeks={m.weeks} size={SIZE} />
            <Text style={[styles.caption, { color: c.text2 }]}>{m.count > 1 ? `×${m.count}` : ' '}</Text>
          </View>
        ))}
        <View style={[styles.slot, styles.next]}>
          <Medal weeks={next.weeks} size={SIZE} variant="locked" />
          <Text style={[styles.caption, { color: c.text2 }]} numberOfLines={1}>
            {weeksToGo(next.toGo)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, padding: spacing.card, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seeAll: { fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  slot: { alignItems: 'center', gap: spacing.xs, minWidth: SIZE },
  next: { minWidth: 84 },
  caption: { fontSize: 12, fontWeight: '500', ...tabular },
  pressed: { opacity: 0.8 },
});
