import {
  buildImportPlan,
  dumbbellSample,
  hasDumbbellChoice,
  heaviestSetSample,
  IMPORT_SOURCE_LABEL,
  IMPORT_SOURCES,
  matchExercises,
  parseImportFile,
  type ExerciseMatch,
  type ImportChoice,
  type ImportRow,
  type ImportSource,
  type WeightUnit,
} from '@liftcamp/shared';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import { ListAction, ListGroup, settingsStyles } from '@/components/settings-ui';
import { Segmented } from '@/components/exercises/segmented';
import { Text } from '@/components/text';
import { unitLabel, useWeightUnit } from '@/components/unit-provider';
import { ExercisePicker } from '@/components/workout/exercise-picker';
import { loadImportContext, localDateOf, runImport, type ImportContext } from '@/data/import';
import type { ExerciseInfo } from '@/data/workouts';
import { chooseOption } from '@/lib/action-sheet';
import { EVENTS, track } from '@/lib/analytics';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/**
 * Settings, Import workouts (docs/import-workouts-spec.md,
 * docs/import-strong-hevy-spec.md). Three steps in place: choose a file,
 * review what matched, import. The file's header decides the source,
 * whichever row was tapped. Parsing and matching run on the phone (shared
 * `import/`); the server only sees the finished workouts, 50 a call.
 */

const HELP = [
  'In Fitbod, export your workout data as a CSV and save it to Files.',
  'In Strong, go to Settings, then Export Strong data, and save the file to Files.',
  'In Hevy, go to Profile, Settings, Export & Import Data, then Export Workouts.',
].join('\n\n');

const CSV_TYPES = ['text/csv', 'text/comma-separated-values', 'public.comma-separated-values-text', 'text/plain'];

