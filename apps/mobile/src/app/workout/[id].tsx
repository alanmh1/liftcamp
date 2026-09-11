import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
// RNGH's ScrollView, not React Native's. The set rows are ReanimatedSwipeable,
// and a core ScrollView does not negotiate with an RNGH pan: the swipe gesture
// claims the touch and vertical scrolling dies. RNGH's own ScrollView composes
// with them.
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Sheet, SheetMenu, type SheetRef } from '@/components/BottomSheet';
import { useAuth } from '@/components/auth-provider';
import {
  ExerciseMenuSheet,
  type ExerciseAction,
} from '@/components/workout/exercise-menu-sheet';
import { ExerciseCard } from '@/components/workout/exercise-card';
import { ExercisePicker } from '@/components/workout/exercise-picker';
import { KeypadAccessory, type EditField } from '@/components/workout/keypad-accessory';
import { RestRow } from '@/components/workout/rest-row';
import * as data from '@/data/workouts';
import type { ActiveWorkout, ExerciseInfo, WorkoutSet } from '@/data/workouts';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

const DEFAULT_REST_SECONDS = 120;
const UNDO_MS = 5000;

function elapsedLabel(fromIso: string, now: number): string {
  const secs = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Parses a keypad string. Empty clears the value rather than writing 0. */
function parseNumeric(raw: string, integer: boolean): number | null {
  const cleaned = raw.replace(integer ? /[^0-9]/g : /[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = integer ? Number.parseInt(cleaned, 10) : Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export default function ActiveWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const c = useColors();
  // This screen is a fullScreenModal. The native SafeAreaView lays out before
  // the modal's view controller is in the window, reads zero insets, and does
  // not re-lay out, so the header sat under the status bar. The hook reads the
  // root provider's insets, which are correct from the first frame. No nested
  // SafeAreaProvider is needed here: unlike the picker's RN Modal, a native
  // stack modal is a screen in the same window as the root provider.
  const insets = useSafeAreaInsets();
  const userId = session?.user.id;

  const [workout, setWorkout] = useState<ActiveWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [bodyweight, setBodyweight] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  // Rest timer. A plain JS interval for now; the local notification that keeps
  // it alive behind a locked screen is Phase 7 item 1.
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState(DEFAULT_REST_SECONDS);

  const [editing, setEditing] = useState<{ setId: string; field: EditField } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const menuRef = useRef<SheetRef>(null);
  const [menuWeId, setMenuWeId] = useState<string | null>(null);
  const overflowRef = useRef<SheetRef>(null);
  const [replacingWeId, setReplacingWeId] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ weId: string; set: WorkoutSet } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unit = 'lbs';

  useEffect(() => {
    if (!userId || !id) return;
    let cancelled = false;
    data.loadWorkout(userId, id).then((w) => {
      if (cancelled) return;
      setWorkout(w);
      setBodyweight(w?.bodyweight ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, id]);

  // One ticker drives both the elapsed clock and the rest ring.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (restEndsAt != null && now >= restEndsAt) setRestEndsAt(null);
  }, [now, restEndsAt]);

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  /** Applies a change to one set in local state, then persists it. */
  const patchSet = useCallback(
    (setId: string, patch: Partial<WorkoutSet>, persist = true) => {
      setWorkout((w) =>
        w
          ? {
              ...w,
              exercises: w.exercises.map((we) => ({
                ...we,
                sets: we.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
              })),
            }
          : w,
      );
      if (persist) void data.updateSet(setId, patch);
    },
    [],
  );

  function onChangeField(setId: string, field: EditField, raw: string) {
    const value = parseNumeric(raw, field === 'reps');
    patchSet(setId, field === 'weight' ? { weight_value: value } : { reps: value });
  }

  function onStep(delta: number) {
    if (!editing || !workout) return;
    const set = workout.exercises.flatMap((we) => we.sets).find((s) => s.id === editing.setId);
    if (!set) return;
    if (editing.field === 'weight') {
      const next = Math.max(0, (set.weight_value ?? 0) + delta);
      patchSet(set.id, { weight_value: Math.round(next * 100) / 100 });
    } else {
      const next = Math.max(0, (set.reps ?? 0) + delta);
      patchSet(set.id, { reps: next });
    }
  }

  function toggleDone(set: WorkoutSet) {
    const next = !set.completed;
    patchSet(set.id, { completed: next });
    if (next) {
      setRestTotal(DEFAULT_REST_SECONDS);
      setRestEndsAt(Date.now() + DEFAULT_REST_SECONDS * 1000);
    }
  }

  /** Done on the reps input marks the set done, per the spec. */
  function onKeypadDone() {
    if (editing?.field === 'reps' && workout) {
      const set = workout.exercises.flatMap((we) => we.sets).find((s) => s.id === editing.setId);
      if (set && !set.completed) toggleDone(set);
    }
    setEditing(null);
  }

  function deleteSet(weId: string, set: WorkoutSet) {
    setWorkout((w) =>
      w
        ? {
            ...w,
            exercises: w.exercises.map((we) =>
              we.id === weId ? { ...we, sets: we.sets.filter((s) => s.id !== set.id) } : we,
            ),
          }
        : w,
    );
    void data.deleteSet(set.id);
    setUndo({ weId, set });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  }

  async function restoreDeleted() {
    if (!undo || !userId) return;
    await data.restoreSet(userId, undo.weId, undo.set);
    setWorkout((w) =>
      w
        ? {
            ...w,
            exercises: w.exercises.map((we) =>
              we.id === undo.weId
                ? { ...we, sets: [...we.sets, undo.set].sort((a, b) => a.position - b.position) }
                : we,
            ),
          }
        : w,
    );
    setUndo(null);
  }

  async function addSet(weId: string) {
    if (!userId || !workout) return;
    const we = workout.exercises.find((x) => x.id === weId);
    if (!we) return;
    const last = we.sets[we.sets.length - 1];
    const created = await data.addSet(userId, weId, we.sets.length, {
      weight_value: last?.weight_value ?? null,
      reps: last?.reps ?? null,
    });
    setWorkout((w) =>
      w
        ? {
            ...w,
            exercises: w.exercises.map((x) =>
              x.id === weId ? { ...x, sets: [...x.sets, created] } : x,
            ),
          }
        : w,
    );
  }

  /**
   * Picker confirmation. Replace keeps a single exercise; Add takes the whole
   * selection in the order it was picked, each one seeded from the prior
   * session exactly as a single add is.
   */
  async function onConfirmExercises(exercises: ExerciseInfo[]) {
    if (!userId || !workout) return;
    setPickerOpen(false);

    if (replacingWeId) {
      const exercise = exercises[0];
      if (exercise) {
        await data.replaceExercise(replacingWeId, exercise.id);
        setWorkout((w) =>
          w
            ? {
                ...w,
                exercises: w.exercises.map((we) =>
                  we.id === replacingWeId ? { ...we, exercise } : we,
                ),
              }
            : w,
        );
      }
      setReplacingWeId(null);
      return;
    }

    // Sequential rather than Promise.all, so positions come out in selection
    // order and the cards appear in the order the user picked them.
    let position = workout.exercises.length;
    for (const exercise of exercises) {
      const added = await data.addExercise(userId, workout.id, exercise, position, bodyweight);
      if (!added) continue;
      position += 1;
      setWorkout((w) => (w ? { ...w, exercises: [...w.exercises, added] } : w));
    }
  }

  async function runExerciseAction(weId: string, action: ExerciseAction) {
    if (!workout) return;

    if (action === 'replace') {
      setReplacingWeId(weId);
      setPickerOpen(true);
      return;
    }
    if (action === 'remove') {
      await data.removeExercise(weId);
      setWorkout((w) =>
        w ? { ...w, exercises: w.exercises.filter((we) => we.id !== weId) } : w,
      );
      return;
    }
    if (action === 'reorder') {
      const idx = workout.exercises.findIndex((we) => we.id === weId);
      if (idx < 0 || idx === workout.exercises.length - 1) return;
      const next = [...workout.exercises];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      setWorkout((w) => (w ? { ...w, exercises: next } : w));
      await data.reorderExercises(next);
      return;
    }
    if (action === 'note') {
      Alert.alert('Add note', 'Exercise notes arrive with the exercise detail sheet.');
    }
  }

  function openExerciseMenu(weId: string) {
    setMenuWeId(weId);
    menuRef.current?.present();
  }

  function onMenuAction(action: ExerciseAction) {
    menuRef.current?.dismiss();
    if (menuWeId) void runExerciseAction(menuWeId, action);
  }

  /**
   * Cancel discards the workout outright. Swipe-down is "not now" and leaves
   * it in progress; this is the destructive one, so it confirms when there is
   * anything to lose. With no completed sets there is nothing to protect and
   * the discard runs straight away.
   */
  function onCancelWorkout() {
    overflowRef.current?.dismiss();
    if (!workout) return;
    const completed = workout.exercises.flatMap((we) => we.sets).filter((s) => s.completed).length;

    const discard = async () => {
      // Same delete path the Resume card's swipe uses; children cascade.
      await data.discardWorkout(workout.id);
      router.dismissTo('/');
    };

    if (completed === 0) {
      void discard();
      return;
    }
    Alert.alert(
      'Cancel workout?',
      `${completed} completed ${completed === 1 ? 'set' : 'sets'} will be lost.`,
      [
        { text: 'Keep logging', style: 'cancel' },
        { text: 'Discard workout', style: 'destructive', onPress: () => void discard() },
      ],
    );
  }

  async function onFinish() {
    if (!workout) return;
    const pending = workout.exercises.flatMap((we) => we.sets).filter((s) => !s.completed).length;
    const done = async () => {
      await data.finishWorkout(workout.id);
      router.dismissTo('/');
    };
    if (pending === 0) {
      await done();
      return;
    }
    Alert.alert(
      'Finish workout?',
      `${pending} ${pending === 1 ? 'set is' : 'sets are'} still pending.`,
      [
        { text: 'Keep logging', style: 'cancel' },
        { text: 'Finish anyway', style: 'destructive', onPress: () => void done() },
      ],
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={[type.meta, { color: c.text2 }]}>Workout not found.</Text>
      </View>
    );
  }

  const setsDone = workout.exercises.flatMap((we) => we.sets).filter((s) => s.completed).length;
  const restRemaining = restEndsAt != null ? (restEndsAt - now) / 1000 : 0;

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <View style={styles.fill}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.headerText}>
            <Text style={[type.screenTitle, { color: c.text }]}>{workout.name ?? 'Workout'}</Text>
            <Text style={[type.meta, { color: c.text2 }]}>
              <Text style={[type.restTime, { color: c.text2 }]}>
                {elapsedLabel(workout.createdAt, now)}
              </Text>
              {`  ·  ${workout.exercises.length} exercises  ·  ${setsDone} sets done`}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => overflowRef.current?.present()}
              hitSlop={10}
              accessibilityLabel="Workout options"
              style={({ pressed }) => [styles.overflow, pressed && styles.pressed]}>
              <Text style={[styles.overflowGlyph, { color: c.text2 }]}>⋮</Text>
            </Pressable>
            <Pressable
              onPress={onFinish}
              style={({ pressed }) => [
                styles.finish,
                { backgroundColor: c.accent },
                pressed && styles.pressed,
              ]}>
              <Text style={[type.button, { color: '#FFFFFF' }]}>Finish</Text>
            </Pressable>
          </View>
        </View>

        {restEndsAt != null ? (
          <RestRow
            remaining={restRemaining}
            total={restTotal}
            onAdd30={() => {
              setRestTotal((t) => t + 30);
              setRestEndsAt((e) => (e ?? Date.now()) + 30_000);
            }}
            onPressTime={() => setRestEndsAt(null)}
          />
        ) : null}

        <ScrollView
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {workout.exercises.map((we) => (
            <ExerciseCard
              key={we.id}
              we={we}
              unit={unit}
              bodyweight={bodyweight}
              onOpenSheet={() => openExerciseMenu(we.id)}
              onEditField={(setId, field) => setEditing({ setId, field })}
              onChangeField={onChangeField}
              onToggleDone={toggleDone}
              onDeleteSet={(s) => deleteSet(we.id, s)}
              onAddSet={() => void addSet(we.id)}
            />
          ))}

          {workout.exercises.length === 0 ? (
            <Text style={[type.meta, styles.empty, { color: c.text2 }]}>
              No exercises yet. Add the first one below.
            </Text>
          ) : null}
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Pressable
            onPress={() => {
              setReplacingWeId(null);
              setPickerOpen(true);
            }}
            style={({ pressed }) => [
              styles.addExercise,
              { borderColor: c.accent },
              pressed && styles.pressed,
            ]}>
            <Text style={[type.button, { color: c.accentText }]}>+ Add exercise</Text>
          </Pressable>
        </View>
      </View>

      {undo ? (
        <View
          style={[
            styles.toast,
            { bottom: 96 + insets.bottom, backgroundColor: c.surface2, borderColor: c.border },
          ]}>
          <Text style={[type.meta, { color: c.text }]}>Set deleted</Text>
          <Pressable onPress={() => void restoreDeleted()} hitSlop={8}>
            <Text style={[type.button, { color: c.accentText }]}>Undo</Text>
          </Pressable>
        </View>
      ) : null}

      <KeypadAccessory field={editing?.field ?? null} onStep={onStep} onDone={onKeypadDone} />

      <Sheet ref={overflowRef}>
        <SheetMenu
          items={[{ key: 'cancel', label: 'Cancel workout', destructive: true }]}
          onSelect={onCancelWorkout}
        />
      </Sheet>

      <ExerciseMenuSheet
        ref={menuRef}
        exerciseName={
          workout.exercises.find((we) => we.id === menuWeId)?.exercise.name ?? ''
        }
        onAction={onMenuAction}
      />

      <ExercisePicker
        visible={pickerOpen}
        mode={replacingWeId ? 'single' : 'multi'}
        title={replacingWeId ? 'Replace exercise' : 'Add exercises'}
        onConfirm={(list) => void onConfirmExercises(list)}
        onClose={() => {
          setPickerOpen(false);
          setReplacingWeId(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.sm,
  },
  headerText: { flexShrink: 1, gap: 2 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  overflow: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowGlyph: { fontSize: 22, lineHeight: 24 },
  finish: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  list: {
    padding: spacing.screen,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  empty: { textAlign: 'center', paddingVertical: spacing.xl },
  bottomBar: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
  },
  addExercise: {
    borderWidth: 1.5,
    borderRadius: radius.bar,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  toast: {
    position: 'absolute',
    left: spacing.screen,
    right: spacing.screen,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.bar,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.7 },
});
