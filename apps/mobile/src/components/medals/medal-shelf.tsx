import { medalShelf, type MedalCabinet, type ShelfSlot } from '@liftcamp/shared';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Medal } from '@/components/medals/medal';
import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { spacing, tabular } from '@/theme/tokens';

const CENTRE = 92;
const SIDE = 56;
const STROKE = 5;
/** The ring clears the medal's rim by a few points. */
const RING = CENTRE + 2 * (STROKE + 4);
const LOCKED_OPACITY = 0.5;

/** "1 week to go", "7 weeks to go". */
export function weeksToGo(n: number): string {
  return `${n} ${n === 1 ? 'week' : 'weeks'} to go`;
}

/**
 * Profile's medal shelf, under the MEDALS header (no card): the next medal
 * at centre in full colour inside a ring of the streak so far, the most
 * recent medal earned on the left, the one after next on the right,
 * locked, and a line of the weeks to go. The slots and copy come from
 * medalShelf in shared. VoiceOver reads it as one element.
 */
export function MedalShelf({ cabinet }: { cabinet: MedalCabinet }) {
  const c = useColors();
  const shelf = medalShelf(cabinet);
  const r = (RING - STROKE) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <View style={styles.wrap} accessible accessibilityLabel={shelf.accessibilityLabel}>
      <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Side slot={shelf.left} />
        <View style={styles.centre}>
          <View style={styles.ringBox}>
            {/* Rotated so the fill starts at 12 o'clock and runs clockwise. */}
            <Svg width={RING} height={RING} style={styles.ring}>
              <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={c.border} strokeWidth={STROKE} fill="none" />
              {shelf.centre.fraction > 0 ? (
                <Circle
                  cx={RING / 2}
                  cy={RING / 2}
                  r={r}
                  stroke={c.accent}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={[circumference, circumference]}
                  strokeDashoffset={circumference * (1 - shelf.centre.fraction)}
                />
              ) : null}
            </Svg>
            <Medal weeks={shelf.centre.weeks} size={CENTRE} />
          </View>
          {shelf.centre.label ? (
            <Text style={[styles.centreLabel, { color: c.accentText }]}>{shelf.centre.label}</Text>
          ) : null}
        </View>
        <Side slot={shelf.right} />
      </View>
      <Text style={[styles.line, { color: c.text }]}>{shelf.line}</Text>
    </View>
  );
}

function Side({ slot }: { slot: ShelfSlot | null }) {
  const c = useColors();
  return (
    <View style={styles.side}>
      {slot ? (
        <>
          <Medal weeks={slot.weeks} size={SIDE} variant={slot.variant} lockedOpacity={LOCKED_OPACITY} />
          <Text style={[styles.sideLabel, { color: c.text2 }]}>
            {slot.weeks} weeks
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  centre: { alignItems: 'center', gap: spacing.xs },
  ringBox: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
  centreLabel: { fontSize: 13, fontWeight: '600', ...tabular },
  // Wide enough for "104 weeks", so the shelf stays centred whatever the sides hold.
  side: { width: 76, alignItems: 'center', gap: spacing.xs },
  sideLabel: { fontSize: 12, fontWeight: '500', ...tabular },
  line: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