const NOT_SUPPORTED = "This doesn't look like an export from Fitbod, Strong or Hevy.";
const OFFLINE = "You're offline. Connect to import.";

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** A weight as logged, up to 2 decimals, no trailing zeros. */
function weightText(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

type Dumbbells = 'one' | 'both';

const DUMBBELL_SEGMENTS: { key: Dumbbells; label: string }[] = [
  { key: 'one', label: 'One dumbbell' },
  { key: 'both', label: 'Both together' },
];

const UNIT_SEGMENTS: { key: WeightUnit; label: string }[] = [
  { key: 'lb', label: 'lbs' },
  { key: 'kg', label: 'kg' },
];

function count(n: number): string {
  return n.toLocaleString('en-US');
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${count(n)} ${n === 1 ? one : many}`;
}

/** "2026-10-30" to "October 2026". */
function monthYear(iso: string): string {
  const [y, m] = iso.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

function dateRange(first: string | null, last: string | null): string | null {
  if (!first || !last) return null;
  const a = monthYear(first);
  const b = monthYear(last);
  return a === b ? a : `${a} to ${b}`;
}

/** Unmatched first, then close matches, then the rest under Matched. File order inside each. */
function rank(m: ExerciseMatch): number {
  if (!m.exerciseId) return 0;
  return m.close ? 1 : 2;
}

type Loaded = {
  source: ImportSource;
  /** False only for Strong's iOS file, whose weights carry no unit. */
  unitKnown: boolean;
  rows: ImportRow[];
  matches: ExerciseMatch[];
  ctx: ImportContext;
};

type Run =
  | { kind: 'idle' }
  | { kind: 'running'; sent: number }
  | { kind: 'failed'; sent: number; offline: boolean }
  | { kind: 'done'; inserted: number };

export default function ImportScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { unit: userUnit } = useWeightUnit();

  // The row tapped, for its spinner. The file decides the source.
  const [reading, setReading] = useState<ImportSource | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [choices, setChoices] = useState<Record<string, ImportChoice>>({});
  // Exercises picked in the review that the context's catalog may not hold.
  const [picked, setPicked] = useState<Map<string, ExerciseInfo>>(new Map());
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const [run, setRun] = useState<Run>({ kind: 'idle' });
  // The review questions. The unit starts on the user's own, dumbbells on one.
  const [fileUnit, setFileUnit] = useState<WeightUnit>(userUnit);
  const [dumbbells, setDumbbells] = useState<Dumbbells>('one');

  async function chooseFile(tapped: ImportSource) {
    if (!userId || reading) return;
    setFileError(null);
    let text: string;
    try {
      const pick = await File.pickFileAsync({ mimeTypes: CSV_TYPES });
      if (pick.canceled) return;
      setReading(tapped);
      text = await pick.result.text();
    } catch {
      setReading(null);
      setFileError(NOT_SUPPORTED);
      return;
    }
    const parsed = parseImportFile(text);
    if (!parsed) {
      setReading(null);
      setFileError(NOT_SUPPORTED);
      return;
    }
    const { source } = parsed;
    void track(EVENTS.importStarted, { source });
    const ctx = await loadImportContext(userId, source);
    setReading(null);
    if (!ctx) {
      setFileError(OFFLINE);
      return;
    }
    const matches = matchExercises(
      parsed.rows.map((r) => r.exercise),
      ctx.map,
      ctx.catalog,
    );
    setChoices(Object.fromEntries(matches.map((m) => [m.name, m.exerciseId ?? 'skip'])));
    setPicked(new Map());
    setFileUnit(userUnit);
    setDumbbells('one');
    setLoaded({ source, unitKnown: parsed.unitKnown, rows: parsed.rows, matches, ctx });
  }

  const names = useMemo(() => {
    const out = new Map<string, string>();
    for (const e of loaded?.ctx.catalog ?? []) out.set(e.id, e.name);
    for (const e of picked.values()) out.set(e.id, e.name);
    return out;
  }, [loaded, picked]);

  const catalog = useMemo(() => (loaded ? [...loaded.ctx.catalog, ...picked.values()] : []), [loaded, picked]);

  // Fitbod logs one dumbbell, so it never asks.
  const asksDumbbells = !!loaded && loaded.source !== 'fitbod' && hasDumbbellChoice(choices, catalog);
  const dumbbellsCombined = asksDumbbells && dumbbells === 'both';

  const plan = useMemo(() => {
    if (!loaded) return null;
    return buildImportPlan(loaded.rows, choices, catalog, {
      source: loaded.source,
      existingDates: loaded.ctx.existingDates,
      importedStarts: loaded.ctx.importedStarts,
      localDate: localDateOf,
      unit: loaded.unitKnown ? userUnit : fileUnit,
      dumbbellsCombined,
    });
  }, [loaded, choices, catalog, userUnit, fileUnit, dumbbellsCombined]);

  const unitSample = useMemo(
    () => (loaded && !loaded.unitKnown ? heaviestSetSample(loaded.rows, choices, catalog) : null),
    [loaded, choices, catalog],
  );
  const dumbbellLine = useMemo(() => {
    if (!loaded || !asksDumbbells) return null;
    const sample = dumbbellSample(loaded.rows, choices, catalog);
    if (!sample) return null;
    const u = unitLabel(sample.unit ?? (loaded.unitKnown ? userUnit : fileUnit));
    return `Your ${sample.name} was usually ${weightText(sample.weight)} ${u}`;
  }, [loaded, asksDumbbells, choices, catalog, userUnit, fileUnit]);

  const sorted = useMemo(
    () => (loaded ? [...loaded.matches].sort((a, b) => rank(a) - rank(b)) : []),
    [loaded],
  );

  function openRow(name: string) {
    chooseOption<'choose' | 'skip'>(
      [
        { label: 'Choose exercise', value: 'choose' },
        { label: 'Skip', value: 'skip' },
      ],
      (v) => {
        if (v === 'skip') setChoices((prev) => ({ ...prev, [name]: 'skip' }));
        else setPickingFor(name);
      },
      name,
    );
  }

  function onPicked(exercises: ExerciseInfo[]) {
    const name = pickingFor;
    const ex = exercises[0];
    setPickingFor(null);
    if (!name || !ex) return;
    setPicked((prev) => new Map(prev).set(ex.id, ex));
    setChoices((prev) => ({ ...prev, [name]: ex.id }));
  }

  async function startImport() {
    if (!loaded || !plan || plan.summary.workouts === 0) return;
    if (run.kind === 'running') return;
    setRun({ kind: 'running', sent: 0 });
    const result = await runImport(loaded.source, plan.workouts, (sent) => setRun({ kind: 'running', sent }));
    if (!result.ok) {
      setRun({ kind: 'failed', sent: result.sent, offline: result.offline && result.sent === 0 });
      return;
    }
    void track(EVENTS.importFinished, {
      source: loaded.source,
      workouts: result.inserted,
      sets: plan.summary.sets,
      skipped_exercises: plan.summary.skippedExercises,
      unit_asked: !loaded.unitKnown,
      dumbbells_combined: dumbbellsCombined,
    });
    setRun({ kind: 'done', inserted: result.inserted });
  }

  // Done: one line and the way to History.
  if (run.kind === 'done') {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: c.bg }]}>
        <Text style={[type.exerciseName, { color: c.text }]}>{`${plural(run.inserted, 'workout')} imported`}</Text>
        <Pressable
          onPress={() => router.dismissTo('/profile/history')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, styles.doneButton, { backgroundColor: c.accent }, pressed && settingsStyles.pressed]}>
          <Text style={[type.button, styles.primaryLabel]}>See History</Text>
        </Pressable>
      </View>
    );
  }

  // Step 1, Choose.
  if (!loaded || !plan) {
    return (
      <View style={[styles.fill, { backgroundColor: c.bg }]}>
        <ScrollView contentContainerStyle={styles.content} {...scrollInsetProps}>
          <Text style={[type.meta, styles.line, { color: c.text2 }]}>
            Bring your history from Fitbod, Strong or Hevy. Your workouts, sets and PRs come with it.
          </Text>
          <ListGroup footer={HELP}>
            {IMPORT_SOURCES.map((s) => (
              <ListAction
                key={s}
                label={IMPORT_SOURCE_LABEL[s]}
                color={c.text}
                onPress={() => void chooseFile(s)}
                chevron
                busy={reading === s}
              />
            ))}
          </ListGroup>
          {fileError ? <Text style={[type.meta, styles.line, { color: c.danger }]}>{fileError}</Text> : null}
        </ScrollView>
      </View>
    );
  }

  // Steps 2 and 3, Review and Import.
  const { summary } = plan;
  const range = dateRange(summary.firstDate, summary.lastDate);
  const running = run.kind === 'running';
  const firstMatched = sorted.findIndex((m) => rank(m) === 2);
  const unsure = firstMatched === -1 ? sorted : sorted.slice(0, firstMatched);
  const matched = firstMatched === -1 ? [] : sorted.slice(firstMatched);

  const renderRow = (m: ExerciseMatch) => {
    const choice = choices[m.name];
    const target = choice && choice !== 'skip' ? (names.get(choice) ?? null) : null;
    return (
      <Pressable
        key={m.name}
        onPress={() => openRow(m.name)}
        disabled={running}
        accessibilityRole="button"
        accessibilityLabel={`${m.name}, ${plural(m.sets, 'set')}, ${target ?? 'Skip'}`}
        style={({ pressed }) => [styles.row, pressed && settingsStyles.pressed]}>
        <View style={styles.rowLeft}>
          <Text style={[styles.rowName, { color: c.text }]} numberOfLines={2}>
            {m.name}
          </Text>
          <Text style={[type.meta, styles.tabular, { color: c.text2 }]}>{plural(m.sets, 'set')}</Text>
          {m.close && choice === m.exerciseId ? (
            <Text style={[type.label, { color: c.text3 }]}>Close match</Text>
          ) : null}
        </View>
        <Text
          style={[styles.rowValue, { color: target ? c.accentText : c.text3 }]}
          numberOfLines={2}>
          {target ?? 'Skip'}
        </Text>
      </Pressable>
    );
  };

  const buttonLabel =
    run.kind === 'running'
      ? `Importing ${count(run.sent)} of ${count(summary.workouts)}`
      : run.kind === 'failed'
        ? 'Try again'
        : `Import ${plural(summary.workouts, 'workout')}`;
  const disabled = summary.workouts === 0 || running;

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content} {...scrollInsetProps}>
        <View style={styles.summary}>
          <Text style={[type.exerciseName, styles.tabular, { color: c.text }]}>
            {`${plural(summary.workouts, 'workout')}, ${plural(summary.sets, 'set')}`}
          </Text>
          {range ? <Text style={[type.meta, { color: c.text2 }]}>{range}</Text> : null}
          {summary.skippedLoggedDates > 0 ? (
            <Text style={[type.meta, { color: c.text2 }]}>
              {`${plural(summary.skippedLoggedDates, 'session')} on days you already logged in LiftCamp`}
            </Text>
          ) : null}
          {summary.alreadyImported > 0 ? (
            <Text style={[type.meta, { color: c.text2 }]}>{`${count(summary.alreadyImported)} already imported`}</Text>
          ) : null}
        </View>

        {!loaded.unitKnown ? (
          <View style={styles.question}>
            <Text style={[styles.questionLabel, { color: c.text }]}>
              {`Weights in ${IMPORT_SOURCE_LABEL[loaded.source]} were in`}
            </Text>
            <Segmented segments={UNIT_SEGMENTS} value={fileUnit} onChange={running ? () => {} : setFileUnit} />
            {unitSample ? (
              <Text style={[type.meta, styles.tabular, { color: c.text2 }]}>
                {`Your heaviest ${unitSample.name} set was ${weightText(unitSample.weight)}`}
              </Text>
            ) : null}
          </View>
        ) : null}

        {asksDumbbells ? (
          <View style={styles.question}>
            <Text style={[styles.questionLabel, { color: c.text }]}>Dumbbells were logged as</Text>
            <Segmented segments={DUMBBELL_SEGMENTS} value={dumbbells} onChange={running ? () => {} : setDumbbells} />
            {dumbbellLine ? (
              <Text style={[type.meta, styles.tabular, { color: c.text2 }]}>{dumbbellLine}</Text>
            ) : null}
          </View>
        ) : null}

        {unsure.length > 0 ? <ListGroup>{unsure.map(renderRow)}</ListGroup> : null}
        {matched.length > 0 ? <ListGroup title="Matched">{matched.map(renderRow)}</ListGroup> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md, borderColor: c.border, backgroundColor: c.bg }]}>
        {run.kind === 'failed' ? (
          <Text style={[type.meta, styles.footerLine, { color: c.danger }]}>
            {run.offline
              ? OFFLINE
              : `Imported ${count(run.sent)} of ${count(summary.workouts)}. Try again to finish.`}
          </Text>
        ) : null}
        <Pressable
          onPress={() => void startImport()}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityState={{ disabled, busy: running }}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: c.accent },
            (pressed || disabled) && settingsStyles.pressed,
            summary.workouts === 0 && styles.off,
          ]}>
          <Text style={[type.button, styles.primaryLabel, styles.tabular]}>{buttonLabel}</Text>
        </Pressable>
      </View>

      <ExercisePicker
        visible={pickingFor != null}
        excludeIds={[]}
        recentHint={null}
        mode="single"
        title="Choose exercise"
        hideNew
        onConfirm={onPicked}
        onClose={() => setPickingFor(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.xl, padding: spacing.screen },
  content: { padding: spacing.screen, gap: spacing.xl, paddingBottom: SCROLL_END_PADDING },
  line: { paddingHorizontal: spacing.xs },
  summary: { gap: spacing.xs, paddingHorizontal: spacing.xs },
  question: { gap: spacing.sm, paddingHorizontal: spacing.xs },
  questionLabel: { fontSize: 16, fontWeight: '500' },
  tabular: { fontVariant: ['tabular-nums'] },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.card,
    paddingVertical: spacing.md,
  },
  rowLeft: { flex: 1, gap: 2 },
  rowName: { fontSize: 16 },
  rowValue: { fontSize: 16, fontWeight: '500', flexShrink: 1, maxWidth: '50%', textAlign: 'right' },
  footer: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerLine: { textAlign: 'center' },
  primary: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
  },
  doneButton: { alignSelf: 'stretch' },
  primaryLabel: { color: '#FFFFFF', fontSize: 17 },
  off: { opacity: 0.4 },
});
