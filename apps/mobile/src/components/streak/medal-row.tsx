import type { MedalProgress } from '@liftcamp/shared';
import { StyleSheet, View } from 'react-native';

import { Medal } from '@/components/medals/medal';
import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';

/**
 * The week card's medal row: the next medal as the goal, every week but a
 * medal week (where the medal hero takes the card). From medalProgress in
 * packages/shared medals.ts; the spec is docs/week-card-v2-spec.md.
 *
 * - No rung yet and no streak: "Your first medal", a sentence, the ticks,
 *   and the 2-week medal locked at 72 pt.
 * - Otherwise: the medal behind the streak at 44 pt (when there is one),
 *   the ticks with the line under them, and the next medal locked at 60 pt.
 *   Past eight ticks, one bar instead.
 * - Urgent (one week to go, this week not hit): the line in streakText
 *   bold, the now tick's dash ember, and the next medal at 76 pt in its
 *   earned art at 0.65 opacity over a soft glow.
 */

const PREV_SIZE = 44;
const NEXT_SIZE = 60;
const URGENT_SIZE = 76;
const FIRST_SIZE = 72;

/** The first-medal row's sentence, also its accessibility line. */
export const FIRST_MEDAL_TITLE = 'Your first medal';
export const FIRST_MEDAL_BODY = 'Hit your target two weeks running and the 2-week medal is yours.';

export function MedalRow({ progress, streak }: { progress: MedalProgress; streak: number }) {
  const c = useColors();
  const first = progress.prev == null && streak === 0;

  if (first) {
    return (
      <View style={styles.row}>
        <View style={styles.middle}>
          <Text style={[styles.title, { color: c.text }]}>{FIRST_MEDAL_TITLE}</Text>
          <Text style={[styles.body, { color: c.text3 }]}>{FIRST_MEDAL_BODY}</Text>
          <Ticks progress={progress} />
        </View>
        <Medal weeks={progress.next} size={FIRST_SIZE} variant="locked" />
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {progress.prev != null ? <Medal weeks={progress.prev} size={PREV_SIZE} /> : null}
      <View style={styles.middle}>
        <Ticks progress={progress} />
        <Text
          style={[
            styles.line,
            progress.urgent ? { color: c.streakText, fontWeight: '700' } : { color: c.text3 },
          ]}>
          {progress.line}
        </Text>
      </View>
      {progress.urgent ? (
        <View style={styles.urgent}>
          <View pointerEvents="none" style={[styles.glow, { backgroundColor: c.streakSoft, boxShadow: `0 0 18px 10px ${c.streakSoft}` }]} />
          {/* Medal sets its own opacity for its landing, so the fade is on a wrapper. */}
          <View style={styles.faded}>
            <Medal weeks={progress.next} size={URGENT_SIZE} />
          </View>
        </View>
      ) : (
        <Medal weeks={progress.next} size={NEXT_SIZE} variant="locked" />
      )}
    </View>
  );
}

/** One tick per week to the next medal, or one bar past eight. */
function Ticks({ progress }: { progress: MedalProgress }) {
  const c = useColors();
  if (progress.bar != null) {
    return (
      <View style={[styles.track, { backgroundColor: c.surface2 }]}>
        <View style={[styles.fill, { backgroundColor: c.streak, width: `${Math.round(progress.bar * 100)}%` }]} />
      </View>
    );
  }
  const { on, now, total } = progress.ticks;
  return (
    <View style={styles.ticks}>
      {Array.from({ length: total }, (_, i) => {
        if (i < on) return <View key={i} style={[styles.tick, { backgroundColor: c.streak }]} />;
        if (i === on && now) {
          return (
            <View
              key={i}
              style={[styles.tick, styles.nowTick, { borderColor: progress.urgent ? c.streak : c.text3 }]}
            />
          );
        }
        return <View key={i} style={[styles.tick, { backgroundColor: c.surface2 }]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  middle: { flex: 1, gap: 6 },
  title: { fontSize: 15, fontWeight: '700' },
  body: { fontSize: 13 },
  line: { fontSize: 13, fontWeight: '600' },
  ticks: { flexDirection: 'row', gap: 4 },
  tick: { flex: 1, height: 8, borderRadius: 4 },
  nowTick: { borderWidth: 1.5, borderStyle: 'dashed' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  urgent: { width: URGENT_SIZE, height: URGENT_SIZE, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: URGENT_SIZE * 0.8,
    height: URGENT_SIZE * 0.8,
    borderRadius: URGENT_SIZE * 0.4,
  },
  faded: { opacity: 0.65 },
});
