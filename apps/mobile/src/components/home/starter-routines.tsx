import { matchHeading, type ProgramGroup, type ProgramMatch } from '@liftcamp/shared';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { RoutineDetailSheet } from '@/components/home/routine-detail';
import { RoutineGrid, type RoutineArt } from '@/components/home/routine-grid';
import { SkeletonText } from '@/components/skeleton';
import { Text } from '@/components/text';
import type { TrainingPrefs } from '@/data/home';
import { useColors } from '@/theme/theme-provider';
import { flattenAlpha, spacing, type } from '@/theme/tokens';

/**
 * System routines as the routine grid, the same tiles and detail sheet as
 * onboarding and the routines list. Collapsed for existing users, expanded
 * for new ones; the header toggles it either way. Use routine in the sheet
 * saves every variation as the user's own and Home reloads, so the copies
 * appear in Your routines above.
 *
 * With a level on the profile the list is the matcher's, and the sub-line
 * says why ("For beginners with dumbbells"); the Routines header's See all
 * opens the full list. With no level it is the unmatched list and the sub-line is the
 * count, which is what every user from before the question sees.
 */
export function StarterRoutines({
  match,
  art,
  prefs,
  defaultOpen,
  disabled,
  onUse,
}: {
  match: ProgramMatch & { matched: boolean };
  /** From the full system list, so a card's image is the same in every grid. */
  art: RoutineArt;
  prefs: TrainingPrefs;
  defaultOpen: boolean;
  /** Something else on Home is busy; tiles do not open. */
  disabled: boolean;
  /** Save the routine as the user's own. Resolves true when it worked. */
  onUse: (group: ProgramGroup) => Promise<boolean>;
}) {
  const c = useColors();
  const [open, setOpen] = useState(defaultOpen);
  const [detail, setDetail] = useState<ProgramGroup | null>(null);
  const [busy, setBusy] = useState(false);

  async function use(group: ProgramGroup) {
    if (busy) return;
    setBusy(true);
    const ok = await onUse(group);
    setBusy(false);
    if (ok) setDetail(null);
    else Alert.alert('Could not save that routine.', 'Try again.');
  }
  const { programs } = match;
  if (programs.length === 0) return null;

  const why =
    match.matched && prefs.level
      ? match.exact
        ? matchHeading(prefs.level, prefs.equipment)
        : `${matchHeading(prefs.level, null)}, any equipment`
      : `${programs.length} proven ${programs.length === 1 ? 'routine' : 'routines'}`;

  return (
    // No layout animation on the section and no exit fade on the grid: the
    // same pair left the workout screen's collapsed cards stuck at their old
    // height (see EXPAND_FADE_MS in exercise-card). Collapsing is instant;
    // opening still fades in.
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[type.exerciseName, { color: c.text }]}>Starter routines</Text>
          <Text style={[type.meta, { color: c.text2 }]} numberOfLines={1}>
            {why}
          </Text>
        </View>
        <Text style={[styles.chevron, { color: c.text3 }, open && styles.chevronOpen]}>›</Text>
      </Pressable>

      {/* No See all here: the Routines header right above has one. */}
      {open && match.matched && !match.exact ? (
        <View style={styles.seeAllRow}>
          <Text style={[type.meta, { color: c.text2 }]}>Nothing matches exactly.</Text>
        </View>
      ) : null}

      {open ? (
        <Animated.View entering={FadeIn.duration(200)} {...flattenAlpha} style={styles.body}>
          <RoutineGrid
            programs={programs}
            art={art}
            onOpen={setDetail}
            disabled={disabled || busy}
            // The sub-line names the level whenever the profile has one.
            namedLevel={match.matched ? prefs.level : null}
          />
        </Animated.View>
      ) : null}

      <RoutineDetailSheet
        group={detail}
        onClose={() => setDetail(null)}
        onUse={(g) => void use(g)}
        busy={busy}
      />
    </View>
  );
}

/** The section's header before the routines, the prefs and the count load. */
export function StarterRoutinesSkeleton() {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <SkeletonText variant={type.exerciseName} width="42%" />
        <SkeletonText variant={type.meta} width="58%" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  headerText: { gap: 2, flex: 1 },
  seeAllRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chevron: { fontSize: 24, lineHeight: 26, transform: [{ rotate: '90deg' }] },
  chevronOpen: { transform: [{ rotate: '-90deg' }] },
  body: { gap: spacing.lg },
});
