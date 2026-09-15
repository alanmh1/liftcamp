import { formatSetTarget, type ProgramGroup } from '@liftcamp/shared';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BusyLabel } from '@/components/busy-label';
import { ExerciseThumb } from '@/components/exercise-media';
import { EQUIPMENT_ART, LEVEL_ART } from '@/components/home/pref-tiles';
import { programFacts } from '@/components/home/routine-grid';
import { Text } from '@/components/text';
import { exercisesByIds } from '@/data/home';
import type { ExerciseInfo } from '@/data/workouts';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/**
 * A routine, in full, as a page sheet: name, blurb, a metadata row (level
 * and equipment illustrations with labels, variation count), then every
 * variation with its exercises (thumbnail, name, target), and one primary
 * button, "Use routine", which saves every variation as the user's own.
 * The caller decides what happens after that: onboarding completes and
 * lands on Home, the routines list stays put.
 *
 * Onboarding and the routines list both present this, so it is the one
 * routine detail. A page sheet rather than a route because both hosts hold
 * the group in memory already and the sheet's own swipe-down is the way
 * back. The sheet provides its own safe-area context, like the sign-in
 * screen, since insets inside an RN Modal are not the host's.
 */
export function RoutineDetailSheet({
  group,
  onClose,
  onUse,
  busy,
}: {
  group: ProgramGroup | null;
  onClose: () => void;
  onUse: (group: ProgramGroup) => void;
  busy: boolean;
}) {
  return (
    <Modal
      visible={group != null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaProvider>
        {group ? <RoutineDetail group={group} onClose={onClose} onUse={onUse} busy={busy} /> : null}
      </SafeAreaProvider>
    </Modal>
  );
}

function RoutineDetail({
  group,
  onClose,
  onUse,
  busy,
}: {
  group: ProgramGroup;
  onClose: () => void;
  onUse: (group: ProgramGroup) => void;
  busy: boolean;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { level, equipment, levelLabel } = programFacts(group);
  const [exercises, setExercises] = useState<Map<string, ExerciseInfo>>(new Map());

  // One query for every exercise across the variations.
  useEffect(() => {
    const ids = [...new Set(group.templates.flatMap((t) => t.template_exercises.map((te) => te.exercise_id)))];
    let live = true;
    exercisesByIds(ids).then((m) => {
      if (live) setExercises(m);
    });
    return () => {
      live = false;
    };
  }, [group]);

  const n = group.templates.length;
  const equipmentLabel = equipment
    ? { gym: 'Gym', dumbbells: 'Dumbbells', bodyweight: 'Bodyweight', bands: 'Bands' }[equipment]
    : null;

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Text style={[type.button, { color: c.accentText }]}>Close</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[type.screenTitle, { color: c.text }]}>{group.program}</Text>
        {group.blurb ? (
          <Text style={[type.meta, styles.blurb, { color: c.text2 }]}>{group.blurb}</Text>
        ) : null}

        <View style={styles.metaRow}>
          {level ? (
            <View style={styles.metaItem}>
              <Image source={LEVEL_ART[level]} style={styles.metaArt} resizeMode="contain" />
              <Text style={[type.meta, { color: c.text }]}>{levelLabel}</Text>
            </View>
          ) : null}
          {equipment ? (
            <View style={styles.metaItem}>
              <Image source={EQUIPMENT_ART[equipment]} style={styles.metaArt} resizeMode="contain" />
              <Text style={[type.meta, { color: c.text }]}>{equipmentLabel}</Text>
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <Text style={[type.setNumeral, styles.metaCount, { color: c.text }]}>{n}</Text>
            <Text style={[type.meta, { color: c.text }]}>{n === 1 ? 'variation' : 'variations'}</Text>
          </View>
        </View>

        {group.templates.map((t) => {
          const ordered = [...t.template_exercises].sort((a, b) => a.position - b.position);
          return (
            <View key={t.id} style={styles.variation}>
              <Text style={[type.exerciseName, { color: c.text }]}>{t.name}</Text>
              <View style={[styles.list, { borderColor: c.border }]}>
                {ordered.map((te, i) => {
                  const ex = exercises.get(te.exercise_id);
                  const target = formatSetTarget({ sets: te.target_sets ?? null, reps: te.target_reps ?? null });
                  return (
                    <View
                      key={`${te.exercise_id}-${i}`}
                      style={[styles.exercise, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.border }]}>
                      {ex ? (
                        <ExerciseThumb exercise={ex} size={40} />
                      ) : (
                        <View style={[styles.thumbHold, { backgroundColor: c.surface2 }]} />
                      )}
                      <Text style={[type.meta, styles.exerciseName, { color: c.text, fontSize: 15 }]} numberOfLines={2}>
                        {ex?.name ?? ' '}
                      </Text>
                      {target ? (
                        <Text style={[type.prevNumeral, { color: c.text2 }]}>{target}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg), borderColor: c.border }]}>
        <Pressable
          onPress={() => onUse(group)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ busy }}
          style={({ pressed }) => [styles.button, { backgroundColor: c.accent }, pressed && styles.pressed]}>
          <BusyLabel label="Use routine" busy={busy} color="#FFFFFF" fontSize={17} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.sm,
  },
  content: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xl, gap: spacing.lg },
  blurb: { fontSize: 15, lineHeight: 22, marginTop: -spacing.sm },
  metaRow: { flexDirection: 'row', gap: spacing.md },
  metaItem: { flex: 1, alignItems: 'center', gap: spacing.xs },
  metaArt: { width: 56, height: 56 },
  metaCount: { height: 56, lineHeight: 56, fontSize: 28 },
  variation: { gap: spacing.sm },
  list: { borderWidth: 1, borderRadius: radius.bar, overflow: 'hidden' },
  exercise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 56,
  },
  thumbHold: { width: 40, height: 40, borderRadius: 8 },
  exerciseName: { flex: 1 },
  footer: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  button: { borderRadius: radius.bar, paddingVertical: spacing.lg, alignItems: 'center' },
  pressed: { opacity: 0.7 },
});
