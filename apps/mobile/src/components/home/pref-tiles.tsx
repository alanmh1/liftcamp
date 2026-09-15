import {
  EQUIPMENT_ACCESS,
  EQUIPMENT_ACCESS_LABELS,
  TRAINING_LEVEL_LABELS,
  TRAINING_LEVELS,
  type EquipmentAccess,
  type TrainingLevel,
} from '@liftcamp/shared';
import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/**
 * The two answers that pick routines, as tiles: a clay illustration as the
 * tile's main content with the label beneath, one tile per value, the
 * selected one in accentSoft with an accent border like the weekly-target
 * numbers. Experience is one row of three; equipment is a 2x2 grid. Used by
 * onboarding and the routines list's filters.
 *
 * The illustrations are PNGs (384px, transparent, drawn for both light and
 * dark), so the tiles render the same on iOS and Android.
 *
 * `null` in `onChange` means the user tapped the selected tile again to
 * clear it; onboarding ignores that, the routines filters use it.
 */

const LEVEL_ART: Record<TrainingLevel, ImageSourcePropType> = {
  beginner: require('../../../assets/images/onboarding/level-beginner.png'),
  intermediate: require('../../../assets/images/onboarding/level-intermediate.png'),
  advanced: require('../../../assets/images/onboarding/level-advanced.png'),
};

const EQUIPMENT_ART: Record<EquipmentAccess, ImageSourcePropType> = {
  gym: require('../../../assets/images/onboarding/equip-gym.png'),
  dumbbells: require('../../../assets/images/onboarding/equip-dumbbells.png'),
  bodyweight: require('../../../assets/images/onboarding/equip-bodyweight.png'),
  bands: require('../../../assets/images/onboarding/equip-bands.png'),
};

/** Illustration height. Three across a phone leaves about 110pt per tile;
 *  two across leaves about 170, so the grid gets the larger art. */
const ART_ROW = 72;
const ART_GRID = 104;

export function LevelTiles({
  value,
  onChange,
}: {
  value: TrainingLevel | null;
  onChange: (level: TrainingLevel | null) => void;
}) {
  return (
    <View style={styles.row}>
      {TRAINING_LEVELS.map((level) => {
        const selected = value === level;
        return (
          <Tile
            key={level}
            label={TRAINING_LEVEL_LABELS[level]}
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
  art,
  artSize,
  selected,
  onPress,
  half = false,
}: {
  label: string;
  art: ImageSourcePropType;
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
      accessibilityLabel={label}
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
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <Text
        style={[type.meta, styles.label, { color: selected ? c.accentText : c.text }]}
        numberOfLines={1}>
        {label}
      </Text>
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
  pressed: { opacity: 0.7 },
});
