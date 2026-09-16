import { forwardRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { LiftCampMark } from '@/components/liftcamp-mark';
import { COMPARISON_ART } from '@/components/summary/comparison-art';
import { Text } from '@/components/text';
import { palettes, tabular } from '@/theme/tokens';

/**
 * The three share cards. Square, designed at 1080 by 1080 and drawn at any
 * size through one scale factor, so the preview in the carousel and the
 * offscreen capture are the same component at different sizes.
 *
 * One treatment in both modes, on paper with graphite type and plate blue,
 * because the exported image has no theme. Gold is absent on purpose: it
 * marks personal records and nothing else.
 *
 * Every card has the mark and the username at the top and the site handle
 * at the bottom, in the same place, so an image from any of the three is
 * recognisable as the same app. The content between them is centred both
 * ways, so a short card does not float in the top-left of an empty square.
 */
export const CARD_SIZE = 1080;

export type CardKind = 'stats' | 'exercises' | 'comparison';

export type CardData = {
  username: string;
  name: string;
  dateLabel: string;
  duration: string;
  /** "18,140 lbs", already in the user's unit. */
  volume: string;
  sets: number;
  /** In position order, completed sets only. */
  exercises: { name: string; sets: number }[];
  /**
   * Null under the lightest object, in which case the card is not offered.
   * The line is picked once per view, so the preview and the capture match.
   * `moreThan` is "That's more than an elephant"; the object's weight is
   * never shown, since the session is somewhere above it.
   */
  comparison: { slug: string; line: string; moreThan: string } | null;
};

const paper = palettes.light;

/** How many exercise lines fit before the card says "and N more". */
const MAX_EXERCISE_LINES = 8;

export const ShareCard = forwardRef<View, { kind: CardKind; data: CardData; size: number }>(
  function ShareCard({ kind, data, size }, ref) {
    const s = size / CARD_SIZE;
    const u = (n: number) => n * s;

    return (
      <View
        ref={ref}
        collapsable={false}
        style={[styles.card, { width: size, height: size, padding: u(72), borderRadius: u(48) }]}>
        <View style={[styles.top, { gap: u(24) }]}>
          <LiftCampMark size={u(96)} />
          <Text style={[styles.username, { fontSize: u(40) }]} numberOfLines={1}>
            @{data.username}
          </Text>
        </View>

        <View style={styles.body}>
          {kind === 'stats' ? <Stats data={data} u={u} /> : null}
          {kind === 'exercises' ? <Exercises data={data} u={u} /> : null}
          {kind === 'comparison' && data.comparison ? <Comparison data={data} u={u} /> : null}
        </View>

        <Text style={[styles.site, { fontSize: u(32) }]}>@liftcamp.app</Text>
      </View>
    );
  },
);

type Scale = (n: number) => number;

function Stats({ data, u }: { data: CardData; u: Scale }) {
  return (
    <View style={[styles.block, { gap: u(48) }]}>
      <View style={[styles.block, { gap: u(8) }]}>
        <Text style={[styles.title, { fontSize: u(72), lineHeight: u(84) }]} numberOfLines={2}>
          {data.name}
        </Text>
        <Text style={[styles.muted, { fontSize: u(36) }]}>{data.dateLabel}</Text>
      </View>
      <View style={[styles.statRow, { gap: u(56) }]}>
        <Stat label="Duration" value={data.duration} u={u} />
        <Stat label="Volume" value={data.volume} u={u} />
        <Stat label="Sets" value={String(data.sets)} u={u} />
      </View>
    </View>
  );
}

function Stat({ label, value, u }: { label: string; value: string; u: Scale }) {
  return (
    <View style={[styles.block, { gap: u(6) }]}>
      <Text style={[styles.statValue, { fontSize: u(72) }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.label, { fontSize: u(28), letterSpacing: u(2) }]}>{label}</Text>
    </View>
  );
}

function Exercises({ data, u }: { data: CardData; u: Scale }) {
  const shown = data.exercises.slice(0, MAX_EXERCISE_LINES);
  const more = data.exercises.length - shown.length;
  return (
    <View style={[styles.block, { gap: u(36) }]}>
      <Text style={[styles.title, { fontSize: u(64), lineHeight: u(76) }]} numberOfLines={2}>
        {data.name}
      </Text>
      <View style={[styles.block, { gap: u(18) }]}>
        {shown.map((e, i) => (
          <Text key={i} style={[styles.line, { fontSize: u(42), lineHeight: u(52) }]} numberOfLines={1}>
            <Text style={[styles.lineCount, { fontSize: u(42) }]}>{e.sets}x </Text>
            {e.name}
          </Text>
        ))}
        {more > 0 ? (
          <Text style={[styles.muted, { fontSize: u(38) }]}>
            and {more} more
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** The illustration's edge, in card units. 384px art drawn at 340 stays sharp at 1080. */
const ART_SIZE = 340;

function Comparison({ data, u }: { data: CardData; u: Scale }) {
  const art = data.comparison ? COMPARISON_ART[data.comparison.slug] : undefined;
  return (
    <View style={[styles.block, { gap: u(20) }]}>
      {/* Core Image, not expo-image: a bundled asset draws in the same pass
          as the text, so the offscreen capture never races the decode. */}
      {art ? (
        <Image
          source={art}
          resizeMode="contain"
          style={{ width: u(ART_SIZE), height: u(ART_SIZE), marginBottom: u(8) }}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <Text style={[styles.muted, { fontSize: u(44) }]}>You lifted</Text>
      <Text style={[styles.big, { fontSize: u(120), lineHeight: u(132) }]} numberOfLines={1} adjustsFontSizeToFit>
        {data.volume}
      </Text>
      <Text style={[styles.title, { fontSize: u(56), lineHeight: u(68) }]} numberOfLines={3}>
        {data.comparison?.line}
      </Text>
      <Text style={[styles.muted, { fontSize: u(36) }]}>{data.comparison?.moreThan}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: paper.bg,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  top: { flexDirection: 'row', alignItems: 'center' },
  username: { flex: 1, fontWeight: '600', color: paper.text },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Every content block centres its children; every text centres its lines.
  block: { alignItems: 'center', alignSelf: 'stretch' },
  site: { fontWeight: '500', color: paper.text3 },
  title: { fontWeight: '700', color: paper.text, letterSpacing: -1, textAlign: 'center' },
  muted: { fontWeight: '400', color: paper.text2, textAlign: 'center' },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  statValue: { fontWeight: '500', color: paper.text, textAlign: 'center', ...tabular },
  label: { fontWeight: '700', color: paper.text3, textTransform: 'uppercase', textAlign: 'center' },
  line: { fontWeight: '500', color: paper.text, textAlign: 'center' },
  lineCount: { fontWeight: '700', color: paper.accent, ...tabular },
  big: { fontWeight: '700', color: paper.accent, letterSpacing: -3, textAlign: 'center', ...tabular },
});
