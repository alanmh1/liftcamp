import {
  formatSetTarget,
  lastDoneDetailLine,
  routineExerciseLine,
  routineMuscleSummary,
  type ProgramGroup,
  type RoutineLastDone,
  type TemplateRow,
  type WeightUnit,
} from '@liftcamp/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
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
 * A routine, in full. Two bodies share the exercise list:
 *
 * - `ProgramDetail`, a starter routine: blurb, a metadata row (level and
 *   equipment illustrations and the workout count, each over a label),
 *   then every variation with its exercises, and "Use routine", which
 *   saves every variation as the user's own.
 * - `SavedRoutineDetail`, one of the user's saved days: the muscles it
 *   trains, its exercise count and when it was last done, Start, then its
 *   exercises with last time's top weight.
 *
 * Both draw inside the pushed routine screen (app/(tabs)/train/routine
 * and its Home twin). Onboarding still presents a starter as a page sheet,
 * `RoutineDetailSheet`, since it sits outside the tabs and holds the group
 * in memory. The sheet provides its own safe-area context, like the
 * sign-in screen, since insets inside an RN Modal are not the host's.
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
        {group ? <SheetBody group={group} onClose={onClose} onUse={onUse} busy={busy} /> : null}
      </SafeAreaProvider>
    </Modal>
  );
}

function SheetBody({
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
  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Text style={[type.button, { color: c.accentText }]}>Close</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
        <Text style={[type.screenTitle, { color: c.text }]}>{group.program}</Text>
        <ProgramDetail group={group} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg), borderColor: c.border }]}>
        <RoutineActions>
          <PrimaryAction label="Use routine" onPress={() => onUse(group)} busy={busy} />
        </RoutineActions>
      </View>
    </View>
  );
}

/**
 * The action row: one full-width accent button. A row, so Edit can sit
 * beside Start when the routine editor ships.
 */
export function RoutineActions({ children }: { children: ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

export function PrimaryAction({
  label,
  onPress,
  busy,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  busy: boolean;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy || disabled }}
      style={({ pressed }) => [styles.button, { backgroundColor: c.accent }, pressed && styles.pressed]}>
      <BusyLabel label={label} busy={busy} color="#FFFFFF" fontSize={17} />
    </Pressable>
  );
}

/**
 * A starter routine's body, under its title: blurb, the metadata row,
 * `action` (Use routine on the pushed screen), then every variation.
 */
export function ProgramDetail({
  group,
  action,
  onOpenExercise,
}: {
  group: ProgramGroup;
  action?: ReactNode;
  /** Pushes the exercise screen. Rows carry chevrons when given. */
  onOpenExercise?: (exerciseId: string) => void;
}) {
  const c = useColors();
  const { level, equipment, levelLabel } = programFacts(group);
  const exercises = useRoutineExercises(group.templates);
  const n = group.templates.length;
  const equipmentLabel = equipment
    ? { gym: 'Gym', dumbbells: 'Dumbbells', bodyweight: 'Bodyweight', bands: 'Bands' }[equipment]
    : null;

  return (
    <>
      {group.blurb ? <Text style={[type.meta, styles.blurb, { color: c.text2 }]}>{group.blurb}</Text> : null}

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

      {action}

      {group.templates.map((t) => (
        <View key={t.id} style={styles.variation}>
          <Text style={[type.exerciseName, { color: c.text }]}>{t.name}</Text>
          <ExerciseList
            template={t}
            exercises={exercises}
            line={(te) => formatSetTarget({ sets: te.target_sets ?? null, reps: te.target_reps ?? null })}
            onOpen={onOpenExercise}
          />
        </View>
      ))}
    </>
  );
}

/**
 * One saved day's body, under the screen's title: the muscles it trains
 * and its exercise count, when it was last done (date, duration, volume),
 * `action` (Start), then its exercises with last time's top weight. While
 * `last` is undefined the last-done line and the weights wait.
 */
