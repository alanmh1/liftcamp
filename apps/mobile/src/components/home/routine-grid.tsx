import {
  isEquipmentAccess,
  isTrainingLevel,
  templateLevelLabel,
  type ProgramGroup,
} from '@liftcamp/shared';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { EQUIPMENT_ART } from '@/components/home/pref-tiles';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';

/**
 * Routines as a two-column grid of tiles, no variations: the equipment
 * illustration, the routine name, the level as a word. Tapping a tile opens
 * the routine detail; there is no Use on the tile. Onboarding page 3 and the
 * routines list both render this, so it is the one place a routine tile is
 * drawn.
 *
 * Tiles are equal height: the name gets two lines of fixed height whether
 * it needs one or two, so a short name and a long one line up.
 */
export function RoutineGrid({
  programs,
  onOpen,
  disabled = false,
}: {
  programs: ProgramGroup[];
  onOpen: (group: ProgramGroup) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.grid}>
      {programs.map((g) => (
        <RoutineTile key={g.program} group={g} onPress={() => onOpen(g)} disabled={disabled} />
      ))}
    </View>
  );
}

/** The program-level facts live on each variation; the first one speaks for the group. */
export function programFacts(group: ProgramGroup) {
  const first = group.templates[0];
  const level = isTrainingLevel(first?.level) ? first.level : null;
  const equipment = isEquipmentAccess(first?.equipment) ? first.equipment : null;
  return { level, equipment, levelLabel: templateLevelLabel(first?.level) };
}

function RoutineTile({
  group,
  onPress,
  disabled,
}: {
  group: ProgramGroup;
  onPress: () => void;
  disabled: boolean;
}) {
  const { scheme, colors: c } = useTheme();
  const { equipment, levelLabel } = programFacts(group);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${group.program}, ${levelLabel ?? 'routine'}`}
      style={({ pressed }) => [styles.tile, cardSurface(scheme, c), pressed && styles.pressed]}>
      <View style={styles.artWrap}>
        {equipment ? (
          <Image source={EQUIPMENT_ART[equipment]} style={styles.art} resizeMode="contain" />
        ) : null}
      </View>
      <Text style={[type.exerciseName, styles.name, { color: c.text }]} numberOfLines={2}>
        {group.program}
      </Text>
      <Text style={[type.meta, { color: c.text2 }]} numberOfLines={1}>
        {levelLabel ?? ' '}
      </Text>
    </Pressable>
  );
}

const ART = 88;
const NAME_LINE = 21;

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: radius.card,
    padding: spacing.card,
    gap: spacing.xs,
  },
  artWrap: { height: ART, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  art: { width: ART, height: ART },
  // Two lines reserved whether the name uses them or not.
  name: { lineHeight: NAME_LINE, height: NAME_LINE * 2 },
  pressed: { opacity: 0.7 },
});
