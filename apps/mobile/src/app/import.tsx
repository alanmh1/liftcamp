import {
  buildImportPlan,
  matchExercises,
  parseFitbod,
  type ExerciseMatch,
  type FitbodRow,
  type ImportChoice,
  type ImportSource,
} from '@liftcamp/shared';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import { ListAction, ListGroup, settingsStyles } from '@/components/settings-ui';
import { Text } from '@/components/text';
import { ExercisePicker } from '@/components/workout/exercise-picker';
import { loadImportContext, localDateOf, runImport, type ImportContext } from '@/data/import';
import type { ExerciseInfo } from '@/data/workouts';
import { chooseOption } from '@/lib/action-sheet';
import { EVENTS, track } from '@/lib/analytics';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/**
 * Settings, Import workouts (docs/import-workouts-spec.md). Three steps in
 * place: choose a file, review what matched, import. Parsing and matching
 * run on the phone (shared `import/`); the server only sees the finished
 * workouts, 50 a call.
 */

const SOURCE: ImportSource = 'fitbod';

const CSV_TYPES = ['text/csv', 'text/comma-separated-values', 'public.comma-separated-values-text', 'text/plain'];

const NOT_FITBOD = "This doesn't look like a Fitbod export.";
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
  rows: FitbodRow[];
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

  const [reading, setReading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [choices, setChoices] = useState<Record<string, ImportChoice>>({});
  // Exercises picked in the review that the context's catalog may not hold.
  const [picked, setPicked] = useState<Map<string, ExerciseInfo>>(new Map());
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const [run, setRun] = useState<Run>({ kind: 'idle' });

  async function chooseFile() {
    if (!userId || reading) return;
    setFileError(null);
    let text: string;
    try {
      const pick = await File.pickFileAsync({ mimeTypes: CSV_TYPES });
      if (pick.canceled) return;
      setReading(true);
      text = await pick.result.text();
    } catch {
      setReading(false);
      setFileError(NOT_FITBOD);
      return;
    }
    const parsed = parseFitbod(text);
    if (!parsed.ok) {
      setReading(false);
      setFileError(NOT_FITBOD);
      return;
    }
    void track(EVENTS.importStarted, { source: SOURCE });
    const ctx = await loadImportContext(userId, SOURCE);
    setReading(false);
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
    setLoaded({ rows: parsed.rows, matches, ctx });
  }

  const names = useMemo(() => {
    const out = new Map<string, string>();
    for (const e of loaded?.ctx.catalog ?? []) out.set(e.id, e.name);
    for (const e of picked.values()) out.set(e.id, e.name);
    return out;
  }, [loaded, picked]);

  const plan = useMemo(() => {
    if (!loaded) return null;
    const catalog = [...loaded.ctx.catalog, ...picked.values()];
    return buildImportPlan(loaded.rows, choices, catalog, {
      source: SOURCE,
      existingDates: loaded.ctx.existingDates,
      importedStarts: loaded.ctx.importedStarts,
      localDate: localDateOf,
    });
  }, [loaded, choices, picked]);

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
    if (!plan || plan.summary.workouts === 0) return;
    if (run.kind === 'running') return;
    setRun({ kind: 'running', sent: 0 });
    const result = await runImport(SOURCE, plan.workouts, (sent) => setRun({ kind: 'running', sent }));
    if (!result.ok) {
      setRun({ kind: 'failed', sent: result.sent, offline: result.offline && result.sent === 0 });
      return;
    }
    void track(EVENTS.importFinished, {
      source: SOURCE,
      workouts: result.inserted,
      sets: plan.summary.sets,
      skipped_exercises: plan.summary.skippedExercises,
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
            Bring your history from Fitbod. Your workouts, sets and PRs come with it.
          </Text>
          <ListGroup footer="In Fitbod, export your workout data as a CSV and save it to Files.">
            <ListAction label="Fitbod" color={c.text} onPress={() => void chooseFile()} chevron busy={reading} />
          </ListGroup>
          {fileError ? <Text style={[type.meta, styles.line, { color: c.danger }]}>{fileError}</Text> : null}
          <Text style={[type.meta, styles.line, { color: c.text3 }]}>More apps soon.</Text>
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
