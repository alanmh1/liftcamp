import { matchHeading, type ProgramMatch, type TemplateRow } from '@liftcamp/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { RoutineCard } from '@/components/home/routine-card';
import { Text } from '@/components/text';
import type { TrainingPrefs } from '@/data/home';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

/**
 * System routines grouped by program. Collapsed for existing users, expanded
 * for new ones; the header toggles it either way.
 *
 * With a level on the profile the list is the matcher's, and the sub-line
 * says why ("For beginners with dumbbells") with See all opening the full
 * list. With no level it is the unmatched list and the sub-line is the
 * count, which is what every user from before the question sees.
 */
export function StarterRoutines({
  match,
  prefs,
  onSeeAll,
  defaultOpen,
  busyId,
  onUse,
  onSave,
}: {
  match: ProgramMatch & { matched: boolean };
  prefs: TrainingPrefs;
  onSeeAll: () => void;
  defaultOpen: boolean;
  busyId: string | null;
  onUse: (t: TemplateRow) => void;
  onSave: (t: TemplateRow) => void;
}) {
  const c = useColors();
  const [open, setOpen] = useState(defaultOpen);
  const { programs } = match;
  if (programs.length === 0) return null;

  const why =
    match.matched && prefs.level
      ? match.exact
        ? matchHeading(prefs.level, prefs.equipment)
        : `${matchHeading(prefs.level, null)}, any equipment`
      : `${programs.length} proven ${programs.length === 1 ? 'program' : 'programs'}`;

  return (
    <Animated.View layout={LinearTransition.duration(200)} style={styles.wrap}>
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

      {open && match.matched ? (
        <View style={styles.seeAllRow}>
          {!match.exact ? (
            <Text style={[type.meta, { color: c.text2 }]}>Nothing matches exactly.</Text>
          ) : (
            <View />
          )}
          <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="button">
            <Text style={[type.button, { color: c.accentText, fontSize: 14 }]}>See all</Text>
          </Pressable>
        </View>
      ) : null}

      {open ? (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.body}>
          {programs.map((g) => (
            <View key={g.program} style={styles.program}>
              <View>
                <Text style={[type.label, { color: c.text3 }]}>{g.program}</Text>
                {g.blurb ? <Text style={[type.meta, { color: c.text2 }]}>{g.blurb}</Text> : null}
              </View>
              {g.templates.map((t) => (
                <RoutineCard
                  key={t.id}
                  template={t}
                  primaryLabel="Use"
                  onPrimary={() => onUse(t)}
                  secondaryLabel="Save a copy"
                  onSecondary={() => onSave(t)}
                  busy={busyId === t.id}
                  disabled={busyId !== null}
                />
              ))}
            </View>
          ))}
        </Animated.View>
      ) : null}
    </Animated.View>
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
  program: { gap: spacing.sm },
});
