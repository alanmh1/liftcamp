import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import {
  priorSetForPosition,
  progressionChip,
  progressionSheet,
  suggestionToWrite,
  tidyWeight,
  workoutProgress,
  type SetPlaceholder,
  type SuggestionWrite,
} from '@liftcamp/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
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
import { WorkoutProgressBar } from '@/components/workout/progress-bar';
import { RestTray } from '@/components/workout/rest-tray';
import { ProgressionSheet } from '@/components/workout/progression-sheet';
import { RestSheet } from '@/components/workout/rest-sheet';
import { readDeviceWorkout, saveDeviceWorkout } from '@/data/device-workout';
import * as data from '@/data/workouts';
import { confirm, emphasize, reward } from '@/lib/haptics';
import { cancelRestAlert, ensureRestAlertPermission, scheduleRestAlert } from '@/lib/rest-alert';
import {
  clearRunningRest,
  loadRunningRest,
  saveRunningRest,
  type RunningRest,
} from '@/lib/rest-store';
import { useProgressionGate } from '@/lib/pro';
import { useKeyboard } from '@/lib/use-keyboard';
import { showsOfflineNotice, useSyncStatus } from '@/lib/use-sync-status';
import type { ActiveWorkout, ExerciseInfo, WorkoutExercise, WorkoutSet } from '@/data/workouts';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/** Rest for an exercise with no saved rest of its own. */
const DEFAULT_REST_SECONDS = 120;
/** The bounds on a rest's length, matching the exercise_rest_prefs CHECK. */
const MIN_REST_SECONDS = 15;
const MAX_REST_SECONDS = 900;

function clampRest(seconds: number): number {
  return Math.min(MAX_REST_SECONDS, Math.max(MIN_REST_SECONDS, seconds));
}

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
/**
 * Workouts whose progression chip has played its first-appearance moment
 * in this run of the app, so it plays once per workout and not on every
 * remount of the screen.
 */
