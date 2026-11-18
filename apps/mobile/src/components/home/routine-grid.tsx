import {
  assignCardTints,
  FALLBACK_IMAGE,
  isEquipmentAccess,
  isTrainingLevel,
  templateLevelLabel,
  type ProgramGroup,
  type RoutineImageKey,
} from '@liftcamp/shared';
import { Fragment, useState, type ReactElement } from 'react';
import { Image } from 'expo-image';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ROUTINE_ART } from '@/components/home/routine-art';
import { Skeleton, SkeletonText } from '@/components/skeleton';
import { TintWash } from '@/components/tint-wash';
import { Text, useFontScale } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, pressedFlat, radius, spacing, TINT_SLOTS, type } from '@/theme/tokens';

/** Program name to image key, from routineArtByProgram over the full system list. */
export type RoutineArt = Map<string, RoutineImageKey>;

/**
 * A tint slot per program name, for the tiles in `programs` in the order
 * shown (assignCardTints in shared): tiles with the same art never share a
 * colour, and neighbours differ. A program in `fixed` keeps its slot and
 * is pinned for the walk (it counts toward the same-art rule), so a card
 * outside the grid, onboarding's plan card, and its tile agree.
 */
export function programTintSlots(
  programs: readonly ProgramGroup[],
  art: RoutineArt,
  fixed: ReadonlyMap<string, number> = new Map(),
): Map<string, number> {
  const artOf = (program: string) => art.get(program) ?? FALLBACK_IMAGE;
  const pinned = programs
    .filter((g) => fixed.has(g.program))
    .map((g) => ({ art: artOf(g.program), slot: fixed.get(g.program)! }));
  const out = assignCardTints(
    programs.filter((g) => !fixed.has(g.program)).map((g) => ({ id: g.program, art: artOf(g.program) })),
    TINT_SLOTS.length,
    pinned,
  );
  for (const [program, slot] of fixed) out.set(program, slot);
  return out;
}

