import {
  EQUIPMENT_ACCESS,
  EQUIPMENT_ACCESS_LABELS,
  TRAINING_LEVEL_LABELS,
  TRAINING_LEVELS,
  type EquipmentAccess,
  type TrainingLevel,
} from '@liftcamp/shared';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { EquipmentIcon } from '@/components/equipment-icon';
import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/**
 * The two answers that pick programs, as rows of tiles: a glyph above a
 * label, one tile per value, the selected one in accentSoft with an accent
 * border like the weekly-target numbers. Used by onboarding, the routines
 * list's filters, and anywhere else the pair is asked.
 *
 * `null` in `onChange` means the user tapped the selected tile again to
 * clear it; onboarding ignores that, the routines filters use it.
 */

const GLYPH = 26;

export function LevelTiles({
  value,
  onChange,
}: {
  value: TrainingLevel | null;
  onChange: (level: TrainingLevel | null) => void;
}) {
  const c = useColors();
  return (
    <View style={styles.row}>
      {TRAINING_LEVELS.map((level) => {
        const selected = value === level;
        return (
          <Tile
            key={level}
            label={TRAINING_LEVEL_LABELS[level]}
            selected={selected}
            onPress={() => onChange(selected ? null : level)}>
            <LevelBars level={level} color={selected ? c.accentText : c.text} />
          </Tile>
        );
      })}
    </View>
  );
}

/**
 * Gym, Dumbbells and Bodyweight are SF Symbols. Bands is the cable glyph the
 * band equipment kind draws in the picker rows, so the tile matches what the
 * user then sees on exercises; SF has no band, and its functional-training
 * figure is too close to the barbell figure at tile size.
 */
const EQUIPMENT_SYMBOLS: Record<Exclude<EquipmentAccess, 'bands'>, SFSymbol> = {
  gym: 'figure.strengthtraining.traditional',
  dumbbells: 'dumbbell',
  bodyweight: 'figure.core.training',
};

export function EquipmentTiles({
  value,
  onChange,
}: {
  value: EquipmentAccess | null;
  onChange: (equipment: EquipmentAccess | null) => void;
}) {
  const c = useColors();
  return (
    <View style={styles.row}>
      {EQUIPMENT_ACCESS.map((eq) => {
        const selected = value === eq;
        const color = selected ? c.accentText : c.text;
        return (
          <Tile
            key={eq}
            label={EQUIPMENT_ACCESS_LABELS[eq]}
            selected={selected}
            onPress={() => onChange(selected ? null : eq)}>
            {eq === 'bands' ? (
              // Named "cable" rather than "bands" so the tile draws the cable
              // glyph whichever glyph the band kind maps to on this build.
              <EquipmentIcon equipment="cable" size={GLYPH} color={color} />
            ) : (
              <SymbolView
                name={EQUIPMENT_SYMBOLS[eq]}
                size={GLYPH}
                weight="regular"
                tintColor={color}
                style={styles.glyph}
                // Android has no SF Symbols; the label carries the tile.
                fallback={<View style={styles.glyph} />}
              />
            )}
          </Tile>
        );
      })}
    </View>
  );
}

/**
 * Three bars filled to one, two or three, the same glyph at three values so
 * the row reads as a scale. Drawn, because expo-symbols 57 has no static
 * `variableValue` for `chart.bar.fill`; the same 24-unit grid, 2-unit stroke
 * feel as the equipment glyphs.
 */
export function LevelBars({
  level,
  color,
  size = GLYPH,
}: {
  level: TrainingLevel;
  color: string;
  size?: number;
}) {
  const filled = TRAINING_LEVELS.indexOf(level) + 1;
  const bars = [
    { x: 3, height: 8 },
    { x: 9.75, height: 14 },
    { x: 16.5, height: 20 },
  ];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {bars.map((b, i) => (
        <Rect
          key={b.x}
          x={b.x}
          y={22 - b.height}
          width={4.5}
          height={b.height}
          rx={1.5}
          fill={color}
          fillOpacity={i < filled ? 1 : 0.22}
        />
      ))}
    </Svg>
  );
}

function Tile({
  label,
  selected,
  onPress,
  children,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  children: React.ReactNode;
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
        {
          backgroundColor: selected ? c.accentSoft : c.surface2,
          borderColor: selected ? c.accent : 'transparent',
        },
        pressed && styles.pressed,
      ]}>
      <View style={styles.glyphWrap}>{children}</View>
      <Text
        style={[type.meta, styles.label, { color: selected ? c.accentText : c.text }]}
        numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.bar,
    borderWidth: 1.5,
  },
  glyphWrap: { height: GLYPH + 4, justifyContent: 'center' },
  glyph: { width: GLYPH, height: GLYPH },
  label: { fontWeight: '600', fontSize: 12 },
  pressed: { opacity: 0.7 },
});
