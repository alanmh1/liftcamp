import { groupPrograms, type TemplateRow } from '@liftcamp/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { RoutineCard } from '@/components/home/routine-card';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

/**
 * System routines grouped by program. Collapsed for existing users, expanded
 * for new ones; the header toggles it either way.
 */
export function StarterRoutines({
  templates,
  defaultOpen,
  busyId,
  onUse,
  onSave,
}: {
  templates: TemplateRow[];
  defaultOpen: boolean;
  busyId: string | null;
  onUse: (t: TemplateRow) => void;
  onSave: (t: TemplateRow) => void;
}) {
  const c = useColors();
  const [open, setOpen] = useState(defaultOpen);
  const programs = groupPrograms(templates);
  if (programs.length === 0) return null;

  return (
    <Animated.View layout={LinearTransition.duration(200)} style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[type.exerciseName, { color: c.text }]}>Starter routines</Text>
          <Text style={[type.meta, { color: c.text2 }]}>
            {programs.length} proven {programs.length === 1 ? 'program' : 'programs'}
          </Text>
        </View>
        <Text style={[styles.chevron, { color: c.text3 }, open && styles.chevronOpen]}>›</Text>
      </Pressable>

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
  headerText: { gap: 2 },
  chevron: { fontSize: 24, lineHeight: 26, transform: [{ rotate: '90deg' }] },
  chevronOpen: { transform: [{ rotate: '-90deg' }] },
  body: { gap: spacing.lg },
  program: { gap: spacing.sm },
});