/**
 * Routines as a two-column grid of cards, no variations: a tinted image
 * panel with the routine's equipment illustration and its days a week,
 * then the name and the number of workouts. Tapping a card opens the
 * routine detail; there is no Use on the card. Onboarding page 4 and the routines list render the
 * grid; the program row on Home and Workout renders the same tile
 * (`RoutineTile`) at a fixed width, so it is the one place a routine card
 * is drawn.
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
        render={(i) => <RoutineTileSkeleton index={i} style={styles.cell} />}
      />
    );
  }
  return (
    <View style={styles.grid} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {cardWidth
        ? Array.from({ length: count }, (_, i) => (
            <RoutineTileSkeleton key={i} index={i} style={{ width: cardWidth }} />
          ))
        : null}
    </View>
  );
}

/** One placeholder tile. `style` sizes it: a width on iOS, `styles.cell` in Android's rows, a fixed width in the program row. */
export function RoutineTileSkeleton({ index, style }: { index: number; style: StyleProp<ViewStyle> }) {
  const { scheme, colors: c } = useTheme();
  const nameHeight = { height: NAME_LINE * 2 * useFontScale() };
  return (
    <View style={[styles.card, style, cardSurface(scheme, c)]}>
      <Skeleton height={ART_AREA} radius={ART_RADIUS} />
      <View style={styles.text}>
        <View style={[styles.nameHold, nameHeight]}>
          <SkeletonText variant={styles.name} width={index % 2 === 0 ? '78%' : '62%'} />
        </View>
        <SkeletonText variant={type.meta} width="50%" />
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

/** "12 workouts", plus the level when the screen has not named it: "3 workouts · Advanced". */
function metaLine(workouts: number, levelLabel: string | null): string {
  return [`${workouts} ${workouts === 1 ? 'workout' : 'workouts'}`, levelLabel].filter(Boolean).join(' · ');
}

/**
 * One routine as a tile (docs/workout-tab-spec.md, Find a routine): the
 * clay art inset in a tinted panel with the days a week on a chip at its
 * top left, then the name and the number of workouts. The whole tile opens
 * the routine detail.
 */
export function RoutineTile({
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
  /** The card's width in the iOS grid and the program row. Omitted in Android's rows, where it fills its cell. */
  width?: number;
  onPress: () => void;
  disabled: boolean;
  /**
   * The level the screen already names ("For beginners with dumbbells").
   * A tile of that level leaves it off; any other level is on its meta line.
   */
  namedLevel: string | null;
  recommended: boolean;
}) {
  const { scheme, colors: c } = useTheme();
  const nameHeight = { height: NAME_LINE * 2 * useFontScale() };
  const { level, levelLabel, days } = programFacts(group);
  const meta = metaLine(group.templates.length, level && level === namedLevel ? null : levelLabel);
  const daysLabel = days ? `${days} ${days === 1 ? 'day' : 'days'}` : null;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={[recommended ? 'Recommended' : null, group.program, daysLabel ? `${daysLabel} a week` : null, meta]
        .filter(Boolean)
        .join(', ')}
      style={({ pressed }) => [
        styles.card,
        width != null ? { width } : styles.cell,
        cardSurface(scheme, c),
        pressed && [styles.pressed, pressedFlat],
      ]}>
      <View style={[styles.artArea, { backgroundColor: c.surface2 }]}>
        <Image
          source={ROUTINE_ART[image]}
          style={styles.art}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={150}
          accessibilityIgnoresInvertColors
        />
        {daysLabel ? (
          <View style={[styles.chip, styles.chipLeft, { backgroundColor: c.surface }]}>
            <Text style={[type.meta, styles.chipText, { color: c.text }]}>{daysLabel}</Text>
          </View>
        ) : null}
        {recommended ? (
          <View style={[styles.chip, styles.chipRight, { backgroundColor: c.accent }]}>
            <Text style={[type.meta, styles.chipText, { color: '#FFFFFF' }]}>Recommended</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.text}>
        <Text style={[type.button, styles.name, nameHeight, { color: c.text }]} numberOfLines={2}>
          {group.program}
        </Text>
        <Text style={[type.meta, styles.meta, { color: c.text2 }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * A grid tile's meta line, digits as on every meta line. `days`: "3 days
 * a week" (the Workout tab). `daysAndWorkouts`: "3 days a week · 12
 * workouts" (the routines browser). With no days a week, the workouts.
 */
function gridTileMeta(group: ProgramGroup, meta: 'days' | 'daysAndWorkouts'): string {
  const { days } = programFacts(group);
  const n = group.templates.length;
  const workouts = `${n} ${n === 1 ? 'workout' : 'workouts'}`;
  if (!days) return workouts;
  const perWeek = `${days} ${days === 1 ? 'day' : 'days'} a week`;
  return meta === 'days' ? perWeek : `${perWeek} · ${workouts}`;
}

/**
 * One program as a grid tile (docs/routine-builder-spec.md), on the
 * Workout tab's Find a routine and in the routines browser: the clay art
 * on a diagonal pastel wash (TintWash, its slot from the grid), a 1 pt
 * border line, then a `surface` band (the same on every tile) with the name and the
 * meta line. A 1 pt border and no shadow. Fills its cell; the whole tile
 * opens the routine detail.
 */
export function ProgramGridTile({
  group,
  image,
  onPress,
  disabled,
  meta: metaKind = 'days',
  badge,
  tint,
}: {
  group: ProgramGroup;
  image: RoutineImageKey;
  /** The art area's tint slot (TINT_SLOTS), from `programTintSlots` over the tiles shown. */
  tint: number;
  onPress: () => void;
  disabled: boolean;
  meta?: 'days' | 'daysAndWorkouts';
  /** A small accent pill over the art's top-left corner ("Your plan"). */
  badge?: string | null;
}) {
  const c = useTheme().colors;
  const meta = gridTileMeta(group, metaKind);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={[badge, group.program, meta].filter(Boolean).join(', ')}
      style={({ pressed }) => [
        styles.gridTile,
        { backgroundColor: c.surface, borderColor: c.border },
        pressed && styles.pressed,
      ]}>
      <View style={styles.gridArt}>
        <TintWash slot={tint} />
        <Image
          source={ROUTINE_ART[image]}
          style={styles.gridArtImage}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={150}
          accessibilityIgnoresInvertColors
        />
        {badge ? (
          <View style={[styles.chip, styles.chipLeft, { backgroundColor: c.accent }]}>
            <Text style={[type.meta, styles.chipText, { color: '#FFFFFF' }]}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.gridBand, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <Text style={[type.exerciseName, styles.gridName, { color: c.text }]} numberOfLines={2}>
          {group.program}
        </Text>
        <Text style={[type.meta, styles.meta, { color: c.text2 }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}

/** A grid tile's shape while the programs load. */
export function ProgramGridTileSkeleton({ index }: { index: number }) {
  const c = useTheme().colors;
  return (
    <View style={[styles.gridTile, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.gridArt}>
        <Skeleton width={GRID_ART * 0.8} height={GRID_ART * 0.8} radius={ART_RADIUS} />
      </View>
      <View style={[styles.gridBand, { backgroundColor: c.surface2, borderTopColor: c.border }]}>
        <SkeletonText variant={styles.gridName} width={index % 2 === 0 ? '78%' : '62%'} />
        <SkeletonText variant={type.meta} width="50%" />
      </View>
    </View>
  );
}

/**
 * The routines browser's grid: every program as a `ProgramGridTile`, two
 * a row, with the days a week and the number of workouts on each band.
 * `art` comes from the full system list, whichever subset this grid
 * shows, so a tile's image does not change when the list is filtered.
 */
export function ProgramTileGrid({
  programs,
  art,
  onOpen,
  disabled = false,
  badges,
  fixedTints,
}: {
  programs: ProgramGroup[];
  art: RoutineArt;
  onOpen: (group: ProgramGroup) => void;
  disabled?: boolean;
  /** A badge per program name, for the tiles that carry one ("Your plan"). */
  badges?: Record<string, string>;
  /** Programs whose tint is decided outside the grid (see programTintSlots). */
  fixedTints?: ReadonlyMap<string, number>;
}) {
  const tints = programTintSlots(programs, art, fixedTints);
  return (
    <TileRows
      items={programs}
      keyOf={(g) => g.program}
      render={(g) => (
        <ProgramGridTile
          group={g}
          image={art.get(g.program) ?? FALLBACK_IMAGE}
          onPress={() => onOpen(g)}
          disabled={disabled}
          meta="daysAndWorkouts"
          badge={badges?.[g.program]}
          tint={tints.get(g.program) ?? 0}
        />
      )}
    />
  );
}

/** The browser grid's shape before the routines load: `count` tiles. */
export function ProgramTileGridSkeleton({ count }: { count: number }) {
  return (
    <TileRows
      items={Array.from({ length: count }, (_, i) => i)}
      keyOf={String}
      render={(i) => <ProgramGridTileSkeleton index={i} />}
    />
  );
}

/** Two tiles a row, each half the width, the last one half width when alone. */
export function TileRows<T>({
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
    <View style={styles.tileRows}>
      {rows.map((pair) => (
        <View key={pair.map(keyOf).join('|')} style={styles.row}>
          {pair.map((item) => (
            <View key={keyOf(item)} style={styles.cell}>
              {render(item)}
            </View>
          ))}
          {pair.length === 1 ? <View style={styles.cell} /> : null}
        </View>
      ))}
    </View>
  );
}

const GAP = spacing.md;
/** Enough for the card shadow: 8 blur plus the 2 offset. */
export const SHADOW_ROOM = 10;
const ART_AREA = 96;
const ART_RADIUS = radius.card - 4;
const TILE_PAD = spacing.sm;
const NAME_LINE = 20;
/** The grid tile's art area: with the band, a tile of about 146 pt. */
const GRID_ART = 86;

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
  // The art panel sits inset by the card's padding, so it needs no clip
  // and the card keeps its shadow.
  card: { borderRadius: radius.card, padding: TILE_PAD },
  artArea: {
    height: ART_AREA,
    borderRadius: ART_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // About 85% of the panel's height, centred.
  art: { width: ART_AREA * 0.85, height: ART_AREA * 0.85 },
  text: { paddingTop: spacing.sm, paddingHorizontal: 2, gap: 2 },
  // Two lines reserved whether the name uses them or not, so a short name
  // and a long one line up across a row. The height here is at 100% text
  // size; the tile multiplies it by useFontScale(), as lineHeight scales.
  name: { fontSize: 15, lineHeight: NAME_LINE, height: NAME_LINE * 2 },
  nameHold: { height: NAME_LINE * 2 },
  meta: { lineHeight: 18, fontVariant: ['tabular-nums'] },
  chip: {
    position: 'absolute',
    top: spacing.sm,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  chipLeft: { left: spacing.sm },
  chipRight: { right: spacing.sm },
  chipText: { fontSize: 11, lineHeight: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  tileRows: { gap: GAP },
  // Fills its cell, which the row stretches to its tallest tile, so a
  // one-line name and a two-line one end level.
  gridTile: { flex: 1, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  gridArt: { height: GRID_ART, alignItems: 'center', justifyContent: 'center' },
  gridArtImage: { width: GRID_ART * 0.85, height: GRID_ART * 0.85 },
  // Under the fixed art area and down to the tile's bottom edge.
  gridBand: {
    flex: 1,
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  gridName: { fontSize: type.exerciseName.fontSize, lineHeight: 22 },
  // A slight dim and shrink, so the card reads as a button under the finger.
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
