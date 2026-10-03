import { isMedalRung, streakShareLine, type StreakShare, type StripWeek } from '@liftcamp/shared';
import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { LiftCampMark } from '@/components/liftcamp-mark';
import { Medal } from '@/components/medals/medal';
import { Text } from '@/components/text';
import { CARD_SIZE } from '@/components/summary/share-card';
import { palettes, tabular } from '@/theme/tokens';

/**
 * The week streak share card. The summary cards' system: square, designed
 * at 1080 by 1080 and drawn at any size through one scale factor, so the
 * preview in the sheet and the offscreen capture are the same component
 * at different sizes.
 *
 * The streak number, "week workout streak", a strip of the streak's last
 * weeks (a dot per training day, a dash for a rest week), the total
 * workouts, the medal or keep-going line, and the mark, name and site
 * along the bottom. On a medal rung the medal sits in the top right corner,
 * in its white share variant.
 *
 * It is an image for social, so it is the same in light and dark: the
 * icon's palette, plate blue with the number in the icon's yellow and
 * everything else white. That is the one place gold appears outside a PR;
 * in-app UI keeps gold for PRs (see the standing rules in CLAUDE.md).
 * Yellow on the blue is 4.4:1, above the 3:1 for large text, so it is kept
 * to the number; white on the blue is 6.5:1.
 */

const BLUE = palettes.light.accent;
const YELLOW = palettes.light.gold;
const WHITE = '#FFFFFF';

/** Dots a column stacks at most: a week has seven days. */
const MAX_DOTS = 7;

export const StreakCard = forwardRef<View, { share: StreakShare; size: number }>(function StreakCard(
  { share, size },
  ref,
) {
  const s = size / CARD_SIZE;
  const u = (n: number) => n * s;
  const { weeks, strip, workouts } = share;

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.card, { width: size, height: size, padding: u(72), borderRadius: u(48), backgroundColor: BLUE }]}>
      {isMedalRung(weeks) ? (
        <Medal weeks={weeks} size={u(170)} variant="share" style={[styles.medal, { top: u(56), right: u(56) }]} />
      ) : null}
      <View style={styles.body}>
        {/* No negative tracking: iOS applies letterSpacing after the last
            glyph too, so it would clip the right edge. */}
        <Text style={[styles.number, { fontSize: u(300), lineHeight: u(310), color: YELLOW }]}>{weeks}</Text>
        <Text style={[styles.label, { fontSize: u(60), lineHeight: u(72) }]}>week workout streak</Text>

        <WeekStrip strip={strip} u={u} />
        <Text style={[styles.stat, { fontSize: u(44), lineHeight: u(56), marginTop: u(24) }]}>
          {workouts} {workouts === 1 ? 'workout' : 'workouts'}
        </Text>

        {/* Wraps to as many lines as it needs. */}
        <Text style={[styles.line, { fontSize: u(44), lineHeight: u(56), marginTop: u(40) }]}>
          {streakShareLine(weeks)}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={[styles.brand, { gap: u(20) }]}>
          <LiftCampMark size={u(72)} color={WHITE} />
          <Text style={[styles.name, { fontSize: u(44) }]}>LiftCamp</Text>
        </View>
        <Text style={[styles.site, { fontSize: u(32) }]}>liftcamp.app</Text>
      </View>
    </View>
  );
});

/**
 * One narrow column per week, oldest on the left: a dot per training day,
 * stacked from the bottom, or a short dash on the floor for a rest week.
 * Every column is the full seven dots tall, so the floor lines up.
 */
function WeekStrip({ strip, u }: { strip: StripWeek[]; u: (n: number) => number }) {
  const dot = u(20);
  const gap = u(8);
  const height = MAX_DOTS * dot + (MAX_DOTS - 1) * gap;
  return (
    <View style={[styles.strip, { gap: u(28), marginTop: u(44), height }]}>
      {strip.map((week, i) => (
        <View key={i} style={[styles.column, { width: dot, gap }]}>
          {week.rest ? (
            <View style={{ width: dot, height: u(6), borderRadius: u(3), backgroundColor: WHITE }} />
          ) : (
            Array.from({ length: Math.min(week.days, MAX_DOTS) }, (_, d) => (
              <View key={d} style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: WHITE }} />
            ))
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { justifyContent: 'space-between', overflow: 'hidden' },
  medal: { position: 'absolute' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  number: { fontWeight: '700', textAlign: 'center', ...tabular },
  label: { fontWeight: '600', textAlign: 'center', color: WHITE },
  strip: { flexDirection: 'row', justifyContent: 'center' },
  // Reversed, so the first dot sits on the column's floor and the stack grows up.
  column: { height: '100%', flexDirection: 'column-reverse' },
  stat: { fontWeight: '600', textAlign: 'center', color: WHITE, ...tabular },
  line: { fontWeight: '400', textAlign: 'center', alignSelf: 'stretch', color: WHITE },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center' },
  name: { fontWeight: '700', color: WHITE },
  site: { fontWeight: '500', color: WHITE },
});
