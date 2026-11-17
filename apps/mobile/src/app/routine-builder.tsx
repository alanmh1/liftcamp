import {
  BUILDER_SETS_MAX,
  BUILDER_SETS_MIN,
  builderChanged,
  builderEntriesFrom,
  canSaveRoutine,
  formatSetTarget,
  isTakenRoutineName,
  navHref,
  routineEntriesFrom,
  sameRoutineEntries,
  stepSets,
  type BuilderEntry,
  type TabStack,
} from '@liftcamp/shared';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import { Sheet, SheetMenu, type SheetMenuItem, type SheetRef } from '@/components/BottomSheet';
import { ExerciseThumb } from '@/components/exercise-media';
import { ReorderListModal } from '@/components/reorder-list-modal';
import { Text, TextInput } from '@/components/text';
import { TipNote } from '@/components/tip-note';
import { ExercisePicker } from '@/components/workout/exercise-picker';
import * as home from '@/data/home';
import type { SaveRoutineResult } from '@/data/home';
import { getRecentExercises, type ExerciseInfo } from '@/data/workouts';
import { useKeyboardOverlap } from '@/lib/keyboard-overlap';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, radius, spacing, type } from '@/theme/tokens';

/**
 * The routine builder (docs/routine-builder-spec.md): plan a routine
 * without starting a workout. A root modal, full screen like the workout.
 *
 * - `/routine-builder` builds a new routine. Every entry point runs the
 *   custom routine cap check before it opens this, never at Save.
 * - `/routine-builder?id=<templateId>` edits one of the user's own
 *   routines: its name and exercises. A program copy (has `program_slug`)
 *   is the user's row too; editing it leaves its program grouping alone.
 * - `stack` is the tab it opened from, so a new routine's detail is
 *   pushed back on that tab.
 *
 * Save is online only, like every routine write. Offline or refused, the
 * screen stays with the draft as it was.
 */
