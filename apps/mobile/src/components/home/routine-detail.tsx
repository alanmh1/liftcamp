import { formatSetTarget, type ProgramGroup } from '@liftcamp/shared';
import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BusyLabel } from '@/components/busy-label';
import { ExerciseThumb } from '@/components/exercise-media';
import { EQUIPMENT_ART, LEVEL_ART } from '@/components/home/pref-tiles';
import { programFacts } from '@/components/home/routine-grid';
import { Reveal, Skeleton, SkeletonText } from '@/components/skeleton';
import { Text } from '@/components/text';
import { exercisesByIds } from '@/data/home';
import type { ExerciseInfo } from '@/data/workouts';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, tabular, type } from '@/theme/tokens';

/**
 * A routine, in full, as a page sheet: name, blurb, a metadata row (level
 * and equipment illustrations and the workout count, each over a label),
 * then every variation with its exercises (thumbnail, name, target), and
 * one primary button, "Use routine", which saves every variation as the
 * user's own. The caller decides what happens after that: onboarding
 * completes and lands on Home, the routines list stays put.
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
  // Null until the exercises are read, while the rows show skeleton names
  // and thumbnails.
  const [exercises, setExercises] = useState<Map<string, ExerciseInfo> | null>(null);

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
              <Image source={LEVEL_ART[level]} style={styles.metaArt} contentFit="contain" cachePolicy="memory-disk" transition={150} />
              <Text style={[type.meta, { color: c.text }]}>{levelLabel}</Text>
            </View>
          ) : null}
          {equipment ? (
            <View style={styles.metaItem}>
              <Image source={EQUIPMENT_ART[equipment]} style={styles.metaArt} contentFit="contain" cachePolicy="memory-disk" transition={150} />
              <Text style={[type.meta, { color: c.text }]}>{equipmentLabel}</Text>
            </View>
          ) : null}
          {/* The count of different workouts the routine rotates through
              (Full Body 3x/week has 2), not days a week. Built like the
              other two: the number in a box the icons' size, centred in it,
              then the label on the same line as theirs. */}
          <View style={styles.metaItem} accessible accessibilityLabel={`${n} ${n === 1 ? 'workout' : 'workouts'}`}>
            <View style={[styles.metaArt, styles.metaCountBox]}>
              <Text maxFontSizeMultiplier={1} style={[styles.metaCount, { color: c.text }]}>
                {n}
              </Text>
            </View>
            <Text style={[type.meta, { color: c.text }]}>{n === 1 ? 'Workout' : 'Workouts'}</Text>
          </View>
        </View>

        {group.templates.map((t) => {
          const ordered = [...t.template_exercises].sort((a, b) => a.position - b.position);
          return (
            <View key={t.id} style={styles.variation}>
              <Text style={[type.exerciseName, { color: c.text }]}>{t.name}</Text>
              <View style={[styles.list, { borderColor: c.border }]}>
                {ordered.map((te, i) => {
                  const ex = exercises?.get(te.exercise_id);
                  const target = formatSetTarget({ sets: te.target_sets ?? null, reps: te.target_reps ?? null });
                  return (
                    <View
                      key={`${te.exercise_id}-${i}`}
                      style={[styles.exercise, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.border }]}>
                      <Reveal ready={exercises != null} skeleton={<Skeleton width={40} height={40} radius={8} />}>
                        {ex ? (
                          <ExerciseThumb exercise={ex} size={40} />
                        ) : (
                          <View style={[styles.thumbHold, { backgroundColor: c.surface2 }]} />
                        )}
                      </Reveal>
                      <Reveal
                        ready={exercises != null}
                        skeleton={<SkeletonText variant={NAME_TEXT} width={SKELETON_NAMES[i % SKELETON_NAMES.length]} />}
                        style={styles.exerciseName}>
                        <Text style={[type.meta, { color: c.text, fontSize: NAME_TEXT.fontSize }]} numberOfLines={2}>
                          {ex?.name ?? ' '}
                        </Text>
                      </Reveal>
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

/** An exercise row's name: meta at 15pt. */
const NAME_TEXT = { fontSize: 15 };
const SKELETON_NAMES = ['62%', '48%', '70%', '55%'] as const;

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
  // The icons' box, with the number centred in it.
  metaCountBox: { alignItems: 'center', justifyContent: 'center' },
  // Outfit Bold's digits are 0.7 em tall, so 44 pt fills about 31 pt of
  // the 56 pt box. It does not grow with Dynamic Type, like the icons, so
  // it stays inside the box and the labels stay on one line.
  // Outfit's line box has more room below the baseline than above the
  // digits, so they sit about 0.8 pt low; 1 pt up centres 1, 2 and 6
  // within 0.3 pt.
  metaCount: { fontSize: 44, fontWeight: '700', ...tabular, transform: [{ translateY: -1 }] },
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
