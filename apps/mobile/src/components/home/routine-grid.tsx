import {
  FALLBACK_IMAGE,
  isEquipmentAccess,
  isTrainingLevel,
  templateLevelLabel,
  type ProgramGroup,
  type RoutineImageKey,
} from '@liftcamp/shared';
import { Fragment, useState, type ReactElement } from 'react';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ROUTINE_ART } from '@/components/home/routine-art';
import { Skeleton, SkeletonText } from '@/components/skeleton';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, pressedFlat, radius, spacing, type } from '@/theme/tokens';

/** Program name to image key, from routineArtByProgram over the full system list. */
export type RoutineArt = Map<string, RoutineImageKey>;

/**
 * Routines as a two-column grid of cards, no variations: a tinted image
 * area with the routine's equipment illustration, the name, then the level
 * and days a week. Tapping a card opens the routine detail; there is no
 * Use on the card. Onboarding page 4, Home's Starter routines and the
 * routines list all render this, so it is the one place a routine card is
 * drawn.
 *
 * Always two columns, measured from the container so an odd last card
 * stays half width. The grid pads itself and pulls the padding back with a
 * negative margin, so the cards' shadows have room on every side inside a
 * padded scroll view without the cards moving.
 *
 * `art` comes from the full system list, whichever subset this grid shows,
 * so a card's image does not change when the list is filtered.
 */
export function RoutineGrid({
  programs,
  art,
  onOpen,
  disabled = false,
  namedLevel = null,
  recommended,
}: {
  programs: ProgramGroup[];
  art: RoutineArt;
  onOpen: (group: ProgramGroup) => void;
  disabled?: boolean;
  /**
   * The level the screen's heading already names ("For beginners with
   * dumbbells"). A card of that level leaves it off its meta line and reads
   * "3 days a week"; a card of any other level still says its level.
   */
  namedLevel?: string | null;
  /** The program to badge "Recommended". */
  recommended?: string;
}) {
  const [width, setWidth] = useState(0);
  const cardWidth = width > 0 ? (width - SHADOW_ROOM * 2 - GAP) / 2 : undefined;
  if (Platform.OS === 'android') {
    return (
      <AndroidRows
        items={programs}
        keyOf={(g) => g.program}
        render={(g) => (
          <RoutineTile
            group={g}
            image={art.get(g.program) ?? FALLBACK_IMAGE}
            onPress={() => onOpen(g)}
            disabled={disabled}
            namedLevel={namedLevel}
            recommended={g.program === recommended}
          />
        )}
      />
    );
  }
  return (
    <View style={styles.grid} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {cardWidth
        ? programs.map((g) => (
            <RoutineTile
              key={g.program}
              group={g}
              image={art.get(g.program) ?? FALLBACK_IMAGE}
              width={cardWidth}
              onPress={() => onOpen(g)}
              disabled={disabled}
              namedLevel={namedLevel}
              recommended={g.program === recommended}
            />
          ))
        : null}
    </View>
  );
}

/** The grid's shape before the routines load: `count` tiles, measured the same way. */
export function RoutineGridSkeleton({ count }: { count: number }) {
  const [width, setWidth] = useState(0);
  const cardWidth = width > 0 ? (width - SHADOW_ROOM * 2 - GAP) / 2 : undefined;
  if (Platform.OS === 'android') {
    return (
      <AndroidRows
        items={Array.from({ length: count }, (_, i) => i)}
        keyOf={String}
        render={(i) => <SkeletonTile index={i} style={styles.cell} />}
      />
    );
  }
  return (
    <View style={styles.grid} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {cardWidth
        ? Array.from({ length: count }, (_, i) => (
            <SkeletonTile key={i} index={i} style={{ width: cardWidth }} />
          ))
        : null}
    </View>
  );
}

/** One placeholder tile. `style` sizes it: a width on iOS, `styles.cell` in Android's rows. */
function SkeletonTile({ index, style }: { index: number; style: StyleProp<ViewStyle> }) {
  const { scheme, colors: c } = useTheme();
  return (
    <View style={[styles.card, style, cardSurface(scheme, c)]}>
      <View style={styles.clip}>
        <Skeleton height={ART_AREA} radius={0} />
        <View style={styles.text}>
          <View style={styles.nameHold}>
            <SkeletonText variant={styles.name} width={index % 2 === 0 ? '78%' : '62%'} />
          </View>
          <SkeletonText variant={type.meta} width="70%" />
        </View>
      </View>
    </View>
  );
}

/**
 * Android's two columns: the items in pairs, each pair an explicit row of
 * two `flex: 1` cells with the gap between them, and an empty cell beside
 * a last card on its own, so it stays half width.
 *
 * Not the flexWrap grid iOS uses. That grid sizes its cards from its own
 * measured width, which onLayout reports rounded to device pixels. On a
 * screen whose width in points is not whole (a Pixel 8 is 1080 px at
 * 2.625, 411.43 pt) the rounded width can come out a fraction of a point
 * wider than the width Yoga breaks lines against, so two cards and the gap
 * no longer fit, and every second card wraps into a column of one.
 * Cells that share the row by flex cannot overflow it.
 */