export default function RoutineBuilderScreen() {
  const params = useLocalSearchParams<{ id?: string; stack?: string }>();
  const editId = typeof params.id === 'string' && params.id ? params.id : null;
  const stack: TabStack = params.stack === 'home' ? 'home' : 'train';
  const { session } = useAuth();
  const userId = session?.user.id;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { scheme, colors: c } = useTheme();

  // Edit: null until the routine is read, false when it is not the user's
  // (or is gone). New: ready at once.
  const [loaded, setLoaded] = useState<boolean | null>(editId ? null : true);
  const [name, setName] = useState('');
  const [entries, setEntries] = useState<Card[]>([]);
  // What Cancel and Save compare against: the routine as opened (empty
  // for a new one), moved forward by a part of an edit that saved.
  const [initial, setInitial] = useState<{ name: string; entries: BuilderEntry[] }>({ name: '', entries: [] });
  const [inRotation, setInRotation] = useState(true);
  const [tipShown, setTipShown] = useState(true);
  const [names, setNames] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState<ExerciseInfo[] | null>(null);
  // The picker: adding (multi) or replacing one card (single).
  const [picker, setPicker] = useState<{ replacing: string | null } | null>(null);
  const [reordering, setReordering] = useState(false);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const menuRef = useRef<SheetRef>(null);
  const nextKey = useRef(0);
  const rootRef = useRef<View>(null);
  const androidKeyboard = useKeyboardOverlap(rootRef);

  const card = useCallback((exercise: ExerciseInfo, sets = 3, reps = ''): Card => {
    nextKey.current += 1;
    return { key: `c${nextKey.current}`, exercise, sets, reps };
  }, []);

  // The names for the same-name hint, and Recent for the picker.
  useEffect(() => {
    if (!userId) return;
    let live = true;
    void home.getUserRoutineNames(userId).then((n) => {
      if (live) setNames(n);
    });
    void getRecentExercises(userId).then((r) => {
      if (live) setRecent(r);
    });
    return () => {
      live = false;
    };
  }, [userId]);

  // Edit: the routine from the last read when there is one, else a read.
  useEffect(() => {
    if (!editId || !userId) return;
    let live = true;
    void (async () => {
      const t =
        home.peekUserTemplate(userId, editId) ??
        (await home.getUserTemplates(userId)).find((r) => r.id === editId);
      if (!live) return;
      if (!t || t.is_system) {
        setLoaded(false);
        return;
      }
      const rows = builderEntriesFrom(t.template_exercises);
      const joined = new Map<string, ExerciseInfo>();
      for (const te of t.template_exercises) {
        // TEMPLATE_FIELDS joins START_EXERCISE_FIELDS.
        const ex = te.exercises as ExerciseInfo | null | undefined;
        if (ex?.name) joined.set(te.exercise_id, ex);
      }
      const missing = rows.map((r) => r.exerciseId).filter((id) => !joined.has(id));
      if (missing.length > 0) {
        for (const [id, ex] of await home.exercisesByIds(missing)) joined.set(id, ex);
      }
      if (!live) return;
      // An exercise the catalog no longer has is left out of the draft and
      // of the comparison, so saving writes the routine as shown.
      const shown = rows.filter((r) => joined.has(r.exerciseId));
      setName(t.name);
      setEntries(shown.map((r) => card(joined.get(r.exerciseId)!, r.sets, r.reps)));
      setInitial({ name: t.name, entries: shown });
      setLoaded(true);
    })();
    return () => {
      live = false;
    };
  }, [editId, userId, card]);

  const draft = useMemo(
    () => entries.map((e): BuilderEntry => ({ exerciseId: e.exercise.id, sets: e.sets, reps: e.reps })),
    [entries],
  );
  const changed = builderChanged(initial, { name, entries: draft });
  const canSave = loaded === true && canSaveRoutine(name, entries) && !saving && (!editId || changed);
  // In edit mode the routine's own name is not a clash.
  const sameName =
    isTakenRoutineName(name, names) &&
    !(editId && name.trim().toLowerCase() === initial.name.trim().toLowerCase());

  const close = useCallback(() => {
    Keyboard.dismiss();
    router.back();
  }, [router]);

  const onCancel = useCallback(() => {
    if (saving) return;
    if (!changed) {
      close();
      return;
    }
    Alert.alert(editId ? 'Discard your changes?' : 'Discard this routine?', undefined, [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: close },
    ]);
  }, [changed, close, editId, saving]);

  // Android's back asks the same as Cancel.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCancel();
      return true;
    });
    return () => sub.remove();
  }, [onCancel]);

  function report(reason: Extract<SaveRoutineResult, { ok: false }>['reason']) {
    if (reason === 'offline') {
      Alert.alert("You're offline.", "Your routine is still here, save it when you're back online.");
    } else {
      Alert.alert('Could not save that routine.', 'Try again.');
    }
  }

  async function save() {
    if (!userId || !canSave) return;
    Keyboard.dismiss();
    setSaving(true);
    const exercises = routineEntriesFrom(draft);
    const trimmed = name.trim();

    if (!editId) {
      const result = await home.insertRoutine(userId, { name: trimmed, program: null, exercises, inRotation });
      setSaving(false);
      if (!result.ok) {
        report(result.reason);
        return;
      }
      // Off the modal, then the new routine's detail on the tab it opened
      // from, where Start is the primary action.
      router.back();
      router.push(navHref({ kind: 'routine', id: result.id }, stack) as Href);
      return;
    }

    // Edit: the exercises, then the name, each only when it changed. A
    // part that saved moves `initial` on, so a retry sends only the rest.
    let result: SaveRoutineResult = { ok: true, id: editId };
    if (!sameRoutineEntries(initial.entries, draft)) {
      result = await home.updateRoutineExercises(userId, editId, exercises);
      if (result.ok) setInitial((prev) => ({ ...prev, entries: draft }));
    }
    if (result.ok && trimmed !== initial.name.trim()) {
      result = await home.renameRoutine(userId, editId, trimmed);
      if (result.ok) setInitial((prev) => ({ ...prev, name: trimmed }));
    }
    setSaving(false);
    if (!result.ok) {
      report(result.reason);
      return;
    }
    // Back to where it opened, which reads again on focus.
    close();
  }

  function update(key: string, patch: Partial<Pick<Card, 'sets' | 'reps'>>) {
    setEntries((list) => list.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  }

  function onPicked(list: ExerciseInfo[]) {
    const replacing = picker?.replacing ?? null;
    setPicker(null);
    if (replacing) {
      const ex = list[0];
      // The card keeps its targets; only the exercise changes.
      if (ex) setEntries((all) => all.map((e) => (e.key === replacing ? { ...e, exercise: ex } : e)));
      return;
    }
    setEntries((all) => [...all, ...list.map((ex) => card(ex))]);
  }

  function onMenuAction(action: CardAction) {
    menuRef.current?.dismiss();
    const key = menuKey;
    if (!key) return;
    if (action === 'replace') {
      Keyboard.dismiss();
      setPicker({ replacing: key });
      return;
    }
    setEntries((all) => all.filter((e) => e.key !== key));
  }

  const menuCard = entries.find((e) => e.key === menuKey);
  const count = entries.length;

  return (
    <View
      ref={rootRef}
      style={[
        styles.fill,
        { backgroundColor: c.bg },
        Platform.OS === 'android' && androidKeyboard.overlap ? { paddingBottom: androidKeyboard.overlap } : null,
      ]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerSide}>
          <Pressable
            onPress={onCancel}
            disabled={saving}
            hitSlop={10}
            accessibilityRole="button"
            style={({ pressed }) => pressed && styles.pressed}>
            <Text style={[type.button, { color: c.accentText }]}>Cancel</Text>
          </Pressable>
        </View>
        <Text style={[type.exerciseName, styles.title, { color: c.text }]} numberOfLines={1}>
          {editId ? 'Edit routine' : 'New routine'}
        </Text>
        <View style={[styles.headerSide, styles.headerRight]}>
          <Pressable
            onPress={() => void save()}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave, busy: saving }}
            style={({ pressed }) => [
              styles.save,
              { backgroundColor: c.accent },
              !canSave && !saving && styles.disabled,
              pressed && styles.pressed,
            ]}>
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={[type.button, { color: '#FFFFFF' }]}>Save</Text>
            )}
          </Pressable>
        </View>
      </View>

      {loaded === false ? (
        <Text style={[type.meta, styles.gone, { color: c.text2 }]}>This routine is no longer in your routines.</Text>
      ) : loaded === null ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}>
          <View style={styles.field}>
            <Text style={[type.label, { color: c.text3 }]}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Routine name"
              placeholderTextColor={c.text3}
              autoFocus={!editId}
              maxLength={NAME_MAX}
              returnKeyType="done"
              accessibilityLabel="Routine name"
              style={[styles.input, { backgroundColor: c.inputFill, borderColor: c.border, color: c.text }]}
            />
            {sameName ? (
              <Text style={[type.meta, { color: c.danger }]}>You already have a routine with this name.</Text>
            ) : null}
          </View>

          {!editId && tipShown ? (
            <TipNote onDismiss={() => setTipShown(false)}>
              Plan it now, lift later. Starting weights get filled in when you start the workout.
            </TipNote>
          ) : null}

          {count > 0 ? (
            <View style={styles.countRow}>
              <Text style={[type.exerciseName, styles.count, { color: c.text }]}>
                {count} {count === 1 ? 'exercise' : 'exercises'}
              </Text>
              {count > 1 ? (
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    setReordering(true);
                  }}
                  hitSlop={12}
                  accessibilityRole="button"
                  style={({ pressed }) => pressed && styles.pressed}>
                  <Text style={[type.button, { color: c.accentText }]}>Reorder</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {entries.map((e) => (
            <View key={e.key} style={[styles.card, cardSurface(scheme, c)]}>
              <View style={styles.cardHead}>
                <ExerciseThumb exercise={e.exercise} size={40} />
                <Text style={[type.exerciseName, styles.cardName, { color: c.text }]} numberOfLines={2}>
                  {e.exercise.name}
                </Text>
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    setMenuKey(e.key);
                    menuRef.current?.present();
                  }}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`More for ${e.exercise.name}`}
                  style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
                  <SymbolView
                    name={{ ios: 'ellipsis', android: 'more_horiz' }}
                    size={20}
                    weight="bold"
                    tintColor={c.text2}
                    fallback={<Text style={[styles.moreGlyph, { color: c.text2 }]}>⋯</Text>}
                  />
                </Pressable>
              </View>
              <View style={styles.targets}>
                <View style={styles.target}>
                  <Text style={[type.label, { color: c.text3 }]}>Sets</Text>
                  <View style={styles.stepper}>
                    <StepButton
                      label="−"
                      a11y={`Fewer sets of ${e.exercise.name}`}
                      disabled={e.sets <= BUILDER_SETS_MIN}
                      onPress={() => update(e.key, { sets: stepSets(e.sets, -1) })}
                    />
                    <Text
                      style={[type.exerciseName, styles.stepValue, { color: c.text }]}
                      accessibilityLabel={`${e.sets} sets`}>
                      {e.sets}
                    </Text>
                    <StepButton
                      label="+"
                      a11y={`More sets of ${e.exercise.name}`}
                      disabled={e.sets >= BUILDER_SETS_MAX}
                      onPress={() => update(e.key, { sets: stepSets(e.sets, 1) })}
                    />
                  </View>
                </View>
                <View style={[styles.target, styles.repsTarget]}>
                  <Text style={[type.label, { color: c.text3 }]}>Reps</Text>
                  <TextInput
                    value={e.reps}
                    onChangeText={(reps) => update(e.key, { reps })}
                    placeholder="8-12"
                    placeholderTextColor={c.text3}
                    maxLength={REPS_MAX}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="done"
                    accessibilityLabel={`Reps for ${e.exercise.name}`}
                    style={[
                      styles.input,
                      styles.repsInput,
                      { backgroundColor: c.inputFill, borderColor: c.border, color: c.text },
                    ]}
                  />
                </View>
              </View>
            </View>
          ))}

          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              setPicker({ replacing: null });
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.addExercise, { borderColor: c.accent }, pressed && styles.pressed]}>
            <Text style={[type.button, { color: c.accentText }]}>+ Add exercise</Text>
          </Pressable>

          {!editId ? (
            <View style={[styles.rotationRow, cardSurface(scheme, c)]}>
              <View style={styles.rotationText}>
                <Text style={[type.button, { color: c.text }]}>In rotation</Text>
                <Text style={[type.meta, { color: c.text2 }]}>Shows up in Up next after your other routines</Text>
              </View>
              <Switch
                value={inRotation}
                onValueChange={setInRotation}
                trackColor={{ true: c.accent }}
                accessibilityLabel="In rotation"
              />
            </View>
          ) : null}
        </ScrollView>
      )}

      <ExercisePicker
        visible={picker != null}
        excludeIds={entries.map((e) => e.exercise.id)}
        recentHint={recent}
        mode={picker?.replacing ? 'single' : 'multi'}
        title={picker?.replacing ? 'Replace exercise' : 'Add exercises'}
        onConfirm={onPicked}
        onClose={() => setPicker(null)}
      />
      <ReorderListModal
        visible={reordering}
        title="Reorder exercises"
        items={entries}
        keyOf={(e) => e.key}
        onDone={(ordered) => {
          setReordering(false);
          setEntries(ordered);
        }}
        renderItem={(e) => (
          <View style={styles.reorderText}>
            <Text style={[type.exerciseName, { color: c.text }]} numberOfLines={1}>
              {e.exercise.name}
            </Text>
            <Text style={[type.meta, styles.tabular, { color: c.text2 }]} numberOfLines={1}>
              {formatSetTarget({ sets: e.sets, reps: e.reps })}
            </Text>
          </View>
        )}
      />
      <Sheet ref={menuRef}>
        <Text style={[styles.sheetHeader, { color: c.text2 }]} numberOfLines={1}>
          {menuCard?.exercise.name ?? ''}
        </Text>
        <SheetMenu items={CARD_MENU} onSelect={onMenuAction} />
      </Sheet>
    </View>
  );
}

