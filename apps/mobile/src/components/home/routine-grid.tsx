import {
  assignCardTints,
  FALLBACK_IMAGE,
  isEquipmentAccess,
  isTrainingLevel,
  templateLevelLabel,
  type ProgramGroup,
  type RoutineImageKey,
} from '@liftcamp/shared';
import type { ReactElement } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ROUTINE_ART } from '@/components/home/routine-art';
import { Skeleton, SkeletonText } from '@/components/skeleton';
import { TintWash } from '@/components/tint-wash';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing, TINT_SLOTS, type } from '@/theme/tokens';

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

/** The program-level facts live on each variation; the first one speaks for the group. */
export function programFacts(group: ProgramGroup) {
  const first = group.templates[0];
  const level = isTrainingLevel(first?.level) ? first.level : null;
  const equipment = isEquipmentAccess(first?.equipment) ? first.equipment : null;
  const days = first?.days_per_week ?? null;
  return { level, equipment, days, levelLabel: templateLevelLabel(first?.level) };
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
 * Workout tab's Find a routine, in the routines browser and in Home's
 * program row (in a fixed-width cell there): the clay art
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
const ART_RADIUS = radius.card - 4;
/** The grid tile's art area: with the band, a tile of about 146 pt. */
const GRID_ART = 86;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: GAP },
  cell: { flex: 1 },
  meta: { lineHeight: 18, fontVariant: ['tabular-nums'] },
  chip: {
    position: 'absolute',
    top: spacing.sm,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  chipLeft: { left: spacing.sm },
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
