import { forwardRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { LiftCampMark } from '@/components/liftcamp-mark';
import { CardThumb } from '@/components/summary/card-thumb';
import { CARD_PALETTES, type CardPalette, type CardTheme } from '@/components/summary/card-palette';
import { COMPARISON_ART } from '@/components/summary/comparison-art';
import { Text } from '@/components/text';
import type { ExerciseMedia } from '@/data/exercise-media';
import { tabular } from '@/theme/tokens';

/**
 * The summary's share cards (docs/summary-prs-spec.md, section 3): the PR
 * card when the workout set a record, the workout card, and the comparison
 * card. Square, designed at 1080 by 1080 and drawn at any size through one
 * scale factor, so the preview in the carousel and the offscreen capture
 * are the same component at different sizes.
 *
 * Light or dark (CARD_PALETTES), from the Background button, whatever the
 * app's theme. Gold marks the personal records and nothing else.
 *
 * Every card has the mark and the username at the top and the site handle
 * at the bottom, in the same place, so an image from any of them is
 * recognisable as the same app. The PR and workout cards read like the
 * social feed card, left-aligned; the comparison card is centred.
 *
 * `forSharing` is the one difference between the preview and the captured
 * image: the person looking at the screen is the subject ("You lifted as
 * much as a whale"), and a stranger seeing the image is not, so there it
 * reads "@username lifted as much as a whale". It also drops the
 * thumbnails' fade, and `thumbs` lets the capture swap any thumbnail that
 * has not loaded for its letter tile.
 */
export const CARD_SIZE = 1080;

export type CardKind = 'prs' | 'workout' | 'comparison';

/** PR rows on the PR card before "+N more PRs". */
export const PR_CARD_ROWS = 3;
/** Exercise rows on the workout card before "+N more exercises". */
export const WORKOUT_CARD_ROWS = 4;

export type CardExercise = {
  /** Unique per row: the workout_exercises id. */
  key: string;
  exercise: ExerciseMedia;
  /** Completed working sets. */
  sets: number;
  /** Has a summary PR, so the row ends in "★ PR". */
  pr: boolean;
};

export type CardPr = {
  exercise: ExerciseMedia;
  /** "37.5 kg × 10". */
  best: string;
  /** "35 kg × 10", the previous best. */
  was: string;
  /** "+2.5 kg", "+2 reps", or null for no chip. */
  chip: string | null;
};

export type CardData = {
  username: string;
  name: string;
  dateLabel: string;
  duration: string;
  /**
   * "18,140 lbs", already in the user's unit. A workout with no strength
   * volume but some cardio has its cardio time here ("25:00") instead,
   * with `volumeLabel` "Cardio".
   */
  volume: string;
  /** The stat's label; "Volume" when not given. */
  volumeLabel?: string;
  sets: number;
  /** In position order, exercises with a completed set only. */
  exercises: CardExercise[];
  /** Biggest jump first (summaryPrs in shared). Empty means no PR card. */
  prs: CardPr[];
  /**
   * Null under the lightest object, in which case the card is not offered.
   * The line is picked once per view, so the preview and the capture match,
   * and split into the object for the opener and the flavour under the
   * figure. The opener's subject is the card's call, not the data's.
   */
  comparison: { slug: string; object: string; flavour: string } | null;
};

/** The exercise ids whose thumbnails a card shows, for the capture to wait on. */
export function cardThumbExercises(kind: CardKind, data: CardData): ExerciseMedia[] {
  if (kind === 'prs') return data.prs.slice(0, PR_CARD_ROWS).map((p) => p.exercise);
  if (kind === 'workout') return data.exercises.slice(0, WORKOUT_CARD_ROWS).map((e) => e.exercise);
  return [];
}

export type CardThumbs = {
  /** Exercise ids to draw as the letter tile whatever their image. */
  letterOnly?: ReadonlySet<string>;
  /** Each thumbnail, once drawn. */
  onSettled?: (exerciseId: string) => void;
};

type Scale = (n: number) => number;
type Parts = { data: CardData; u: Scale; p: CardPalette; forSharing: boolean; thumbs?: CardThumbs };

export const ShareCard = forwardRef<
  View,
  {
    kind: CardKind;
    data: CardData;
    size: number;
    theme: CardTheme;
    forSharing?: boolean;
    thumbs?: CardThumbs;
  }
>(function ShareCard({ kind, data, size, theme, forSharing = false, thumbs }, ref) {
  const s = size / CARD_SIZE;
  const u = (n: number) => n * s;
  const p = CARD_PALETTES[theme];
  const parts: Parts = { data, u, p, forSharing, thumbs };

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[
        styles.card,
        { width: size, height: size, padding: u(72), borderRadius: u(48), backgroundColor: p.card },
      ]}>
      <View style={[styles.top, { gap: u(24) }]}>
        <LiftCampMark size={u(96)} />
        <Text style={[styles.username, { fontSize: u(40), color: p.text }]} numberOfLines={1}>
          @{data.username}
        </Text>
      </View>

      <View style={[styles.body, kind === 'comparison' ? styles.bodyCentred : null]}>
        {kind === 'prs' ? <Prs {...parts} /> : null}
        {kind === 'workout' ? <Workout {...parts} /> : null}
        {kind === 'comparison' && data.comparison ? <Comparison {...parts} /> : null}
      </View>

      <Text style={[styles.site, { fontSize: u(32), color: p.muted }]}>@liftcamp.app</Text>
    </View>
  );
});

