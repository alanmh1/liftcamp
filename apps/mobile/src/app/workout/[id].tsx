import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { priorSetForPosition, tidyWeight, type SetPlaceholder } from '@liftcamp/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
// RNGH's ScrollView, not React Native's. The set rows are ReanimatedSwipeable,
// and a core ScrollView does not negotiate with an RNGH pan: the swipe gesture
// claims the touch and vertical scrolling dies. RNGH's own ScrollView composes
// with them.
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import type { SheetRef } from '@/components/BottomSheet';
import { useAuth } from '@/components/auth-provider';
import { useWeightUnit } from '@/components/unit-provider';
import { ExerciseInfoSheet } from '@/components/exercise-info-sheet';
import {
  ExerciseMenuSheet,
  type ExerciseAction,
} from '@/components/workout/exercise-menu-sheet';
import { Reveal, Skeleton, SkeletonText } from '@/components/skeleton';
import { Text, TextInput } from '@/components/text';
import { ExerciseCard, ExerciseCardSkeleton } from '@/components/workout/exercise-card';
import { ExercisePicker } from '@/components/workout/exercise-picker';
import { ACCESSORY_HEIGHT, KeypadAccessory, type EditField } from '@/components/workout/keypad-accessory';
import { ReorderModal } from '@/components/workout/reorder-modal';
import { RecentExercises } from '@/components/workout/recent-exercises';
import { RestRow } from '@/components/workout/rest-row';
import * as data from '@/data/workouts';
import { confirm, emphasize, reward } from '@/lib/haptics';
import { useKeyboard } from '@/lib/use-keyboard';
import type { ActiveWorkout, ExerciseInfo, WorkoutExercise, WorkoutSet } from '@/data/workouts';
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

/**
 * The workout is presented as a native-stack modal: its own view controller,
 * above the app's root view. Two things the root layout provides therefore
 * have to be provided again in here, the same way the exercise picker's RN
 * Modal does:
 *
 * - BottomSheetModalProvider. BottomSheetModal renders through a portal into
 *   the nearest provider's host. With only the root provider, every sheet on
 *   this screen (header ⋮, exercise ⋮) mounted and animated behind the modal,
 *   invisible. A provider here puts the host inside the modal's hierarchy.
 * - SafeAreaProvider. Measures the modal's own view. For a full-screen modal
 *   that view spans the window, so its top inset equals the root's (status
 *   bar plus notch) and the header clears the clock. It initialises from the
 *   parent context, so there is no zero-inset first frame.
 */
export default function ActiveWorkoutScreen() {
  return (
    <SafeAreaProvider>
      <BottomSheetModalProvider>
        <ActiveWorkoutContent />
      </BottomSheetModalProvider>
    </SafeAreaProvider>
  );
}

function ActiveWorkoutContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const c = useColors();
  // From the SafeAreaProvider this screen mounts for itself (see the default
  // export), so these are the modal's own insets, not the root view's.
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
  // Every set row's two inputs, so the keypad bar's Next can move focus. Keyed
  // `${setId}:${field}`; rows register on mount and null out on unmount.
  const inputRefs = useRef(new Map<string, TextInput>());
  // Sets whose PR has already buzzed this session, so un-checking and
  // re-checking a PR set does not reward it twice.
  const rewardedPrSets = useRef(new Set<string>());
  function registerInput(setId: string, field: EditField, input: TextInput | null) {
    const key = `${setId}:${field}`;
    if (input) inputRefs.current.set(key, input);
    else inputRefs.current.delete(key);
  }

  // Keeping the focused row in view. The scroll view does not adjust for
  // the keyboard on its own, and iOS's own adjustment would not know about
  // the accessory bar, so the screen does both: while the keyboard is up
  // the content gets bottom padding equal to the keyboard plus the bar, so
  // the last rows can scroll clear at all, and whenever the focused field
  // changes or the keyboard arrives, the field is measured and scrolled
  // above the bar if it sits under it. Keying on `editing` is what makes
  // Next work: it moves focus without a keyboard event.
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const keyboard = useKeyboard();
  // Android resizes the window for the keyboard, so only the bar needs
  // padding there; iOS lays the keyboard over the view.
  const keyboardPad =
    keyboard.top == null ? 0 : (Platform.OS === 'ios' ? keyboard.height : 0) + ACCESSORY_HEIGHT;
  const [pickerOpen, setPickerOpen] = useState(false);
  // For the empty state. Null until loaded, so the empty message does not
  // flash before the list arrives.
  const [recent, setRecent] = useState<ExerciseInfo[] | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const menuRef = useRef<SheetRef>(null);
  const [menuWeId, setMenuWeId] = useState<string | null>(null);
  const [reorderOpen, setReorderOpen] = useState(false);
  const infoRef = useRef<SheetRef>(null);
  const [infoExercise, setInfoExercise] = useState<ExerciseInfo | null>(null);
  const [replacingWeId, setReplacingWeId] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ weId: string; set: WorkoutSet } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { label: unit, unit: weightUnit, loading: unitLoading } = useWeightUnit();

  // Reloads when the unit changes, so sets already logged show converted and
  // new ones are typed in the new unit.
  useEffect(() => {
    if (!userId || !id || unitLoading) return;
    let cancelled = false;
    // Only needed when the workout is empty, but it is one small query and
    // fetching it alongside means the empty state renders complete.
    data.getRecentExercises(userId).then((rows) => {
      if (!cancelled) setRecent(rows);
    });
    data.loadWorkout(userId, id, weightUnit).then((w) => {
      if (cancelled) return;
      setWorkout(w);
      setBodyweight(w?.bodyweight ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, id, weightUnit, unitLoading]);

  // One ticker drives both the elapsed clock and the rest ring.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // The rest timer running out on its own, not dismissed by a tap, buzzes.
  // Foreground only: the ticker stops in the background.
  useEffect(() => {
    if (restEndsAt != null && now >= restEndsAt) {
      setRestEndsAt(null);
      reward();
    }
  }, [now, restEndsAt]);

  useEffect(() => {
    if (!editing || keyboard.top == null) return;
    const input = inputRefs.current.get(`${editing.setId}:${editing.field}`);
    if (!input) return;
    const limit = keyboard.top - ACCESSORY_HEIGHT - spacing.lg;
    input.measureInWindow((_x, y, _w, h) => {
      const overlap = y + h - limit;
      if (overlap > 0) scrollRef.current?.scrollTo({ y: scrollY.current + overlap, animated: true });
    });
  }, [editing, keyboard.top]);

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
      if (persist) void data.updateSet(setId, patch, weightUnit);
    },
    [weightUnit],
  );

  function onChangeField(setId: string, field: EditField, raw: string) {
    const value = parseNumeric(raw, field === 'reps');
    // Typing is an edit: the weight is now the typed value in the current
    // unit, not the converted source it was seeded from.
    patchSet(setId, field === 'weight' ? { weight_value: value, stored: null } : { reps: value });
  }

  /** The placeholder a set's empty boxes show, worked out the way its card does. */
  function placeholderOf(setId: string): SetPlaceholder | null {
    const we = workout?.exercises.find((x) => x.sets.some((s) => s.id === setId));
    if (!we) return null;
    return data.placeholdersFor(we)[we.sets.findIndex((s) => s.id === setId)] ?? null;
  }

  function onStep(delta: number) {
    if (!editing || !workout) return;
    const set = workout.exercises.flatMap((we) => we.sets).find((s) => s.id === editing.setId);
    if (!set) return;
    // An empty box steps from its placeholder, the number the user can see.
    const placeholder = placeholderOf(set.id);
    if (editing.field === 'weight') {
      // From the value the field shows, so a converted 102.058 steps to 104.6.
      const base = set.weight_value ?? placeholder?.weight?.value ?? null;
      const next = Math.max(0, (tidyWeight(base, weightUnit) ?? 0) + delta);
      patchSet(set.id, { weight_value: Math.round(next * 100) / 100, stored: null });
    } else {
      const next = Math.max(0, (set.reps ?? placeholder?.reps ?? 0) + delta);
      patchSet(set.id, { reps: next });
    }
  }

  /**
   * The check. Ticking a set fills each empty box from its placeholder and
   * logs that, with the placeholder weight's stored value and unit, so an
   * unedited carried weight ties its source rather than beating it by the
   * rounding. A weighted exercise with no weight typed and none to fall back
   * on is not logged; the weight box takes focus instead. Anything else with
   * nothing to fall back on logs as it stands, as before.
   */
  function toggleDone(set: WorkoutSet, placeholder: SetPlaceholder | null, weighted: boolean) {
    if (set.completed) {
      patchSet(set.id, { completed: false });
      return;
    }
    const patch: Partial<WorkoutSet> = { completed: true };
    if (set.weight_value == null && placeholder?.weight) {
      patch.weight_value = placeholder.weight.value;
      patch.stored = placeholder.weight.stored;
    }
    if (set.reps == null && placeholder?.reps != null) patch.reps = placeholder.reps;
    if (weighted && (patch.weight_value ?? set.weight_value) == null) {
      inputRefs.current.get(`${set.id}:weight`)?.focus();
      return;
    }
    patchSet(set.id, patch);
    // One buzz per check: the PR success pattern when this set becomes a
    // PR for the first time this session, else the light confirmation.
    // Never on un-check.
    if (becomesPr(set, patch)) reward();
    else confirm();
    setRestTotal(DEFAULT_REST_SECONDS);
    setRestEndsAt(Date.now() + DEFAULT_REST_SECONDS * 1000);
  }

  /**
   * Whether checking `set` with `patch` makes it a PR, by the same rule as
   * the card's ribbon, and it has not buzzed as one before. Records it when
   * it has.
   */
  function becomesPr(set: WorkoutSet, patch: Partial<WorkoutSet>): boolean {
    if (!workout || rewardedPrSets.current.has(set.id)) return false;
    const we = workout.exercises.find((x) => x.sets.some((s) => s.id === set.id));
    if (!we) return false;
    const after = { ...we, sets: we.sets.map((s) => (s.id === set.id ? { ...s, ...patch } : s)) };
    if (!data.workoutPrSetIds(after, bodyweight).has(set.id)) return false;
    rewardedPrSets.current.add(set.id);
    return true;
  }

  /**
   * The input after the one being edited, inside the same exercise: weight to
   * reps of the same set, reps to the weight of the next set. Null on the
   * last input of the exercise, where the bar reads Done.
   */
  function nextInput(): { setId: string; field: EditField } | null {
    if (!editing || !workout) return null;
    if (editing.field === 'weight') return { setId: editing.setId, field: 'reps' };
    const we = workout.exercises.find((x) => x.sets.some((s) => s.id === editing.setId));
    if (!we) return null;
    const i = we.sets.findIndex((s) => s.id === editing.setId);
    const next = we.sets[i + 1];
    return next ? { setId: next.id, field: 'weight' } : null;
  }

  /**
   * Next or Done on the keypad bar. Focus only: Next moves to the following
   * input, whose onFocus updates `editing`, and Done dismisses. Neither marks
   * a set complete; that stays an explicit tap on the check control, so a
   * user stepping through prefilled values cannot log a set by accident.
   */
  function onKeypadAdvance() {
    const target = nextInput();
    if (target) {
      inputRefs.current.get(`${target.setId}:${target.field}`)?.focus();
      return;
    }
    Keyboard.dismiss();
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
    await data.restoreSet(userId, undo.weId, undo.set, weightUnit);
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

  /**
   * Add set seeds the new row so the user types as little as possible. The
   * source, in order: the last set in this exercise with a value in either
   * field (not the last set, which on a routine-seeded exercise is often
   * still empty), then the prior session's set for the new position, then
   * nothing. Completion is not consulted: a filled but unchecked set is
   * usually the one just typed. Local state, so a value typed a moment ago
   * counts whether or not its write has landed.
   */
  async function addSet(weId: string) {
    if (!userId || !workout) return;
    const we = workout.exercises.find((x) => x.id === weId);
    if (!we) return;
    const position = we.sets.length;
    const filled = [...we.sets].reverse().find((s) => s.weight_value != null || s.reps != null);
    const source = filled ?? priorSetForPosition(we.prior, position);
    const created = await data.addSet(userId, weId, position, {
      weight_value: source?.weight_value ?? null,
      reps: source?.reps ?? null,
      stored: source?.stored ?? null,
    }, weightUnit);
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
      const added = await data.addExercise(userId, workout.id, exercise, position, bodyweight, weightUnit);
      if (!added) continue;
      position += 1;
      setWorkout((w) => (w ? { ...w, exercises: [...w.exercises, added] } : w));
    }
  }

  async function runExerciseAction(weId: string, action: ExerciseAction) {
    if (!workout) return;

    if (action === 'reorder') {
      // Whole-workout screen; which card opened it does not matter.
      setReorderOpen(true);
      return;
    }

    if (action === 'info') {
      const we = workout.exercises.find((x) => x.id === weId);
      if (!we) return;
      setInfoExercise(we.exercise);
      // The menu dismisses before this runs (see onMenuAction), so the two
      // sheets never fight over the single modal host.
      infoRef.current?.present();
      return;
    }

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
   * The trash button. Discards the workout outright; the caret is "not now"
   * and leaves it in progress. This is the destructive one, so it confirms
   * when there is anything to lose. With no completed sets there is nothing
   * to protect and the discard runs straight away.
   */
  function onCancelWorkout() {
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

  /**
   * Done on the reorder screen. The screen worked on its own copy; this takes
   * the final order, applies it locally, and writes every changed position in
   * one request. Nothing was written while dragging.
   */
  async function onReorderDone(ordered: WorkoutExercise[]) {
    setReorderOpen(false);
    if (!workout || !userId) return;
    const changed = ordered.some((we, i) => we.id !== workout.exercises[i]?.id);
    if (!changed) return;
    const renumbered = ordered.map((we, i) => ({ ...we, position: i }));
    setWorkout((w) => (w ? { ...w, exercises: renumbered } : w));
    await data.reorderExercises(userId, workout.id, ordered);
  }

  async function onFinish() {
    if (!workout) return;
    const pending = workout.exercises.flatMap((we) => we.sets).filter((s) => !s.completed).length;
    const done = async () => {
      // The finish is going ahead.
      emphasize();
      await data.finishWorkout(workout.id);
      // Replace, not push: the summary takes this screen's place in the
      // stack, so there is no finished workout to come back to.
      router.replace({ pathname: '/summary/[id]', params: { id: workout.id } });
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

  const isEmpty = workout != null && workout.exercises.length === 0;
  // For the picker's Recent, which leaves out what is already in the workout.
  const workoutExerciseIds = workout?.exercises.map((we) => we.exercise.id) ?? [];

  const addExerciseButton = (
    <Pressable
      onPress={() => {
        setReplacingWeId(null);
        setPickerOpen(true);
      }}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.addExercise,
        { borderColor: c.accent },
        pressed && styles.pressed,
      ]}>
      <Text style={[type.button, { color: c.accentText }]}>+ Add exercise</Text>
    </Pressable>
  );

  const closeButton = (
    // "Not now": dismisses and leaves the workout in progress. Home's
    // Resume card picks it up. The discard lives in the ⋮ menu.
    <Pressable
      onPress={() => router.dismissTo('/')}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Close workout, keep it in progress"
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <Svg width={22} height={22} viewBox="0 0 24 24">
        <Path
          d="M6 9l6 6 6-6"
          stroke={c.text2}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </Pressable>
  );

  // Same outer tree as the loaded return, so the Reveal persists and
  // crossfades. The close button is live while the workout loads.
  if (loading) {
    return (
      <View style={[styles.fill, { backgroundColor: c.bg }]}>
        <Reveal
          ready={false}
          skeleton={
            <View style={styles.fill}>
              <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
                {closeButton}
                <View style={styles.headerText}>
                  <SkeletonText variant={type.screenTitle} width="58%" />
                  <SkeletonText variant={type.meta} width="72%" />
                </View>
                <View style={styles.headerActions}>
                  <Skeleton width={36} height={36} radius={radius.input} />
                  <Skeleton width={FINISH_WIDTH} height={FINISH_HEIGHT} radius={radius.pill} />
                </View>
              </View>
              <View style={styles.list}>
                <ExerciseCardSkeleton rows={3} unit={unit} nameWidth="55%" />
                <ExerciseCardSkeleton rows={3} unit={unit} nameWidth="42%" />
              </View>
            </View>
          }
          style={styles.fill}>
          {null}
        </Reveal>
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
      <Reveal ready skeleton={null} style={styles.fill}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          {closeButton}
          <View style={styles.headerText}>
            <Text style={[type.screenTitle, { color: c.text }]}>{workout.name ?? 'Workout'}</Text>
            <Text style={[type.meta, { color: c.text2 }]}>
              <Text style={[type.restTime, { color: c.text2 }]}>
                {elapsedLabel(workout.createdAt, now)}
              </Text>
              {`  ·  ${workout.exercises.length} ${workout.exercises.length === 1 ? 'exercise' : 'exercises'}  ·  ${setsDone} ${setsDone === 1 ? 'set' : 'sets'} done`}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {/* Discard. Same confirmation rules as the old Cancel workout: an
                alert naming the completed sets when there are any, immediate
                when there are none. */}
            <Pressable
              onPress={onCancelWorkout}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Discard workout"
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
              <SymbolView
                name="trash"
                size={22}
                weight="semibold"
                tintColor={c.text2}
                fallback={<Text style={[styles.overflowGlyph, { color: c.text2 }]}>🗑</Text>}
              />
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
          ref={scrollRef}
          contentContainerStyle={[styles.list, { paddingBottom: spacing.screen + keyboardPad }]}
          keyboardShouldPersistTaps="handled"
          onScroll={(e) => {
            scrollY.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}>
          {workout.exercises.map((we) => (
            <ExerciseCard
              key={we.id}
              we={we}
              unit={unit}
              bodyweight={bodyweight}
              onOpenSheet={() => openExerciseMenu(we.id)}
              onOpenInfo={() => {
                setInfoExercise(we.exercise);
                infoRef.current?.present();
              }}
              onEditField={(setId, field) => setEditing({ setId, field })}
              registerInput={registerInput}
              onChangeField={onChangeField}
              onToggleDone={toggleDone}
              onDeleteSet={(s) => deleteSet(we.id, s)}
              onAddSet={() => void addSet(we.id)}
            />
          ))}

          {/* Empty workout: the recents list and the full-picker button sit
              together in the scroll, the two ways to add an exercise side by
              side. Once there is a card, the button returns to the pinned bar. */}
          {isEmpty && recent != null ? (
            <>
              <RecentExercises
                exercises={recent}
                busyId={addingId}
                onAdd={async (ex) => {
                  setAddingId(ex.id);
                  await onConfirmExercises([ex]);
                  setAddingId(null);
                }}
              />
              {addExerciseButton}
            </>
          ) : null}
        </ScrollView>

        {!isEmpty ? (
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            {addExerciseButton}
          </View>
        ) : null}
      </Reveal>

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

      <KeypadAccessory
        field={editing?.field ?? null}
        hasNext={nextInput() != null}
        onStep={onStep}
        onAdvance={onKeypadAdvance}
      />

      <ExerciseInfoSheet ref={infoRef} exercise={infoExercise} />

      <ReorderModal
        visible={reorderOpen}
        exercises={workout.exercises}
        onDone={(ordered) => void onReorderDone(ordered)}
      />

      <ExerciseMenuSheet
        ref={menuRef}
        exerciseName={
          workout.exercises.find((we) => we.id === menuWeId)?.exercise.name ?? ''
        }
        canReorder={workout.exercises.length >= 2}
        onAction={onMenuAction}
      />

      <ExercisePicker
        visible={pickerOpen}
        excludeIds={workoutExerciseIds}
        recentHint={recent}
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

/** The Finish pill: 15pt button text, 16pt side and 8pt top padding. */
const FINISH_WIDTH = 78;
const FINISH_HEIGHT = 35;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.sm,
  },
  headerText: { flex: 1, gap: 2 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
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
