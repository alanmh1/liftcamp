import {
  canonMuscleList,
  exerciseRecords,
  formatEquipmentLabel,
  isRepBased,
  masksForMuscles,
  metricValue,
  muscleLabel,
  parseSteps,
  type ExerciseRecords,
  type ExerciseSession,
  type ProgressMetric,
} from '@liftcamp/shared';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { useAuth } from '@/components/auth-provider';
import { BodyDiagram } from '@/components/body-diagram';
import { EquipmentIcon } from '@/components/equipment-icon';
import { ExerciseHero, ExerciseThumb } from '@/components/exercise-media';
import { ExerciseSteps } from '@/components/exercise-steps';
import { Paragraphs } from '@/components/exercises/paragraphs';
import { ProgressChart, type ChartPoint } from '@/components/exercises/progress-chart';
import { Segmented } from '@/components/exercises/segmented';
import { SetTable } from '@/components/history/set-table';
import { Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { getExerciseProgress, getExerciseSessions, type SessionDetail } from '@/data/exercise-progress';
import { getBeginnerNotes, type BeginnerNotes } from '@/data/exercises';
import { getPrSetIds } from '@/data/history';
import { exercisesByIds } from '@/data/home';
import { getBodyweight, getExercise, type ExerciseInfo } from '@/data/workouts';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, listSurface, radius, spacing, type } from '@/theme/tokens';

type Segment = 'summary' | 'history' | 'howto';
type Range = '3m' | '1y' | 'all';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'history', label: 'History' },
  { key: 'howto', label: 'How to' },
];

const RANGES: { key: Range; label: string }[] = [
  { key: '3m', label: '3 months' },
  { key: '1y', label: '1 year' },
  { key: 'all', label: 'All' },
];

const LOAD_METRICS: { key: ProgressMetric; label: string }[] = [
  { key: 'estimatedMax', label: 'Estimated max' },
  { key: 'heaviest', label: 'Heaviest weight' },
  { key: 'volume', label: 'Session volume' },
];
const REP_METRICS: { key: ProgressMetric; label: string }[] = [
  { key: 'mostReps', label: 'Most reps' },
  { key: 'totalReps', label: 'Total reps' },
];

const EMPTY_COPY = 'Log this exercise to see your progress here.';
const SESSION_PAGE = 20;