export function SavedRoutineDetail({
  template,
  last,
  unit,
  unitLabel,
  action,
  onOpenExercise,
}: {
  template: TemplateRow;
  /** Undefined while it is read; null when the day has not been done. */
  last: RoutineLastDone | null | undefined;
  unit: WeightUnit;
  unitLabel: string;
  action: ReactNode;
  onOpenExercise?: (exerciseId: string) => void;
}) {
  const c = useColors();
  const exercises = useRoutineExercises([template]);
  const n = template.template_exercises.length;
  const summary = [routineMuscleSummary(template), `${n} ${n === 1 ? 'exercise' : 'exercises'}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <View style={styles.savedMeta}>
        <Text style={[type.meta, styles.savedLine, { color: c.text2 }]}>{summary}</Text>
        <Reveal ready={last !== undefined} skeleton={<SkeletonText variant={styles.savedLine} width="72%" />}>
          <Text style={[type.meta, styles.savedLine, { color: c.text2 }]}>
            {lastDoneDetailLine(last ?? null, unitLabel)}
          </Text>
        </Reveal>
      </View>

      {action}

      <ExerciseList
        template={template}
        exercises={exercises}
        line={(te) =>
          routineExerciseLine(
            { sets: te.target_sets ?? null, reps: te.target_reps ?? null },
            last?.topWeights.get(te.exercise_id),
            unit,
            unitLabel,
          )
        }
        onOpen={onOpenExercise}
      />
    </>
  );
}

type TemplateExercise = TemplateRow['template_exercises'][number];

/**
 * The exercises of these templates, by id. The routine selects join each
 * exercise's start fields (name and media among them), so this is usually
 * ready at once; an exercise the join did not carry is read by id. Null
 * while that read runs, and the rows show skeleton names and thumbnails.
 */
function useRoutineExercises(templates: TemplateRow[]): Map<string, ExerciseInfo> | null {
  const [read, setRead] = useState<{ key: string; map: Map<string, ExerciseInfo> } | null>(null);
  const joined = new Map<string, ExerciseInfo>();
  const missing = new Set<string>();
  for (const t of templates) {
    for (const te of t.template_exercises) {
      // TEMPLATE_FIELDS joins START_EXERCISE_FIELDS.
      const ex = te.exercises as ExerciseInfo | null | undefined;
      if (ex?.name) joined.set(te.exercise_id, ex);
      else missing.add(te.exercise_id);
    }
  }
  const key = [...missing].sort().join(',');

  useEffect(() => {
    if (!key) return;
    let live = true;
    exercisesByIds(key.split(',')).then((map) => {
      if (live) setRead({ key, map });
    });
    return () => {
      live = false;
    };
  }, [key]);

  if (!key) return joined;
  if (read?.key !== key) return null;
  for (const [id, ex] of read.map) joined.set(id, ex);
  return joined;
}

/** A template's exercises in order: thumbnail, name, and `line` under it. */
function ExerciseList({
  template,
  exercises,
  line,
  onOpen,
}: {
  template: TemplateRow;
  exercises: Map<string, ExerciseInfo> | null;
  line: (te: TemplateExercise) => string | null;
  onOpen?: (exerciseId: string) => void;
}) {
  const c = useColors();
  const ordered = [...template.template_exercises].sort((a, b) => a.position - b.position);
  return (
    <View style={[styles.list, { borderColor: c.border }]}>
      {ordered.map((te, i) => {
        const ex = exercises?.get(te.exercise_id);
        const text = line(te);
        return (
          <Pressable
            key={`${te.exercise_id}-${i}`}
            onPress={onOpen ? () => onOpen(te.exercise_id) : undefined}
            disabled={!onOpen}
            accessibilityRole={onOpen ? 'button' : undefined}
            style={({ pressed }) => [
              styles.exercise,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.border },
              pressed && { backgroundColor: c.surface2 },
            ]}>
            <Reveal ready={exercises != null} skeleton={<Skeleton width={40} height={40} radius={8} />}>
              {ex ? (
                <ExerciseThumb exercise={ex} size={40} />
              ) : (
                <View style={[styles.thumbHold, { backgroundColor: c.surface2 }]} />
              )}
            </Reveal>
            <View style={styles.exerciseText}>
              <Reveal
                ready={exercises != null}
                skeleton={<SkeletonText variant={NAME_TEXT} width={SKELETON_NAMES[i % SKELETON_NAMES.length]} />}>
                <Text style={[type.meta, { color: c.text, fontSize: NAME_TEXT.fontSize }]} numberOfLines={2}>
                  {ex?.name ?? ' '}
                </Text>
              </Reveal>
              {text ? <Text style={[type.prevNumeral, { color: c.text2 }]}>{text}</Text> : null}
            </View>
            {onOpen ? (
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right' }}
                size={12}
                weight="semibold"
                tintColor={c.text3}
                fallback={<Text style={[styles.chevron, { color: c.text3 }]}>›</Text>}
              />
            ) : null}
          </Pressable>
        );
      })}
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
  sheetContent: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xl, gap: spacing.lg },
  blurb: { fontSize: 15, lineHeight: 22, marginTop: -spacing.sm },
  metaRow: { flexDirection: 'row', gap: spacing.md },
  metaItem: { flex: 1, alignItems: 'center', gap: spacing.xs },
  metaArt: { width: 56, height: 56 },
  // The icons' box, with the number centred in it.
  metaCountBox: { alignItems: 'center', justifyContent: 'center' },
  // 70% of the 56 pt box. Outfit Bold's digits are 0.7 em tall, so about
  // 27 pt of ink. It does not grow with Dynamic Type, like the icons, so it
  // stays inside the box. Outfit's line box has more room below the
  // baseline than above the digits, so they sit about 0.65 pt low; half a
  // point up centres 1, 2 and 6 within 0.4 pt.
  metaCount: { fontSize: 39, fontWeight: '700', ...tabular, transform: [{ translateY: -0.5 }] },
  savedMeta: { gap: 2 },
  savedLine: { fontSize: 15, lineHeight: 21, ...tabular },
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
  exerciseText: { flex: 1, gap: 2 },
  chevron: { fontSize: 18, lineHeight: 20 },
  footer: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actions: { flexDirection: 'row', gap: spacing.md },
  button: { flex: 1, borderRadius: radius.bar, paddingVertical: spacing.lg, alignItems: 'center' },
  pressed: { opacity: 0.7 },
});