/** A filled five-point star, drawn so it is the same on every phone. */
export function Star({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96L12 2.5z"
      />
    </Svg>
  );
}

function Thumb({ exercise, size, u, p, forSharing, thumbs }: { exercise: ExerciseMedia; size: number } & Omit<Parts, 'data'>) {
  return (
    <CardThumb
      exercise={exercise}
      size={u(size)}
      radius={u(20)}
      palette={p}
      instant={forSharing}
      letter={thumbs?.letterOnly?.has(exercise.id) ?? false}
      onSettled={thumbs?.onSettled}
    />
  );
}

/** The workout's name on one line, then the date. */
function NameAndDate({ data, u, p }: Pick<Parts, 'data' | 'u' | 'p'>) {
  return (
    <View style={{ gap: u(6) }}>
      <Text
        style={[styles.title, { fontSize: u(60), lineHeight: u(72), letterSpacing: u(-1), color: p.text }]}
        numberOfLines={1}>
        {data.name}
      </Text>
      <Text style={[styles.regular, { fontSize: u(34), color: p.muted }]} numberOfLines={1}>
        {data.dateLabel}
      </Text>
    </View>
  );
}

/** The clay trophy, transparent. */
const PR_TROPHY = require('../../../assets/images/pr/pr-trophy.webp');

/** The trophy's edge: about 76 of the mockup's 350 px. */
const TROPHY_SIZE = 234;
const PR_THUMB = 104;