function AndroidRows<T>({
  items,
  keyOf,
  render,
}: {
  items: T[];
  keyOf: (item: T) => string;
  render: (item: T) => ReactElement;
}) {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <View style={styles.rows}>
      {rows.map((pair) => (
        <View key={pair.map(keyOf).join('|')} style={styles.row}>
          {pair.map((item) => (
            <Fragment key={keyOf(item)}>{render(item)}</Fragment>
          ))}
          {pair.length === 1 ? <View style={styles.cell} /> : null}
        </View>
      ))}
    </View>
  );
}

/** The program-level facts live on each variation; the first one speaks for the group. */
export function programFacts(group: ProgramGroup) {
  const first = group.templates[0];
  const level = isTrainingLevel(first?.level) ? first.level : null;
  const equipment = isEquipmentAccess(first?.equipment) ? first.equipment : null;
  const days = first?.days_per_week ?? null;
  return { level, equipment, days, levelLabel: templateLevelLabel(first?.level) };
}

/** "Beginner · 3 days a week", with whichever halves the routine has. */
function factsLine(levelLabel: string | null, days: number | null): string {
  const parts = [levelLabel, days ? `${days} ${days === 1 ? 'day' : 'days'} a week` : null].filter(Boolean);
  return parts.join(' · ');
}

function RoutineTile({
  group,
  image,
  width,
  onPress,
  disabled,
  namedLevel,
  recommended,
}: {
  group: ProgramGroup;
  image: RoutineImageKey;
  /** The card's width in the iOS grid. Omitted in Android's rows, where it fills its cell. */
  width?: number;
  onPress: () => void;
  disabled: boolean;
  namedLevel: string | null;
  recommended: boolean;
}) {
  const { scheme, colors: c } = useTheme();
  const { level, levelLabel, days } = programFacts(group);
  const facts = factsLine(level && level === namedLevel ? null : levelLabel, days);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${recommended ? 'Recommended: ' : ''}${group.program}, ${facts || 'routine'}`}
      style={({ pressed }) => [
        styles.card,
        width != null ? { width } : styles.cell,
        cardSurface(scheme, c),
        pressed && [styles.pressed, pressedFlat],
      ]}>
      {/* The clip lives on an inner view: overflow hidden on the card itself
          would cut its own shadow. */}
      <View style={styles.clip}>
        <View style={[styles.artArea, { backgroundColor: c.surface2 }]}>
          <Image
            source={ROUTINE_ART[image]}
            style={styles.art}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={150}
            accessibilityIgnoresInvertColors
          />
          {recommended ? (
            <View style={[styles.badge, { backgroundColor: c.accent }]}>
              <Text style={[type.meta, styles.badgeText]}>Recommended</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.text}>
          <Text style={[type.button, styles.name, { color: c.text }]} numberOfLines={2}>
            {group.program}
          </Text>
          {/* The chevron says the card opens something. */}
          <View style={styles.factsRow}>
            <Text style={[type.meta, styles.facts, { color: c.text2 }]} numberOfLines={1}>
              {facts || ' '}
            </Text>
            <SymbolView
              name="chevron.right"
              size={11}
              weight="semibold"
              tintColor={c.text3}
              fallback={<Text style={[styles.chevron, { color: c.text3 }]}>›</Text>}
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const GAP = spacing.md;
/** Enough for the card shadow: 8 blur plus the 2 offset. */
const SHADOW_ROOM = 10;
const ART_AREA = 104;
const NAME_LINE = 20;

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    padding: SHADOW_ROOM,
    margin: -SHADOW_ROOM,
  },
  // Android's rows (see AndroidRows): the same padding and pull-back as the
  // grid, so the shadows have room.
  rows: { gap: GAP, padding: SHADOW_ROOM, margin: -SHADOW_ROOM },
  row: { flexDirection: 'row', gap: GAP },
  cell: { flex: 1 },
  card: { borderRadius: radius.card },
  clip: { borderRadius: radius.card, overflow: 'hidden' },
  artArea: { height: ART_AREA, alignItems: 'center', justifyContent: 'center' },
  // About 85% of the area's height, centred.
  art: { width: ART_AREA * 0.85, height: ART_AREA * 0.85 },
  text: { padding: spacing.md, gap: 2 },
  // Two lines reserved whether the name uses them or not, so a short name
  // and a long one line up across a row.
  name: { fontSize: 15, lineHeight: NAME_LINE, height: NAME_LINE * 2 },
  nameHold: { height: NAME_LINE * 2 },
  factsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  facts: { lineHeight: 18, flexShrink: 1 },
  chevron: { fontSize: 15, lineHeight: 18 },
  badge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  // A slight dim and shrink, so the card reads as a button under the finger.
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
