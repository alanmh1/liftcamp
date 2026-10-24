import {
  EQUIPMENT_ACCESS,
  EQUIPMENT_ACCESS_LABELS,
  TRAINING_LEVEL_HINTS,
  TRAINING_LEVEL_LABELS,
  TRAINING_LEVELS,
  type EquipmentAccess,
  type TrainingLevel,
} from '@liftcamp/shared';
import { Image } from 'expo-image';
import { Image as RNImage, Pressable, StyleSheet, View } from 'react-native';

import { ROUTINE_ART } from '@/components/home/routine-art';
import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/**
 * The two answers that pick routines, as tiles: a clay illustration as the
 * tile's main content with the label beneath, one tile per value, the
 * selected one in accentSoft with an accent border like the weekly-target
 * numbers. Experience is one row of three; equipment is a 2x2 grid. Used by
 * onboarding. The routines browser filters with its own segmented control
 * and chips, and shares EQUIPMENT_ART.
 *
 * The illustrations are transparent WebP clay renders drawn for both light
 * and dark, so the tiles render the same on iOS and Android. The level
 * images are 216 px, 3x the 72 pt they are drawn at; masters are in
 * assets-src/images/onboarding. The equipment
 * tiles use four of the routine card images, so a tile and the routine
 * cards it leads to share a look.
 *
 * `null` in `onChange` means the user tapped the selected tile again to
 * clear it; onboarding ignores that.
 */

export const LEVEL_ART: Record<TrainingLevel, number> = {
  beginner: require('../../../assets/images/onboarding/level-beginner.webp'),
  intermediate: require('../../../assets/images/onboarding/level-intermediate.webp'),
  advanced: require('../../../assets/images/onboarding/level-advanced.webp'),
};

export const EQUIPMENT_ART: Record<EquipmentAccess, number> = {
  gym: ROUTINE_ART['cable-machine'],
  dumbbells: ROUTINE_ART.dumbbells,
  bodyweight: ROUTINE_ART['bodyweight-mat'],
  bands: ROUTINE_ART['resistance-bands'],
};

/**
 * Warms expo-image's memory and disk cache with every level and equipment
 * image, so the tiles and routine cards draw without a decode on first
 * show. expo-image resolves a `require` through React Native's
 * resolveAssetSource, so prefetching those URIs fills the same cache
 * entries the views read. Resolves false if any image failed; nothing
 * depends on it.
 */
export function preloadRoutineArt(): Promise<boolean> {
  const modules = [...Object.values(LEVEL_ART), ...Object.values(ROUTINE_ART)];
  const uris = modules
    .map((m) => RNImage.resolveAssetSource(m)?.uri)
    .filter((u): u is string => !!u);
  return Image.prefetch(uris, 'memory-disk').catch(() => false);
}

/** Illustration height. Three across a phone leaves about 110pt per tile;
 *  two across leaves about 170, so the grid gets the larger art. */
const ART_ROW = 72;
const ART_GRID = 104;

export function LevelTiles({
  value,
  onChange,
  hints = false,
}: {
  value: TrainingLevel | null;
  onChange: (level: TrainingLevel | null) => void;
  /** A line under each label saying who the level is for. Onboarding shows it. */
  hints?: boolean;
}) {
  return (
    <View style={styles.row}>
      {TRAINING_LEVELS.map((level) => {
        const selected = value === level;
        return (
          <Tile
            key={level}
            label={TRAINING_LEVEL_LABELS[level]}
            hint={hints ? TRAINING_LEVEL_HINTS[level] : undefined}
            art={LEVEL_ART[level]}
            artSize={ART_ROW}
            selected={selected}
            onPress={() => onChange(selected ? null : level)}
          />
        );
      })}
    </View>
  );
}

export function EquipmentTiles({
  value,
  onChange,
}: {
  value: EquipmentAccess | null;
  onChange: (equipment: EquipmentAccess | null) => void;
}) {
  return (
    <View style={styles.grid}>
      {EQUIPMENT_ACCESS.map((eq) => {
        const selected = value === eq;
        return (
          <Tile
            key={eq}
            label={EQUIPMENT_ACCESS_LABELS[eq]}
            art={EQUIPMENT_ART[eq]}
            artSize={ART_GRID}
            selected={selected}
            onPress={() => onChange(selected ? null : eq)}
            half
          />
        );
      })}
    </View>
  );
}

function Tile({
  label,
  hint,
  art,
  artSize,
  selected,
  onPress,
  half = false,
}: {
  label: string;
  /** Under the label, muted. Tiles in a row stretch to the tallest. */
  hint?: string;
  art: number;
  artSize: number;
  selected: boolean;
  onPress: () => void;
  /** Two per row in a wrapping grid, rather than an equal share of one row. */
  half?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.tile,
        half ? styles.half : styles.third,
        {
          backgroundColor: selected ? c.accentSoft : c.surface2,
          borderColor: selected ? c.accent : 'transparent',
        },
        pressed && styles.pressed,
      ]}>
      <Image
        source={art}
        style={{ width: artSize, height: artSize }}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={150}
        accessibilityIgnoresInvertColors
      />
      <Text
        style={[type.meta, styles.label, { color: selected ? c.accentText : c.text }]}
        numberOfLines={1}>
        {label}
      </Text>
      {hint ? (
        <Text style={[type.meta, styles.hint, { color: selected ? c.accentText : c.text2 }]}>{hint}</Text>
      ) : null}
    </Pressable>
  );
}

const GAP = spacing.sm;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: GAP },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.bar,
    borderWidth: 1.5,
  },
  third: { flex: 1, minWidth: 0 },
  // Two per row: half the width less half the gap, so the pair fills the row.
  half: { flexBasis: '48%', flexGrow: 1 },
  label: { fontWeight: '600', fontSize: 13 },
  // Wraps within a third of the row; the row stretches every tile to the
  // tallest, so the three stay even.
  hint: { fontSize: 11, lineHeight: 14, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