/** The first date inside the range, as YYYY-MM-DD, or null for all time. */
function rangeStart(range: Range): string | null {
  if (range === 'all') return null;
  const d = new Date();
  if (range === '3m') d.setMonth(d.getMonth() - 3);
  else d.setFullYear(d.getFullYear() - 1);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Tue, 9 Sep" for a session card. */
function cardDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

type Loaded = {
  exercise: ExerciseInfo;
  bodyweight: number | null;
  /** Null when the scan was abandoned past its cap. */
  sessions: ExerciseSession[] | null;
  repBased: boolean;
  records: ExerciseRecords | null;
  prSetIds: Set<string> | null;
  notes: BeginnerNotes | null;
  substitutes: ExerciseInfo[];
};

/**
 * One exercise: what it is and how the user is doing at it. Three
 * segments under a native header. Summary is the hero, the diagrams, the
 * progress chart and the records; History is every finished session with
 * its sets; How to is the beginner notes and the steps. The screen is one
 * FlatList so the History segment can page without a list inside a scroll
 * view: the header holds the segmented control and, for Summary and How
 * to, the whole body.
 */
export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const { scheme, colors: c } = useTheme();
  const { label: unit } = useWeightUnit();
  const { width } = useWindowDimensions();
  const userId = session?.user.id;

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [segment, setSegment] = useState<Segment>('summary');
  const [metric, setMetric] = useState<ProgressMetric | null>(null);
  const [range, setRange] = useState<Range>('3m');
  const maxInfoRef = useRef<SheetRef>(null);

  // History paging, by finished_at cursor, the same 20-at-a-time as the tab.
  const [history, setHistory] = useState<SessionDetail[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!userId || !id) return;
    let cancelled = false;
    (async () => {
      const [exercise, bodyweight] = await Promise.all([getExercise(id), getBodyweight(userId)]);
      if (cancelled) return;
      if (!exercise) {
        router.back();
        return;
      }
      const [progress, prSetIds, notes] = await Promise.all([
        getExerciseProgress(userId, id, exercise, bodyweight),
        getPrSetIds(userId, bodyweight),
        getBeginnerNotes(id),
      ]);
      if (cancelled) return;
      const substitutes = notes && notes.substitute_exercise_ids.length > 0
        ? [...(await exercisesByIds(notes.substitute_exercise_ids)).values()]
        : [];
      if (cancelled) return;
      const allSets = progress ? progress.details.flatMap((d) => d.sets) : [];
      const repBased = isRepBased(exercise, bodyweight, allSets);
      setLoaded({
        exercise,
        bodyweight,
        sessions: progress?.sessions ?? null,
        repBased,
        records: progress ? exerciseRecords(progress.sessions) : null,
        prSetIds,
        notes,
        substitutes,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, id, router]);

  // The first history page loads when the segment is first opened.
  useEffect(() => {
    if (segment !== 'history' || history != null || !userId || !id || inFlight.current) return;
    inFlight.current = true;
    getExerciseSessions(userId, id, { limit: SESSION_PAGE }).then((page) => {
      setHistory(page.sessions);
      setHasMore(page.hasMore);
      inFlight.current = false;
    });
  }, [segment, history, userId, id]);

  async function loadMore() {
    if (!userId || !id || !history || !hasMore || inFlight.current) return;
    inFlight.current = true;
    const last = history[history.length - 1];
    const page = await getExerciseSessions(userId, id, { limit: SESSION_PAGE, before: last?.finishedAt ?? null });
    const seen = new Set(history.map((h) => h.workoutId));
    setHistory([...history, ...page.sessions.filter((s) => !seen.has(s.workoutId))]);
    setHasMore(page.hasMore);
    inFlight.current = false;
  }

  const metrics = loaded?.repBased ? REP_METRICS : LOAD_METRICS;
  const activeMetric: ProgressMetric = metric && metrics.some((m) => m.key === metric) ? metric : metrics[0].key;
  const loadMetric = activeMetric === 'estimatedMax' || activeMetric === 'heaviest' || activeMetric === 'volume';
  const formatValue = (v: number) => (loadMetric ? `${Math.round(v).toLocaleString()} ${unit}` : String(Math.round(v)));

  const points = useMemo<ChartPoint[]>(() => {
    if (!loaded?.sessions) return [];
    const start = rangeStart(range);
    return loaded.sessions
      .filter((s) => !start || s.workoutDate >= start)
      .map((s) => ({ date: s.workoutDate, workoutId: s.workoutId, value: metricValue(s.summary, activeMetric) }))
      .filter((p): p is ChartPoint => p.value != null)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [loaded, range, activeMetric]);

  function openWorkout(workoutId: string) {
    router.push({ pathname: '/exercises/workout/[id]', params: { id: workoutId } });
  }

  if (!loaded) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: c.bg }]}>
        <Stack.Screen options={{ title: '' }} />
        <ActivityIndicator />
      </View>
    );
  }

  const { exercise, records, repBased, notes } = loaded;
  const heroSize = Math.min(width - spacing.screen * 2, 360);
  const muscles = [
    ...(exercise.primary_muscle ? [muscleLabel(exercise.primary_muscle)] : []),
    ...canonMuscleList(exercise.secondary_muscles).map(muscleLabel),
  ].filter((m, i, all) => m && all.indexOf(m) === i);
  const bodyData = [
    { name: 'primary', muscles: masksForMuscles(exercise.primary_muscle), frequency: 2 },
    { name: 'secondary', muscles: masksForMuscles(exercise.secondary_muscles), frequency: 1 },
  ].filter((e) => e.muscles.length > 0);
  const steps = parseSteps(exercise.description);
  const best = records?.estimatedMax;

  const summary = (
    <View style={styles.section}>
      <View style={styles.heroWrap}>
        <ExerciseHero exercise={exercise} size={heroSize} />
      </View>
      <Text style={[type.screenTitle, { color: c.text }]}>{exercise.name}</Text>
      <View style={styles.bodies}>
        <View style={styles.figure}>
          <BodyDiagram type="anterior" data={bodyData} />
        </View>
        <View style={styles.figure}>
          <BodyDiagram type="posterior" data={bodyData} />
        </View>
      </View>
      {muscles.length > 0 ? (
        <View style={styles.row}>
          <Text style={[type.label, { color: c.text3 }]}>Muscles</Text>
          <Text style={[type.meta, { color: c.text, fontSize: 15 }]}>{muscles.join(', ')}</Text>
        </View>
      ) : null}
      {exercise.equipment ? (
        <View style={styles.row}>
          <Text style={[type.label, { color: c.text3 }]}>Equipment</Text>
          <View style={styles.equipment}>
            <EquipmentIcon equipment={exercise.equipment} size={18} color={c.text2} />
            <Text style={[type.meta, { color: c.text, fontSize: 15 }]}>{formatEquipmentLabel(exercise.equipment)}</Text>
          </View>
        </View>
      ) : null}

      <View style={[styles.card, cardSurface(scheme, c)]}>
        <Text style={[type.label, { color: c.text3 }]}>Progress</Text>
        <View style={styles.chipRow}>
          {metrics.map((m) => (
            <SmallChip key={m.key} label={m.label} selected={m.key === activeMetric} onPress={() => setMetric(m.key)} />
          ))}
        </View>
        {points.length > 0 ? (
          <ProgressChart points={points} format={formatValue} />
        ) : (
          <Text style={[type.meta, styles.empty, { color: c.text2 }]}>
            {loaded.sessions && loaded.sessions.length > 0 ? 'Nothing in this range yet.' : EMPTY_COPY}
          </Text>
        )}
        <View style={styles.chipRow}>
          {RANGES.map((r) => (
            <SmallChip key={r.key} label={r.label} selected={r.key === range} onPress={() => setRange(r.key)} />
          ))}
        </View>
      </View>

      <View style={[styles.card, cardSurface(scheme, c)]}>
        <Text style={[type.label, { color: c.text3 }]}>Records</Text>
        {!records || (!records.estimatedMax && !records.mostRepsSet) ? (
          <Text style={[type.meta, { color: c.text2 }]}>{EMPTY_COPY}</Text>
        ) : repBased ? (
          <>
            <RecordRow label="Most reps in a set" value={records.mostRepsSet ? String(records.mostRepsSet.value) : null} onPress={records.mostRepsSet ? () => openWorkout(records.mostRepsSet!.workoutId) : undefined} />
            <RecordRow label="Most reps in a session" value={records.mostRepsSession ? String(records.mostRepsSession.value) : null} onPress={records.mostRepsSession ? () => openWorkout(records.mostRepsSession!.workoutId) : undefined} />
          </>
        ) : (
          <>
            <RecordRow
              label="Estimated max"
              value={best ? formatValue(best.value) : null}
              onPress={best ? () => openWorkout(best.workoutId) : undefined}
              onInfo={() => maxInfoRef.current?.present()}
            />
            <RecordRow
              label="Best set"
              value={best ? `${best.bestSet.load} × ${best.bestSet.reps}` : null}
              onPress={best ? () => openWorkout(best.workoutId) : undefined}
            />
            <RecordRow
              label="Heaviest weight"
              value={records.heaviest ? formatValue(records.heaviest.value) : null}
              onPress={records.heaviest ? () => openWorkout(records.heaviest!.workoutId) : undefined}
            />
            <RecordRow
              label="Most volume in a session"
              value={records.mostVolume ? `${Math.round(records.mostVolume.value).toLocaleString()} ${unit}` : null}
              onPress={records.mostVolume ? () => openWorkout(records.mostVolume!.workoutId) : undefined}
            />
          </>
        )}
      </View>
      {/* Strength level section goes here in a later session. */}
    </View>
  );

  const howTo = (
    <View style={styles.section}>
      {notes ? (
        <>
          <NoteSection title="Starting weight" body={notes.starting_weight_md} />
          <NoteSection title="Form breakdown" body={notes.form_breakdown_md} />
          <NoteSection title={notes.substitution_heading?.trim() || 'Swap it out'} body={notes.substitution_md}>
            {loaded.substitutes.map((sub) => (
              <Pressable
                key={sub.id}
                onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: sub.id } })}
                accessibilityRole="button"
                style={({ pressed }) => [styles.subRow, listSurface(scheme, c), pressed && styles.pressed]}>
                <ExerciseThumb exercise={sub} size={40} />
                <Text style={[type.exerciseName, styles.subName, { color: c.text }]} numberOfLines={2}>
                  {sub.name}
                </Text>
                <Text style={[styles.chevron, { color: c.text3 }]}>›</Text>
              </Pressable>
            ))}
          </NoteSection>
        </>
      ) : null}
      {steps.length > 0 ? (
        <View style={styles.row}>
          <Text style={[type.label, { color: c.text3 }]}>How to do it</Text>
          <ExerciseSteps steps={steps} />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ title: exercise.name }} />
      <FlatList
        data={segment === 'history' ? (history ?? []) : []}
        keyExtractor={(s) => s.workoutId}
        renderItem={({ item }) => (
          <View style={[styles.card, styles.sessionCard, cardSurface(scheme, c)]}>
            <View style={styles.sessionHead}>
              <View style={styles.sessionText}>
                <Text style={[type.exerciseName, { color: c.text }]} numberOfLines={1}>
                  {item.workoutName?.trim() || 'Workout'}
                </Text>
                <Text style={[type.meta, { color: c.text2 }]}>{cardDate(item.workoutDate)}</Text>
              </View>
              <Pressable
                onPress={() => openWorkout(item.workoutId)}
                accessibilityRole="button"
                accessibilityLabel="Open workout"
                hitSlop={10}
                style={({ pressed }) => pressed && styles.pressed}>
                <SymbolView
                  name="chevron.right"
                  size={18}
                  tintColor={c.text3}
                  fallback={<Text style={[styles.chevron, { color: c.text3 }]}>›</Text>}
                />
              </Pressable>
            </View>
            <SetTable
              sets={item.sets.map((s) => ({ ...s, completed: true }))}
              weightType={exercise.weight_type}
              unit={unit}
              prSetIds={loaded.prSetIds}
              repsOnly={repBased}
            />
          </View>
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Segmented segments={SEGMENTS} value={segment} onChange={setSegment} />
            {segment === 'summary' ? summary : segment === 'howto' ? howTo : null}
            {segment === 'history' && history && history.length === 0 ? (
              <Text style={[type.meta, styles.empty, { color: c.text2 }]}>{EMPTY_COPY}</Text>
            ) : null}
          </View>
        }
        ListFooterComponent={
          segment === 'history' && (history == null || hasMore) ? <ActivityIndicator style={styles.footer} /> : <View style={styles.footer} />
        }
        ItemSeparatorComponent={Separator}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.5}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <Sheet ref={maxInfoRef}>
        <Text style={[type.exerciseName, { color: c.text }]}>Estimated max</Text>
        <Text style={[type.meta, styles.sheetBody, { color: c.text }]}>
          The most you could likely lift for one rep, worked out from your best set. It uses your
          weight and reps together, so a set of 10 can beat a heavier set of 3.
        </Text>
        {best ? (
          <Text style={[type.restTime, styles.sheetBest, { color: c.text2 }]}>
            {best.bestSet.load} {unit} × {best.bestSet.reps} → {formatValue(best.value)}
          </Text>
        ) : null}
      </Sheet>
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function SmallChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const c = useTheme().colors;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.smallChip,
        selected ? { backgroundColor: c.accentSoft } : { backgroundColor: c.surface2 },
        pressed && styles.pressed,
      ]}>
      <Text style={[type.button, { fontSize: 13, color: selected ? c.accentText : c.text2 }]}>{label}</Text>
    </Pressable>
  );
}