function Prs(parts: Parts) {
  const { data, u, p } = parts;
  const shown = data.prs.slice(0, PR_CARD_ROWS);
  const more = data.prs.length - shown.length;
  const count = data.prs.length;
  return (
    <View style={{ gap: u(40) }}>
      <View style={[styles.row, { alignItems: 'flex-start' }]}>
        {/* The label and title leave the trophy its corner. */}
        <View style={[styles.fill, { gap: u(20), paddingTop: u(24), paddingRight: u(24) }]}>
          <View style={[styles.row, { gap: u(14) }]}>
            <View
              style={[styles.centred, { width: u(44), height: u(44), borderRadius: u(22), backgroundColor: p.goldFill }]}>
              <Star size={u(28)} color={p.onGold} />
            </View>
            <Text style={[styles.label, { fontSize: u(28), letterSpacing: u(2), color: p.gold }]} numberOfLines={1}>
              {count} {count === 1 ? 'Personal record' : 'Personal records'}
            </Text>
          </View>
          <NameAndDate data={data} u={u} p={p} />
        </View>
        {/* Core Image, as the comparison art: a bundled asset draws in the
            same pass as the text, so the capture never races a decode. */}
        <Image
          source={PR_TROPHY}
          resizeMode="contain"
          style={{ width: u(TROPHY_SIZE), height: u(TROPHY_SIZE), marginTop: u(-24), marginRight: u(-16) }}
          accessibilityIgnoresInvertColors
        />
      </View>

      <View style={{ gap: u(32) }}>
        {shown.map((pr) => (
          <View key={pr.exercise.id} style={[styles.row, { gap: u(28) }]}>
            <Thumb exercise={pr.exercise} size={PR_THUMB} {...parts} />
            <View style={[styles.fill, { gap: u(6) }]}>
              <Text style={[styles.medium, { fontSize: u(40), color: p.text }]} numberOfLines={1}>
                {pr.exercise.name}
              </Text>
              <Text style={[styles.regular, { fontSize: u(34), color: p.muted }]} numberOfLines={1}>
                <Text style={[styles.bold, { fontSize: u(34), color: p.gold }]}>{pr.best}</Text>
                {`  ·  was ${pr.was}`}
              </Text>
            </View>
            {pr.chip ? (
              <View style={[styles.chip, { backgroundColor: p.goldSoft, borderRadius: u(999), paddingHorizontal: u(22), paddingVertical: u(10) }]}>
                <Text style={[styles.bold, { fontSize: u(30), color: p.gold }]} numberOfLines={1}>
                  {pr.chip}
                </Text>
              </View>
            ) : null}
          </View>
        ))}
        {more > 0 ? (
          <Text style={[styles.medium, { fontSize: u(34), color: p.gold }]}>
            +{more} more {more === 1 ? 'PR' : 'PRs'}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const WORKOUT_THUMB = 80;

function Workout(parts: Parts) {
  const { data, u, p } = parts;
  const shown = data.exercises.slice(0, WORKOUT_CARD_ROWS);
  const more = data.exercises.length - shown.length;
  return (
    <View style={{ gap: u(32) }}>
      <NameAndDate data={data} u={u} p={p} />
      <View style={[styles.row, { gap: u(64) }]}>
        <Stat label="Time" value={data.duration} u={u} p={p} />
        <Stat label={data.volumeLabel ?? 'Volume'} value={data.volume} u={u} p={p} />
        <Stat label="Sets" value={String(data.sets)} u={u} p={p} />
      </View>
      <View style={{ height: u(3), backgroundColor: p.divider }} />
      <View style={{ gap: u(24) }}>
        {shown.map((e) => (
          <View key={e.key} style={[styles.row, { gap: u(24) }]}>
            <Thumb exercise={e.exercise} size={WORKOUT_THUMB} {...parts} />
            <Text style={[styles.regular, styles.fill, { fontSize: u(38), color: p.text }]} numberOfLines={1}>
              <Text style={[styles.regular, { fontSize: u(38), color: p.muted }, tabular]}>
                {e.sets} {e.sets === 1 ? 'set' : 'sets'}
              </Text>
              {'  '}
              {e.exercise.name}
            </Text>
            {e.pr ? (
              <View
                style={[
                  styles.row,
                  styles.chip,
                  { gap: u(6), backgroundColor: p.goldFill, borderRadius: u(999), paddingHorizontal: u(18), paddingVertical: u(8) },
                ]}>
                <Star size={u(26)} color={p.onGold} />
                <Text style={[styles.bold, { fontSize: u(28), color: p.onGold }]}>PR</Text>
              </View>
            ) : null}
          </View>
        ))}
        {more > 0 ? (
          <Text style={[styles.medium, { fontSize: u(34), color: p.accent }]}>
            +{more} more {more === 1 ? 'exercise' : 'exercises'}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Stat({ label, value, u, p }: { label: string; value: string; u: Scale; p: CardPalette }) {
  return (
    <View style={{ gap: u(4) }}>
      <Text style={[styles.medium, tabular, { fontSize: u(60), color: p.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.label, { fontSize: u(26), letterSpacing: u(2), color: p.muted }]}>{label}</Text>
    </View>
  );
}

/**
 * The illustration's edge, in card units: up to 560, the main element of
 * the card. It gives way when a two-line opener and flavour need the room,
 * so the text never runs into the site handle. 384 px art drawn larger
 * than that is upscaled, which the soft clay render carries.
 */
const ART_SIZE = 560;

function Comparison({ data, u, p, forSharing }: Parts) {
  const art = data.comparison ? COMPARISON_ART[data.comparison.slug] : undefined;
  const subject = forSharing ? `@${data.username}` : 'You';
  const opener = data.comparison ? `${subject} lifted as much as ${data.comparison.object}` : '';
  return (
    <View style={[styles.block, styles.shrink, { gap: u(16) }]}>
      {/* Core Image, not expo-image: a bundled asset draws in the same pass
          as the text, so the offscreen capture never races the decode. */}
      {art ? (
        <Image
          source={art}
          resizeMode="contain"
          style={[styles.shrink, { height: u(ART_SIZE), aspectRatio: 1, minHeight: 0 }]}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {/* Three parts: the opener names the object, the figure is the
          claim, the flavour is the line's second sentence. The date closes
          the block, since this card has no name line for it to sit under. */}
      <Text
        style={[styles.title, styles.centredText, { fontSize: u(54), lineHeight: u(64), letterSpacing: u(-1), color: p.text }]}
        numberOfLines={2}>
        {opener}
      </Text>
      {/* Stretched to the content width so adjustsFontSizeToFit has a bound
          to fit into; centred inside a block it would keep its intrinsic
          width and overflow instead. No negative tracking here: iOS
          applies letterSpacing after the last glyph too, so a negative
          value clips its right edge. */}
      <Text
        style={[styles.big, tabular, { fontSize: u(94), lineHeight: u(104), color: p.accent }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}>
        {data.volume}
      </Text>
      <Text style={[styles.regular, styles.centredText, { fontSize: u(40), lineHeight: u(50), color: p.muted }]} numberOfLines={2}>
        {data.comparison?.flavour}
      </Text>
      <Text style={[styles.regular, styles.centredText, { fontSize: u(36), color: p.muted }]}>{data.dateLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { justifyContent: 'space-between', overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center' },
  username: { flex: 1, fontWeight: '600' },
  site: { fontWeight: '500' },
  body: { flex: 1, justifyContent: 'center', alignSelf: 'stretch' },
  bodyCentred: { alignItems: 'center' },
  // The comparison block centres its children; its text centres its lines.
  block: { alignItems: 'center', alignSelf: 'stretch' },
  shrink: { flexShrink: 1 },
  fill: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center' },
  centred: { alignItems: 'center', justifyContent: 'center' },
  centredText: { textAlign: 'center' },
  chip: { flexShrink: 0 },
  // Tracking is set per use through u(), since a fixed value does not scale
  // with the card.
  title: { fontWeight: '700' },
  regular: { fontWeight: '400' },
  medium: { fontWeight: '500' },
  bold: { fontWeight: '700' },
  label: { fontWeight: '700', textTransform: 'uppercase' },
  big: { fontWeight: '700', textAlign: 'center', alignSelf: 'stretch' },
});