/** One exercise card: the exercise and its targets as the stepper and the field hold them. */
type Card = { key: string; exercise: ExerciseInfo; sets: number; reps: string };

type CardAction = 'replace' | 'remove';

const CARD_MENU: SheetMenuItem<CardAction>[] = [
  { key: 'replace', label: 'Replace' },
  { key: 'remove', label: 'Remove', destructive: true },
];

/** Save routine's limit: long enough for any routine name worth typing, short enough for a card. */
const NAME_MAX = 60;
/** "8-12 each side" fits. */
const REPS_MAX = 16;

/** − or + on the Sets stepper: a 36 pt circle, with slop to 44. */
function StepButton({
  label,
  a11y,
  disabled,
  onPress,
}: {
  label: string;
  a11y: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const c = useTheme().colors;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.step,
        { backgroundColor: c.accentSoft },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.stepGlyph, { color: c.accentText }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.sm,
  },
  headerSide: { flex: 1, alignItems: 'flex-start' },
  headerRight: { alignItems: 'flex-end' },
  title: { textAlign: 'center', flexShrink: 1 },
  // The workout screen's Finish pill.
  save: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minWidth: 70,
    alignItems: 'center',
  },
  gone: { fontSize: 15, padding: spacing.screen },
  loading: { marginTop: spacing.xl },
  content: { padding: spacing.screen, paddingTop: spacing.md, gap: spacing.lg },
  field: { gap: spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 17,
  },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { fontVariant: ['tabular-nums'] },
  card: { borderRadius: radius.card, padding: spacing.card, gap: spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardName: { flex: 1 },
  more: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: -spacing.xs },
  moreGlyph: { fontSize: 20, lineHeight: 22, fontWeight: '700' },
  targets: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.lg },
  target: { gap: spacing.xs },
  repsTarget: { flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  step: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { fontSize: 20, lineHeight: 22, fontWeight: '600' },
  stepValue: { minWidth: 26, textAlign: 'center', fontVariant: ['tabular-nums'] },
  repsInput: { paddingVertical: spacing.sm, minHeight: 48, fontVariant: ['tabular-nums'] },
  // The workout screen's Add exercise.
  addExercise: {
    borderWidth: 1.5,
    borderRadius: radius.bar,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  rotationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.card,
    padding: spacing.card,
  },
  rotationText: { flex: 1, gap: 2 },
  reorderText: { flex: 1, gap: 2 },
  tabular: { fontVariant: ['tabular-nums'] },
  sheetHeader: { fontSize: 15, paddingBottom: spacing.md, paddingHorizontal: 4 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});