/** A record: the label, and the value as a link to the workout it came from. */
function RecordRow({
  label,
  value,
  onPress,
  onInfo,
}: {
  label: string;
  value: string | null;
  onPress?: () => void;
  onInfo?: () => void;
}) {
  const c = useTheme().colors;
  return (
    <View style={styles.record}>
      <View style={styles.recordLabel}>
        <Text style={[type.meta, { color: c.text2, fontSize: 15 }]}>{label}</Text>
        {onInfo ? (
          <Pressable onPress={onInfo} hitSlop={10} accessibilityRole="button" accessibilityLabel="About estimated max">
            <SymbolView
              name="info.circle"
              size={16}
              tintColor={c.text3}
              fallback={<Text style={[type.meta, { color: c.text3 }]}>ⓘ</Text>}
            />
          </Pressable>
        ) : null}
      </View>
      {value && onPress ? (
        <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
          <Text style={[type.restTime, { color: c.accentText }]}>{value}</Text>
        </Pressable>
      ) : (
        <Text style={[type.restTime, { color: c.text3 }]}>{value ?? 'None'}</Text>
      )}
    </View>
  );
}

function NoteSection({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  const c = useTheme().colors;
  return (
    <View style={styles.row}>
      <Text style={[type.label, { color: c.text3 }]}>{title}</Text>
      <Paragraphs text={body} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xl },
  header: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  section: { gap: spacing.md },
  heroWrap: { alignItems: 'center' },
  bodies: { flexDirection: 'row', gap: spacing.md, alignSelf: 'center', width: 260 },
  figure: { flex: 1 },
  row: { gap: 4 },
  equipment: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  card: { borderRadius: radius.card, padding: spacing.card, gap: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  smallChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.pill },
  empty: { textAlign: 'center', paddingVertical: spacing.lg },
  record: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  recordLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.bar,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  subName: { flex: 1 },
  chevron: { fontSize: 22, lineHeight: 24 },
  sessionCard: { gap: spacing.sm },
  sessionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sessionText: { flex: 1, gap: 2 },
  separator: { height: spacing.md },
  footer: { paddingVertical: spacing.lg },
  sheetBody: { fontSize: 15, lineHeight: 22, paddingTop: spacing.sm },
  sheetBest: { paddingTop: spacing.md },
  pressed: { opacity: 0.7 },
});
