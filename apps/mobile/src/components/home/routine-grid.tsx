import {
  FALLBACK_IMAGE,
  isEquipmentAccess,
  isTrainingLevel,
  templateLevelLabel,
  type ProgramGroup,
  type RoutineImageKey,
} from '@liftcamp/shared';
import { useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ROUTINE_ART } from '@/components/home/routine-art';
import { Text } from '@/components/text';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';

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
}: {
  programs: ProgramGroup[];
  art: RoutineArt;
  onOpen: (group: ProgramGroup) => void;
  disabled?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const cardWidth = width > 0 ? (width - SHADOW_ROOM * 2 - GAP) / 2 : undefined;
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
            />
          ))
        : null}
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
}: {
  group: ProgramGroup;
  image: RoutineImageKey;
  width: number;
  onPress: () => void;
  disabled: boolean;
}) {
  const { scheme, colors: c } = useTheme();
  const { levelLabel, days } = programFacts(group);
  const facts = factsLine(levelLabel, days);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${group.program}, ${facts || 'routine'}`}
      style={({ pressed }) => [styles.card, { width }, cardSurface(scheme, c), pressed && styles.pressed]}>
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
        </View>
        <View style={styles.text}>
          <Text style={[type.button, styles.name, { color: c.text }]} numberOfLines={2}>
            {group.program}
          </Text>
          <Text style={[type.meta, styles.facts, { color: c.text2 }]} numberOfLines={1}>
            {facts || ' '}
          </Text>
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
  card: { borderRadius: radius.card },
  clip: { borderRadius: radius.card, overflow: 'hidden' },
  artArea: { height: ART_AREA, alignItems: 'center', justifyContent: 'center' },
  // About 85% of the area's height, centred.
  art: { width: ART_AREA * 0.85, height: ART_AREA * 0.85 },
  text: { padding: spacing.md, gap: 2 },
  // Two lines reserved whether the name uses them or not, so a short name
  // and a long one line up across a row.
  name: { fontSize: 15, lineHeight: NAME_LINE, height: NAME_LINE * 2 },
  facts: { lineHeight: 18 },
  pressed: { opacity: 0.7 },
});