const progressionIntroPlayed = new Set<string>();

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
  // Set once the workout is finished or discarded here: the phone's copy is
  // then left alone, and a second Finish tap does nothing.
  const ended = useRef(false);
  // The latest workout, for patchSet, which keeps one identity across edits,
  // and for the save when the app goes to the background.
  const workoutRef = useRef<ActiveWorkout | null>(null);
  useEffect(() => {
    workoutRef.current = workout;
  }, [workout]);
  // Whether the screen opened from the phone's copy, and whether the user has
  // changed anything since. Decides what the server read may replace.
  const fromDevice = useRef(false);
  const edited = useRef(false);
  /** setWorkout for a change the user made. */
  const editWorkout = useCallback((fn: (w: ActiveWorkout | null) => ActiveWorkout | null) => {
    edited.current = true;
    setWorkout(fn);
  }, []);
  const [loading, setLoading] = useState(true);
  const [bodyweight, setBodyweight] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  // Rest timer. A plain JS interval in the foreground; behind a locked screen
  // or another app, the rest-end alert (lib/rest-alert) buzzes. Saved per workout
  // (lib/rest-store.ts), so leaving the screen and resuming keeps it.
  const [rest, setRest] = useState<RunningRest | null>(null);
  // False until the saved rest is read, so the save effect cannot clear the
  // record before it has been restored.
  const [restLoaded, setRestLoaded] = useState(false);
  // Saved rest per exercise id. Empty until read, or if the read fails.
  const [restPrefs, setRestPrefs] = useState<Map<string, number>>(() => new Map());
  const restSheetRef = useRef<SheetRef>(null);

  const [editing, setEditing] = useState<{ setId: string; field: EditField } | null>(null);
  // Every set row's two inputs, so the keypad bar's Next can move focus. Keyed
  // `${setId}:${field}`; rows register on mount and null out on unmount.
  const inputRefs = useRef(new Map<string, TextInput>());
  // Sets whose PR has already buzzed this session, so un-checking and
  // re-checking a PR set does not reward it twice.
  const rewardedPrSets = useRef(new Set<string>());
  // The set whose check was refused for want of a weight. Its row shows a
  // hint until it is logged or the user moves on to another set.
  const [weightHint, setWeightHint] = useState<string | null>(null);
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
  // The rest tray's height while it is up, and the Add exercise bar's, so
  // the list is padded by the part of the tray that overhangs the bar.
  const [trayHeight, setTrayHeight] = useState(0);
  const [barHeight, setBarHeight] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  // For the empty state. Null until loaded, so the empty message does not
  // flash before the list arrives.
  const [recent, setRecent] = useState<ExerciseInfo[] | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const menuRef = useRef<SheetRef>(null);
  const [menuWeId, setMenuWeId] = useState<string | null>(null);
  const [reorderOpen, setReorderOpen] = useState(false);
  const infoRef = useRef<SheetRef>(null);
  // Pro: the progression sheet, and the card whose chip opened it.
  const progressionRef = useRef<SheetRef>(null);
  const [progressionWeId, setProgressionWeId] = useState<string | null>(null);
  // Pro: the one card whose chip plays the first-appearance moment.
  const [introWeId, setIntroWeId] = useState<string | null>(null);
  const [infoExercise, setInfoExercise] = useState<ExerciseInfo | null>(null);
  const [replacingWeId, setReplacingWeId] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ weId: string; set: WorkoutSet } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { label: unit, unit: weightUnit, loading: unitLoading } = useWeightUnit();
  const progressionOpen = useProgressionGate();
  const sync = useSyncStatus();

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
    fromDevice.current = false;
    edited.current = false;
    let serverDone = false;
    // The phone's copy first, so a workout just started, or reopened with no
    // signal, is on screen at once. Not over a workout already showing,
    // which is a reload for a unit change.
    void readDeviceWorkout(userId, id, weightUnit).then((copy) => {
      if (cancelled || serverDone || !copy || workoutRef.current) return;
      fromDevice.current = true;
      setWorkout(copy);
      setBodyweight(copy.bodyweight);
      setLoading(false);
    });
    // Then the server's rows with the phone's queued writes over them, and
    // the prior sessions and PR baselines, which only the server has.
    data.loadWorkout(userId, id, weightUnit).then((w) => {
      if (cancelled) return;
      serverDone = true;
      if (!fromDevice.current) {
        setWorkout(w);
        setBodyweight(w?.bodyweight ?? null);
      } else if (w) {
        // Untouched, the server's version is the whole truth (it includes
        // every queued write). Touched, only what the phone cannot know.
        setWorkout((cur) => (cur && edited.current ? data.withServerDetails(cur, w) : w));
        setBodyweight(w.bodyweight);
      }
      // No server version (no signal): the phone's copy stands.
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, id, weightUnit, unitLoading]);

  // The phone's copy, saved 300 ms after the last change and whenever the
  // app leaves the foreground, so the workout reopens at once and with no
  // signal. Never once the workout has ended here.
  useEffect(() => {
    if (!userId || !workout || workout.finishedAt || unitLoading) return;
    const t = setTimeout(() => {
      if (!ended.current) void saveDeviceWorkout(userId, weightUnit, workout);
    }, 300);
    return () => clearTimeout(t);
  }, [userId, workout, weightUnit, unitLoading]);

  useEffect(() => {
    if (!userId || unitLoading) return;
    const sub = AppState.addEventListener('change', (state) => {
      const w = workoutRef.current;
      if (state !== 'active' && w && !w.finishedAt && !ended.current) void saveDeviceWorkout(userId, weightUnit, w);
    });
    return () => sub.remove();
  }, [userId, weightUnit, unitLoading]);

  // One ticker drives both the elapsed clock and the rest ring.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // The rest timer running out on its own, not skipped, buzzes. Taking it
  // to zero with −15, in the tray or the sheet, is a skip and does not.
  // Foreground only: the ticker stops in the background.
  useEffect(() => {
    if (rest != null && now >= rest.endsAt) {
      setRest(null);
      restSheetRef.current?.dismiss();
      reward();
    }
  }, [now, rest]);

  // A rest still running when the screen was left comes back. A set checked
  // before the read lands wins over the saved one.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void loadRunningRest(id).then((saved) => {
      if (cancelled) return;
      if (saved) setRest((current) => current ?? saved);
      setRestLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // The rest's exercise by name, for the rest-end alert's body. A string, so
  // editing sets does not reschedule the alert; it changes only when the
  // workout's read lands after a rest restored from the phone.
  const restExerciseName =
    rest?.exerciseId != null
      ? (workout?.exercises.find((we) => we.exercise.id === rest.exerciseId)?.exercise.name ?? null)
      : null;

  // Every start, change, end and skip is saved, so the record always matches
  // the row, and the rest-end alert (lib/rest-alert) is rescheduled or
  // cancelled with it. Finishing or discarding the workout clears both in
  // data/workouts. The alert calls queue in order, so the permission ask
  // runs before the schedule and a later cancel runs after it.
  useEffect(() => {
    if (!id || !restLoaded) return;
    if (rest) {
      void saveRunningRest(id, rest);
      void ensureRestAlertPermission();
      void scheduleRestAlert({ workoutId: id, endsAt: rest.endsAt, exerciseName: restExerciseName });
    } else {
      void clearRunningRest(id);
      void cancelRestAlert(id);
    }
  }, [id, rest, restLoaded, restExerciseName]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void data.getRestPrefs(userId).then((prefs) => {
      if (!cancelled) setRestPrefs(prefs);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

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

  // A keyboard that goes away by any route (a tap on empty space in the
  // list, Done, a sheet opening) leaves no set being edited. Moving focus
  // from one box to another keeps the keyboard up and fires no hide, and on
  // the platforms that do fire one the next box is already focused, so the
  // check on focus leaves `editing` alone then.
  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const sub = Keyboard.addListener(event, () => {
      const focused = [...inputRefs.current.values()].some((input) => input.isFocused());
      if (!focused) setEditing(null);
    });
    return () => sub.remove();
  }, []);

  /**
   * Puts the keypad away and clears the set being edited. Everything that
   * opens over this screen (a sheet, the picker, the reorder screen, an
   * alert) or leaves it calls this first, so the keypad never sits on top.
   */
  function dismissKeyboard() {
    Keyboard.dismiss();
    setEditing(null);
  }

  /** Applies a change to one set in local state, then persists it. */
  const patchSet = useCallback(
    (setId: string, patch: Partial<WorkoutSet>, persist = true, suggestion: SuggestionWrite | null = null) => {
      editWorkout((w) =>
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
      if (!persist || !userId) return;
      // Where the set sits, so the queue can drop this write if its exercise
      // or workout goes before it is sent.
      const w = workoutRef.current;
      const we = w?.exercises.find((x) => x.sets.some((s) => s.id === setId));
      if (w && we) {
        void data.updateSet(userId, { workoutId: w.id, workoutExerciseId: we.id, setId }, patch, weightUnit, suggestion);
      }
    },
    [weightUnit, userId, editWorkout],
  );

  function onChangeField(setId: string, field: EditField, raw: string) {
    const value = parseNumeric(raw, field === 'reps');
    // Typing is an edit: the weight is now the typed value in the current
    // unit, not the converted source it was seeded from.
    patchSet(setId, field === 'weight' ? { weight_value: value, stored: null } : { reps: value });
  }

  /**
   * The suggestion a set's row shows, as its tick writes it. Null unless
   * the gate is open, so a free tick writes nothing new.
   */
  function suggestionOf(setId: string): SuggestionWrite | null {
    const we = workout?.exercises.find((x) => x.sets.some((s) => s.id === setId));
    if (!we) return null;
    const progression = data.progressionFor(we, weightUnit, progressionOpen);
    return suggestionToWrite(progression?.sets[we.sets.findIndex((s) => s.id === setId)], weightUnit);
  }

  /** The placeholder a set's empty boxes show, worked out the way its card does. */
  function placeholderOf(setId: string): SetPlaceholder | null {
    const we = workout?.exercises.find((x) => x.sets.some((s) => s.id === setId));
    if (!we) return null;
    const progression = data.progressionFor(we, weightUnit, progressionOpen);
    return data.placeholdersFor(we, progression)[we.sets.findIndex((s) => s.id === setId)] ?? null;
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
   * on is not logged; the weight box takes focus and the row says why, so a
   * first session's tap is never silent. Anything else with nothing to fall
   * back on logs as it stands, as before.
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
      setWeightHint(set.id);
      inputRefs.current.get(`${set.id}:weight`)?.focus();
      return;
    }
    setWeightHint((h) => (h === set.id ? null : h));
    patchSet(set.id, patch, true, suggestionOf(set.id));
    // One buzz per check: the PR success pattern when this set becomes a
    // PR for the first time this session, else the light confirmation.
    // Never on un-check.
    if (becomesPr(set, patch)) reward();
    else confirm();
    // The exercise's saved rest, else the default.
    const exerciseId =
      workout?.exercises.find((we) => we.sets.some((s) => s.id === set.id))?.exercise.id ?? null;
    const length = (exerciseId != null ? restPrefs.get(exerciseId) : undefined) ?? DEFAULT_REST_SECONDS;
    setRest({ endsAt: Date.now() + length * 1000, total: length, exerciseId });
  }

  /** Whether the running rest's exercise has a saved rest, which the sheet's toggle shows. */
  const restSaved = rest?.exerciseId != null && restPrefs.has(rest.exerciseId);

  /** Saves, or with null forgets, an exercise's rest. Optimistic; undone if the write fails. */
  async function saveRestPref(exerciseId: string, seconds: number | null) {
    if (!userId) return;
    const before = restPrefs;
    const next = new Map(before);
    if (seconds == null) next.delete(exerciseId);
    else next.set(exerciseId, seconds);
    setRestPrefs(next);
    if (!(await data.setRestPref(userId, exerciseId, seconds))) {
      setRestPrefs(before);
      Alert.alert('Could not save that rest.', 'Try again.');
    }
  }

  /**
   * Applies a change from the rest sheet. A rest pushed to or past zero is
   * skipped, without the rest-end buzz. With the exercise's rest saved, the
   * new length is saved too.
   */
  function changeRest(next: RunningRest | null) {
    if (next && next.endsAt <= Date.now()) next = null;
    setRest(next);
    if (!next) {
      restSheetRef.current?.dismiss();
      return;
    }
    if (restSaved && next.exerciseId && next.total !== rest?.total) {
      void saveRestPref(next.exerciseId, next.total);
    }
  }

  function adjustRest(delta: number) {
    if (!rest) return;
    changeRest({ ...rest, endsAt: rest.endsAt + delta * 1000, total: clampRest(rest.total + delta) });
  }

  /**
   * The tray's −15 and +15. They change this rest only, never the
   * exercise's saved rest, even with "Remember for <exercise>" on; saving
   * stays in the sheet. Taking it to zero ends it silently, as Skip and the
   * sheet's ±15 do (changeRest).
   */
  function trayAdjust(delta: number) {
    if (!rest) return;
    const next = { ...rest, endsAt: rest.endsAt + delta * 1000, total: clampRest(rest.total + delta) };
    if (next.endsAt <= Date.now()) changeRest(null);
    else setRest(next);
  }

  /** A preset sets the rest's full length, counted from when it started. */
  function presetRest(seconds: number) {
    if (!rest) return;
    const startedAt = rest.endsAt - rest.total * 1000;
    changeRest({ ...rest, endsAt: startedAt + seconds * 1000, total: seconds });
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
   * The set being edited, when its check was refused for want of a weight
   * and it now has a weight and reps, typed or from placeholders. The bar
   * reads Done for it and logs it, since the user already asked to.
   */
  function hintedSetReady(): { set: WorkoutSet; placeholder: SetPlaceholder | null } | null {
    if (!editing || editing.setId !== weightHint || !workout) return null;
    const set = workout.exercises.flatMap((we) => we.sets).find((s) => s.id === editing.setId);
    if (!set || set.completed) return null;
    const placeholder = placeholderOf(set.id);
    if ((set.weight_value ?? placeholder?.weight?.value) == null) return null;
    if ((set.reps ?? placeholder?.reps) == null) return null;
    return { set, placeholder };
  }

  /**
   * Next or Done on the keypad bar. Focus only: Next moves to the following
   * input, whose onFocus updates `editing`, and Done dismisses. Neither marks
   * a set complete; that stays an explicit tap on the check control, so a
   * user stepping through prefilled values cannot log a set by accident. The
   * one exception is a set whose check was refused for want of a weight:
   * once it has one, Done logs it.
   */
  function onKeypadAdvance() {
    const hinted = hintedSetReady();
    if (hinted) {
      toggleDone(hinted.set, hinted.placeholder, true);
      dismissKeyboard();
      return;
    }
    const target = nextInput();
    if (target) {
      inputRefs.current.get(`${target.setId}:${target.field}`)?.focus();
      return;
    }
    dismissKeyboard();
  }

  function deleteSet(weId: string, set: WorkoutSet) {
    editWorkout((w) =>
      w
        ? {
            ...w,
            exercises: w.exercises.map((we) =>
              we.id === weId ? { ...we, sets: we.sets.filter((s) => s.id !== set.id) } : we,
            ),
          }
        : w,
    );
    if (userId && workout) {
      void data.deleteSet(userId, { workoutId: workout.id, workoutExerciseId: weId, setId: set.id });
    }
    setUndo({ weId, set });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  }

  async function restoreDeleted() {
    if (!undo || !userId || !workout) return;
    await data.restoreSet(userId, workout.id, undo.weId, undo.set, weightUnit);
    editWorkout((w) =>
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
    const created = await data.addSet(userId, workout.id, weId, position, {
      weight_value: source?.weight_value ?? null,
      reps: source?.reps ?? null,
      stored: source?.stored ?? null,
    }, weightUnit);
    editWorkout((w) =>
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
        await data.replaceExercise(userId, workout.id, replacingWeId, exercise);
        editWorkout((w) =>
          w
            ? {
                ...w,
                exercises: w.exercises.map((we) =>
                  // The history was the replaced exercise's, so progression
                  // waits for the next server read of this one.
                  we.id === replacingWeId ? { ...we, exercise, history: [] } : we,
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
      editWorkout((w) => (w ? { ...w, exercises: [...w.exercises, added] } : w));
    }
  }

  async function runExerciseAction(weId: string, action: ExerciseAction) {
    if (!workout || !userId) return;

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
      await data.removeExercise(userId, workout.id, weId);
      editWorkout((w) =>
        w ? { ...w, exercises: w.exercises.filter((we) => we.id !== weId) } : w,
      );
      return;
    }
    if (action === 'note') {
      Alert.alert('Add note', 'Exercise notes arrive with the exercise detail sheet.');
    }
  }

  function openExerciseMenu(weId: string) {
    dismissKeyboard();
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
    if (!workout || !userId) return;
    dismissKeyboard();
    const completed = workout.exercises.flatMap((we) => we.sets).filter((s) => s.completed).length;

    const discard = async () => {
      ended.current = true;
      // Same delete path the Resume card's swipe uses; children cascade.
      await data.discardWorkout(userId, workout.id);
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
    editWorkout((w) => (w ? { ...w, exercises: renumbered } : w));
    await data.reorderExercises(userId, workout.id, ordered);
  }

  async function onFinish() {
    if (!workout || !userId) return;
    dismissKeyboard();
    const pending = workout.exercises.flatMap((we) => we.sets).filter((s) => !s.completed).length;
    const done = async () => {
      // A second tap while the first waits on the server does nothing.
      if (ended.current) return;
      ended.current = true;
      // The finish is going ahead.
      emphasize();
      // Waits a moment for the server, so with signal the summary reads a
      // complete workout. Without, the summary draws from the phone's copy.
      await data.finishWorkout(userId, workout, weightUnit);
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
  const offline = showsOfflineNotice(sync, now);
  // For the picker's Recent, which leaves out what is already in the workout.
  const workoutExerciseIds = workout?.exercises.map((we) => we.exercise.id) ?? [];

  const addExerciseButton = (
    <Pressable
      onPress={() => {
        dismissKeyboard();
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
      onPress={() => {
        dismissKeyboard();
        router.dismissTo('/');
      }}
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
  // The first card, in order, with a progression chip plays its moment,
  // once per workout. Chosen once and kept, so a chip that appears higher up
  // later (its history read landed after) does not cut the moment short.
  useEffect(() => {
    if (!workout || !progressionOpen || introWeId || progressionIntroPlayed.has(workout.id)) return;
    const first = workout.exercises.find((we) => {
      const p = data.progressionFor(we, weightUnit, true);
      return p != null && progressionChip(p, we.exercise, weightUnit) != null;
    });
    if (first) setIntroWeId(first.id);
  }, [workout, progressionOpen, introWeId, weightUnit]);

  const progressionModel = (() => {
    const we = workout?.exercises.find((x) => x.id === progressionWeId);
    if (!we) return null;
    const p = data.progressionFor(we, weightUnit, progressionOpen);
    return p ? progressionSheet(p, we.exercise, weightUnit) : null;
  })();

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
  const restRemaining = rest != null ? (rest.endsAt - now) / 1000 : 0;
  const progress = workoutProgress(workout.exercises);

  return (
    // A tap on anything that does not handle it (the header's text, the
    // space around the buttons) puts the keypad away. Taps on empty space in
    // the list are the scroll view's, which does the same through
    // keyboardShouldPersistTaps="handled".
    <View
      style={[styles.fill, { backgroundColor: c.bg }]}
      onStartShouldSetResponder={() => keyboard.top != null}
      onResponderRelease={dismissKeyboard}>
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
        {/* The header's bottom edge: full bleed, outside its padding. */}
        <WorkoutProgressBar progress={progress} />

        {/* After 5 s of failed sends with writes waiting. Clears on the first
            send that lands. The ticker's `now` keeps it current. */}
        {offline ? (
          <View style={[styles.syncLine, { borderColor: c.border }]}>
            <Text style={[type.meta, { color: c.text2 }]}>Offline. Saved on this phone.</Text>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.list,
            {
              paddingBottom:
                spacing.screen + keyboardPad + Math.max(0, trayHeight - (isEmpty ? 0 : barHeight)),
            },
          ]}
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
                dismissKeyboard();
                setInfoExercise(we.exercise);
                infoRef.current?.present();
              }}
              onEditField={(setId, field) => {
                setEditing({ setId, field });
                setWeightHint((h) => (h === setId ? h : null));
              }}
              registerInput={registerInput}
              weightHintSetId={weightHint}
              onChangeField={onChangeField}
              onToggleDone={toggleDone}
              onDeleteSet={(s) => deleteSet(we.id, s)}
              onAddSet={() => void addSet(we.id)}
              onOpenProgression={() => {
                dismissKeyboard();
                setProgressionWeId(we.id);
                progressionRef.current?.present();
              }}
              introChip={we.id === introWeId}
              onIntroDone={() => {
                progressionIntroPlayed.add(workout.id);
                setIntroWeId(null);
              }}
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
          <View
            onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}
            style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            {addExerciseButton}
          </View>
        ) : null}

        {/* Over the Add exercise bar while a rest runs. Not modal. */}
        <RestTray
          active={rest != null}
          remaining={restRemaining}
          total={rest?.total ?? DEFAULT_REST_SECONDS}
          bottomInset={insets.bottom}
          onAdjust={trayAdjust}
          onSkip={() => changeRest(null)}
          onOpenOptions={() => {
            dismissKeyboard();
            restSheetRef.current?.present();
          }}
          onHeight={setTrayHeight}
        />
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
        hasNext={hintedSetReady() == null && nextInput() != null}
        onStep={onStep}
        onAdvance={onKeypadAdvance}
      />

      <ExerciseInfoSheet ref={infoRef} exercise={infoExercise} />

      <RestSheet
        ref={restSheetRef}
        remaining={restRemaining}
        total={rest?.total ?? DEFAULT_REST_SECONDS}
        exerciseName={
          workout.exercises.find((we) => we.exercise.id === rest?.exerciseId)?.exercise.name ?? null
        }
        savedForExercise={restSaved}
        onAdjust={adjustRest}
        onPreset={presetRest}
        onSaveForExercise={(save) => {
          if (rest?.exerciseId) void saveRestPref(rest.exerciseId, save ? rest.total : null);
        }}
        onSkip={() => changeRest(null)}
      />

      <ProgressionSheet
        ref={progressionRef}
        model={progressionModel}
        onDone={() => progressionRef.current?.dismiss()}
        onHowItWorks={() => {
          progressionRef.current?.dismiss();
          router.push('/progression-guide');
        }}
      />

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
  syncLine: {
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
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
