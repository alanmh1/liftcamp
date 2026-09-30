import { streakMilestoneLine } from '@liftcamp/shared';
import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Plate } from '@/components/home/plate';
import { LiftCampMark } from '@/components/liftcamp-mark';
import { Text } from '@/components/text';
import { CARD_SIZE } from '@/components/summary/share-card';
import { useTheme } from '@/theme/theme-provider';
import { tabular } from '@/theme/tokens';

/**
 * The week streak share card. The summary cards' system: square, designed
 * at 1080 by 1080 and drawn at any size through one scale factor, so the
 * preview in the sheet and the offscreen capture are the same component
 * at different sizes.
 *
 * The streak number, "week streak", a plate per week, the milestone line
 * when the streak is on one, and the mark, name and site along the bottom.
 * Unlike the summary cards it follows the app theme, paper or graphite,
 * so the image matches the screen it was shared from. Accent only: gold
 * marks personal records and nothing else, and a streak is not one.
 */

/** Plates drawn at most, one per week. A longer streak shows this many. */
const MAX_PLATES = 8;

export const StreakCard = forwardRef<View, { weeks: number; size: number }>(function StreakCard(
  { weeks, size },
  ref,
) {
  const { colors: c } = useTheme();
  const s = size / CARD_SIZE;
  const u = (n: number) => n * s;
  const milestone = streakMilestoneLine(weeks);

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[
        styles.card,
        { width: size, height: size, padding: u(72), borderRadius: u(48), backgroundColor: c.bg },
      ]}>
      <View style={styles.body}>
        {/* No negative tracking: iOS applies letterSpacing after the last
            glyph too, so it would clip the right edge. */}
        <Text style={[styles.number, { fontSize: u(360), lineHeight: u(380), color: c.accentText }]}>
          {weeks}
        </Text>
        <Text style={[styles.label, { fontSize: u(64), lineHeight: u(76), color: c.text }]}>week streak</Text>
        <View style={[styles.plates, { gap: u(20), marginTop: u(56) }]}>
          {Array.from({ length: Math.min(weeks, MAX_PLATES) }, (_, i) => (
            <Plate key={i} size={u(80)} filled />
          ))}
        </View>
        {milestone ? (
          <Text
            style={[styles.line, { fontSize: u(44), lineHeight: u(56), marginTop: u(56), color: c.text2 }]}
            numberOfLines={2}>
            {milestone}
          </Text>
        ) : null}
      </View>

      <View style={styles.footer}>
        <View style={[styles.brand, { gap: u(20) }]}>
          <LiftCampMark size={u(72)} />
          <Text style={[styles.name, { fontSize: u(44), color: c.text }]}>LiftCamp</Text>
        </View>
        <Text style={[styles.site, { fontSize: u(32), color: c.text3 }]}>liftcamp.app</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { justifyContent: 'space-between', overflow: 'hidden' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  number: { fontWeight: '700', textAlign: 'center', ...tabular },
  label: { fontWeight: '600', textAlign: 'center' },
  plates: { flexDirection: 'row', justifyContent: 'center' },
  line: { fontWeight: '400', textAlign: 'center', alignSelf: 'stretch' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center' },
  name: { fontWeight: '700' },
  site: { fontWeight: '500' },
});
