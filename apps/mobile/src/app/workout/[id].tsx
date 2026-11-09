import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import {
  cleanDecimal,
  countedSets,
  distanceToMeters,
  hasIncline,
  isCardio,
  isWarmupSet,
  KEYPAD_STEPS,
  nextSetPosition,
  availablePlates,
  barWeight,
  barWeightFor,
  keypadWeightStep,
  usesBar,
  parseDecimal,
  priorSetForRow,
  progressionChip,
  progressionSheet,
  restoredSetPosition,
  steppedWeight,
  suggestionToWrite,
  suggestionsForRows,
  timerSeconds,
  WARMUP_SET_TYPE,
  WORKING_SET_TYPE,
  withPriorRead,
  withReplacedExercise,
  workoutProgress,
  type SetPlaceholder,
  type SuggestionWrite,
} from '@liftcamp/shared';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
// RNGH's ScrollView, not React Native's. The set rows are ReanimatedSwipeable,
// and a core ScrollView does not negotiate with an RNGH pan: the swipe gesture
// claims the touch and vertical scrolling dies. RNGH's own ScrollView composes
// with them.
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SheetRef } from '@/components/BottomSheet';
import { useAuth } from '@/components/auth-provider';
import { useNavHref } from '@/components/tab-layout';
import { useWeightUnit } from '@/components/unit-provider';
import { ExerciseInfoSheet, type InfoSection } from '@/components/exercise-info-sheet';
import {
  ExerciseMenuSheet,
  type ExerciseAction,
} from '@/components/workout/exercise-menu-sheet';
import { Reveal, Skeleton, SkeletonText } from '@/components/skeleton';
import { Text, TextInput } from '@/components/text';
import { ExerciseCard, ExerciseCardSkeleton } from '@/components/workout/exercise-card';
import { ExercisePicker } from '@/components/workout/exercise-picker';
import { FirstSessionBanner } from '@/components/workout/first-session-banner';
import { CollapseChevron } from '@/components/workout/collapse-chevron';
import { ACCESSORY_HEIGHT, KeypadAccessory, type EditField } from '@/components/workout/keypad-accessory';
import { ReorderModal } from '@/components/workout/reorder-modal';
import { RecentExercises } from '@/components/workout/recent-exercises';
import { WorkoutProgressBar } from '@/components/workout/progress-bar';
import { RestTray } from '@/components/workout/rest-tray';
import { PlateSheet, type PlateTarget } from '@/components/plate-sheet';
import { ProgressionSheet } from '@/components/workout/progression-sheet';
import { RestSheet } from '@/components/workout/rest-sheet';
import { SetTypeSheet, type SetKind } from '@/components/workout/set-type-sheet';
import { LastTimeNote, WorkoutNoteRow, WorkoutNoteSheet } from '@/components/workout/workout-note';
import {
  readDeviceWorkout,
  readRemovedWarmups,
  saveDeviceWorkout,
  saveRemovedWarmups,
} from '@/data/device-workout';
import { loadProInputs } from '@/data/pro-inputs';
import { localRoutineNote, serverRoutineNote } from '@/data/routine-note';
import * as data from '@/data/workouts';
import { beginDraft, commitDraft, discardDraft, draftBodies, draftHasChanges, syncedWithin } from '@/data/write-queue';
import { EVENTS, track } from '@/lib/analytics';
import { confirm, emphasize, reward } from '@/lib/haptics';
import { syncWorkoutActivity } from '@/lib/live-activity';
import { cancelRestAlert, ensureRestAlertPermission, scheduleRestAlert } from '@/lib/rest-alert';
import {
  clearRunningRest,
  loadRunningRest,
  saveRunningRest,
  type RunningRest,
} from '@/lib/rest-store';
import { useProgressionGate } from '@/lib/pro';
import { setProInputs, useProInputs } from '@/lib/pro-inputs';
import { markWarmupNoteSeen, markWarmupTipSeen, warmupNoteSeen, warmupTipSeen } from '@/lib/warmup-note';
import { useKeyboardOverlap } from '@/lib/keyboard-overlap';
import { useKeyboard } from '@/lib/use-keyboard';
import { showsOfflineNotice, useSyncStatus } from '@/lib/use-sync-status';
import type { ActiveWorkout, ExerciseInfo, WorkoutExercise, WorkoutSet } from '@/data/workouts';
import { dateLine } from '@/lib/workout-date-line';
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

/** How long Save on an edit waits for the server before closing without it. */
const SAVE_WAIT_MS = 3000;

/**
 * Android: how long a focused set field waits for an on-screen keyboard
 * before the keypad bar is shown without one (a hardware keyboard). A soft
 * keyboard reports itself well within this.
 */
const ANDROID_NO_IME_MS = 500;

function elapsedLabel(fromIso: string, now: number): string {
  const secs = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Parses a keypad string. Empty clears the value rather than writing 0. A
 * weight goes through cleanDecimal and parseDecimal, so a comma from a
 * comma-locale decimal pad reads as the decimal point: "68,2" is 68.2.
 */
function parseNumeric(raw: string, integer: boolean): number | null {
  if (!integer) return parseDecimal(cleanDecimal(raw, 2));
  const cleaned = raw.replace(/[^0-9]/g, '');
  if (!cleaned) return null;
  const n = Number.parseInt(cleaned, 10);
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

/** A card with no row typed, ticked, noted or given a type, by the app or the user. */
function untouched(we: WorkoutExercise): boolean {
  return we.sets.every(
    (s) =>
      !s.completed &&
      s.weight_value == null &&
      s.reps == null &&
      s.duration_seconds == null &&
      s.distance_meters == null &&
      s.incline_percent == null &&
      !s.note &&
      !s.set_type,
  );
}

export default function ActiveWorkoutScreen() {
  return (
    <SafeAreaProvider>
      <BottomSheetModalProvider>
        <ActiveWorkoutContent />
      </BottomSheetModalProvider>
    </SafeAreaProvider>
  );
}

/**
 * Edit mode, `/workout/[id]?mode=edit`, opened from a finished workout's
 * detail only. The same screen with Cancel and Save in the header: every
 * write waits in the write queue's draft (data/write-queue.ts) and is
 * queued on Save, or dropped on Cancel. Off while editing: rest, the Live
 * Activity, the phone's copy, the first-session banner, Last time, the
 * starting-weight link, Pro progression and warm-up rows, the PR haptic,
 * and everything Finish does. The date, name and routine link stay as they
 * are. The param is ignored for a workout that is not finished, so a live
 * workout never enters edit mode.
 */
function ActiveWorkoutContent() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const editRequested = mode === 'edit';
  const { session } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const navHref = useNavHref();
  const c = useColors();
  // From the SafeAreaProvider this screen mounts for itself (see the default
  // export), so these are the modal's own insets, not the root view's.
  const insets = useSafeAreaInsets();
  const userId = session?.user.id;

  const [workout, setWorkout] = useState<ActiveWorkout | null>(null);
  // Editing a finished workout. Until the workout loads, an edit request
  // keeps the live-only work (rest, Live Activity) off too, so nothing
  // starts that edit mode would then have to undo.
  const editMode = editRequested && workout?.finishedAt != null;
  const liveOff = editMode || (editRequested && workout == null);
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
  // The rest that last ended (ran out or skipped), until the next check
  // starts another. The Live Activity keeps showing the set it led to, as
  // UP NEXT, until that set is done. Not saved: after a relaunch the
  // activity shows the set the workout is on.
  const [restEnded, setRestEnded] = useState<{ exerciseId: string | null } | null>(null);
  const lastRest = useRef<RunningRest | null>(null);
  useEffect(() => {
    if (rest) setRestEnded(null);
    else if (lastRest.current) setRestEnded({ exerciseId: lastRest.current.exerciseId });
    lastRest.current = rest;
  }, [rest]);
  // Saved rest per exercise id. Empty until read, or if the read fails.
  const [restPrefs, setRestPrefs] = useState<Map<string, number>>(() => new Map());
  const restSheetRef = useRef<SheetRef>(null);

  const [editing, setEditing] = useState<{ setId: string; field: EditField } | null>(null);
  // Every set row's two inputs, so the keypad bar's Next can move focus. Keyed
  // `${setId}:${field}`; rows register on mount and null out on unmount.
  const inputRefs = useRef(new Map<string, TextInput>());
  // The keypad tray's percent box. While it has the focus, the weight box
  // in `editing` is still the one being edited.
  const percentInputRef = useRef<TextInput>(null);
  // Sets whose PR has already buzzed this session, so un-checking and
  // re-checking a PR set does not reward it twice.
  const rewardedPrSets = useRef(new Set<string>());
  // The set whose check was refused for want of a value, and the field it
  // wants. Its row shows a hint until it is logged or the user moves on to
  // another set.
  const [fieldHint, setFieldHint] = useState<{ setId: string; field: EditField } | null>(null);
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
  // Android: what the keypad row floats on, in points up from the bottom of
  // the screen, or null while it is hidden. The row sits a small gap above
  // it, and ACCESSORY_HEIGHT includes that gap. Nothing is assumed about the window
  // resizing: `keyboardArea.overlap` is how far the docked keyboard covers
  // this screen, measured (0 when the window was resized above it), and the
  // bar sits on it. A floating keyboard, or a hardware one that brings up
  // no on-screen keyboard and sends no event, covers nothing, so the bar
  // sits on the bottom safe-area inset, clear of the gesture bar. The
  // hardware case waits ANDROID_NO_IME_MS for a keyboard first, so a soft
  // keyboard on its way does not show the bar at the bottom for a moment.
  const rootRef = useRef<View>(null);
  const keyboardArea = useKeyboardOverlap(rootRef, editing != null);
  const [noIme, setNoIme] = useState(false);
  const isEditing = editing != null;
  useEffect(() => {
    setNoIme(false);
    if (Platform.OS !== 'android' || !isEditing || keyboard.top != null) return;
    const timer = setTimeout(() => setNoIme(true), ANDROID_NO_IME_MS);
    return () => clearTimeout(timer);
  }, [isEditing, keyboard.top]);
  const androidBar: number | null =
    Platform.OS !== 'android' || !isEditing
      ? null
      : keyboardArea.docked
        ? keyboardArea.overlap
        : keyboard.top != null || noIme
          ? insets.bottom
          : null;
  // Whether the keypad row is up, worked out as KeypadAccessory works it out.
  const keypadShown = Platform.OS === 'android' ? androidBar != null : isEditing && keyboard.top != null;
  // iOS lays the keyboard over the view, so the padding is the keyboard
  // plus the bar. Android's is the bar's measured position plus the bar.
  const keyboardPad =
    Platform.OS === 'android'
      ? androidBar == null
        ? 0
        : androidBar + ACCESSORY_HEIGHT
      : keyboard.top == null
        ? 0
        : keyboard.height + ACCESSORY_HEIGHT;
  // The rest tray's height while it is up, so the list is padded by it and
  // the last card and Add exercise scroll clear of the tray.
  const [trayHeight, setTrayHeight] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  // For the empty state. Null until loaded, so the empty message does not
  // flash before the list arrives.
  const [recent, setRecent] = useState<ExerciseInfo[] | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const menuRef = useRef<SheetRef>(null);
  const noteSheetRef = useRef<SheetRef>(null);
  // "Last time": the note from the last finished workout of this routine
  // day. Null when there is none, or the workout is not from a routine.
  const [lastNote, setLastNote] = useState<string | null>(null);
  const [menuWeId, setMenuWeId] = useState<string | null>(null);
  const [reorderOpen, setReorderOpen] = useState(false);
  const infoRef = useRef<SheetRef>(null);
  // Pro: the progression sheet, and the card whose chip opened it.
  const progressionRef = useRef<SheetRef>(null);
  const [progressionWeId, setProgressionWeId] = useState<string | null>(null);
  // The sheet's warm-up line shows the first time only.
  const [showWarmupNote, setShowWarmupNote] = useState(false);
  // The set type sheet, and the row whose badge opened it.
  const setTypeRef = useRef<SheetRef>(null);
  const [setTypeId, setSetTypeId] = useState<string | null>(null);
  // Pro: the card carrying the one-time warm-up tip, and whether this
  // screen has already asked if it was seen.
  const [warmupTipWeId, setWarmupTipWeId] = useState<string | null>(null);
  const warmupTipAsked = useRef(false);
  // The exercises whose warm-up rows were deleted from this workout, which
  // are not generated again. Null until read, so nothing is generated first.
  const [removedWarmups, setRemovedWarmups] = useState<Set<string> | null>(null);
  // Pro: the plate calculator, and the box it puts a weight in (null when
  // opened from a logged set, which it never changes).
  const plateRef = useRef<SheetRef>(null);
  const [plateTarget, setPlateTarget] = useState<PlateTarget | null>(null);
  const [plateSetId, setPlateSetId] = useState<string | null>(null);
  // Pro: the one card whose chip plays the first-appearance moment.
  const [introWeId, setIntroWeId] = useState<string | null>(null);
  const [infoExercise, setInfoExercise] = useState<ExerciseInfo | null>(null);
  // The section the info sheet opens at, and the box that gets the cursor
  // back when it closes: set by a hint's "How to pick a starting weight".
  const [infoScrollTo, setInfoScrollTo] = useState<InfoSection | null>(null);
  const refocusAfterInfo = useRef<string | null>(null);
  const [replacingWeId, setReplacingWeId] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ weId: string; set: WorkoutSet } | null>(null);
  // An exercise add in progress, which reads before it writes.
  const adding = useRef<Promise<void> | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unitNow = useWeightUnit();
  // Edit mode reads the workout once, in the unit it opened with, and keeps
  // that unit for display and writes, so a unit change mid-edit reloads
  // nothing and mislabels nothing.
  const pinnedUnit = useRef<typeof unitNow | null>(null);
  if (editRequested && !unitNow.loading && pinnedUnit.current == null) pinnedUnit.current = unitNow;
  const { label: unit, unit: weightUnit, loading: unitLoading } =
    editRequested && pinnedUnit.current ? pinnedUnit.current : unitNow;
  // The Pro gate. Edit mode keeps the plate sheet and turns progression off.
  const proGate = useProgressionGate();
  const progressionOpen = proGate && !editMode;
  const proInputs = useProInputs();
  // True once the server's read has landed with the prior sessions, which
  // is when an exercise with no history is known to be new to the user.
  const [serverLoaded, setServerLoaded] = useState(false);
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
    setServerLoaded(false);
    let serverDone = false;
    // The phone's copy first, so a workout just started, or reopened with no
    // signal, is on screen at once. Not over a workout already showing,
    // which is a reload for a unit change. Not for an edit, which reads
    // the server's rows with the queue over them, once.
    if (!editRequested) {
      void readDeviceWorkout(userId, id, weightUnit).then((copy) => {
        if (cancelled || serverDone || !copy || workoutRef.current) return;
        fromDevice.current = true;
        setWorkout(copy);
        setBodyweight(copy.bodyweight);
        setLoading(false);
      });
    }
    // Then the server's rows with the phone's queued writes over them, and
    // the prior sessions and PR baselines, which only the server has.
    data.loadWorkout(userId, id, weightUnit, { earlierOnly: editRequested }).then((w) => {
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
      if (w) setServerLoaded(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, id, weightUnit, unitLoading, editRequested]);

  // The draft: open from the moment the finished workout is on screen, so
  // the first change is already held. Leaving without Save drops it.
  const saved = useRef(false);
  useEffect(() => {
    if (!editMode || !userId || !workoutRef.current) return;
    beginDraft(userId, workoutRef.current.id);
    return () => {
      if (!saved.current) discardDraft();
    };
  }, [editMode, userId]);

  // The phone's answer at once, then the server's when it lands. With no
  // signal the server read gives nothing and the phone's answer stays.
  const workoutId = workout?.id;
  const templateId = workout?.templateId ?? null;
  useEffect(() => {
    setLastNote(null);
    if (!userId || !workoutId || !templateId || unitLoading || liveOff) return;
    let cancelled = false;
    void localRoutineNote(userId, templateId, workoutId, weightUnit).then((note) => {
      if (!cancelled) setLastNote(note);
    });
    void serverRoutineNote(userId, templateId, workoutId, weightUnit).then((note) => {
      if (!cancelled && note !== undefined) setLastNote(note);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, workoutId, templateId, weightUnit, unitLoading, liveOff]);

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
    if (!id || liveOff) return;
    let cancelled = false;
    void loadRunningRest(id).then((saved) => {
      if (cancelled) return;
      if (saved) setRest((current) => current ?? saved);
      setRestLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id, liveOff]);

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
    if (!id || !restLoaded || liveOff) return;
    if (rest) {
      void saveRunningRest(id, rest);
      void ensureRestAlertPermission();
      void scheduleRestAlert({ workoutId: id, endsAt: rest.endsAt, exerciseName: restExerciseName });
    } else {
      void clearRunningRest(id);
      void cancelRestAlert(id);
    }
  }, [id, rest, restLoaded, restExerciseName, liveOff]);

  // The Live Activity (lib/live-activity) follows the workout and the rest,
  // 300 ms after the last change. `workout` covers every set edit and the
  // server read that brings the last session; an unchanged result sends
  // nothing. Finish and Discard end it in data/workouts.
  useEffect(() => {
    if (!workout || !restLoaded || unitLoading || liveOff) return;
    const t = setTimeout(() => {
      if (!ended.current) void syncWorkoutActivity(workout, rest, weightUnit, progressionOpen, restEnded);
    }, 300);
    return () => clearTimeout(t);
  }, [workout, rest, restLoaded, weightUnit, unitLoading, progressionOpen, restEnded, liveOff]);

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
    if (!editing) return;
    // The top of what covers the bottom of the screen: the keyboard on iOS,
    // where the bar sits on it; on Android the bar's measured position.
    let coverTop: number;
    if (Platform.OS === 'android') {
      if (androidBar == null || keyboardArea.bottom == null) return;
      coverTop = keyboardArea.bottom - androidBar;
    } else {
      if (keyboard.top == null) return;
      coverTop = keyboard.top;
    }
    const input = inputRefs.current.get(`${editing.setId}:${editing.field}`);
    if (!input) return;
    const limit = coverTop - ACCESSORY_HEIGHT - spacing.lg;
    input.measureInWindow((_x, y, _w, h) => {
      const overlap = y + h - limit;
      if (overlap > 0) scrollRef.current?.scrollTo({ y: scrollY.current + overlap, animated: true });
    });
  }, [editing, keyboard.top, androidBar, keyboardArea.bottom]);

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
      const focused =
        [...inputRefs.current.values()].some((input) => input.isFocused()) ||
        !!percentInputRef.current?.isFocused();
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

  /** Keeps the note as typed on screen and in the phone's copy; the queue gets it trimmed. */
  function onChangeNotes(text: string) {
    const w = workoutRef.current;
    if (!w || !userId) return;
    editWorkout((cur) => (cur ? { ...cur, notes: text } : cur));
    void data.setWorkoutNotes(userId, w.id, text);
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
    // A time box sends its timer digits ("2500" is 25:00); a distance box,
    // km or mi as typed, saved in meters; an incline box, a percent as
    // typed (the box keeps it to one decimal and 50 at most).
    if (field === 'time') {
      patchSet(setId, { duration_seconds: timerSeconds(raw) });
      return;
    }
    if (field === 'distance') {
      patchSet(setId, { distance_meters: distanceToMeters(parseNumeric(raw, false), weightUnit) });
      return;
    }
    if (field === 'incline') {
      patchSet(setId, { incline_percent: parseNumeric(raw, false) });
      return;
    }
    const value = parseNumeric(raw, field === 'reps');
    // Typing is an edit: the weight is now the typed value in the current
    // unit, not the converted source it was seeded from.
    patchSet(setId, field === 'weight' ? { weight_value: value, stored: null } : { reps: value });
  }

  function openSetType(setId: string) {
    dismissKeyboard();
    setSetTypeId(setId);
    setTypeRef.current?.present();
  }

  /**
   * The set type sheet's choice. The badges, the Previous column, the
   * suggestions and the PR marks are all worked out from `set_type`, so this
   * one write renumbers the rows and moves everything with them. A choice
   * that changes nothing writes nothing, so a set typed drop or failure is
   * left alone by "Working set".
   */
  function pickSetType(kind: SetKind) {
    setTypeRef.current?.dismiss();
    const set = workoutRef.current?.exercises.flatMap((we) => we.sets).find((s) => s.id === setTypeId);
    if (!set || (kind === 'warmup') === isWarmupSet(set)) return;
    patchSet(set.id, { set_type: kind === 'warmup' ? WARMUP_SET_TYPE : WORKING_SET_TYPE });
  }

  /**
   * The suggestion a set's row shows, as its tick writes it. Null unless
   * the gate is open, so a free tick writes nothing new.
   */
  function suggestionOf(setId: string): SuggestionWrite | null {
    const we = workout?.exercises.find((x) => x.sets.some((s) => s.id === setId));
    if (!we) return null;
    const progression = data.progressionFor(we, weightUnit, progressionOpen);
    return suggestionToWrite(
      suggestionsForRows(progression, we.sets)[we.sets.findIndex((s) => s.id === setId)],
      weightUnit,
    );
  }

  /** The placeholder a set's empty boxes show, worked out the way its card does. */
  function placeholderOf(setId: string): SetPlaceholder | null {
    const we = workout?.exercises.find((x) => x.sets.some((s) => s.id === setId));
    if (!we) return null;
    return data.placeholderAt(we, we.sets.findIndex((s) => s.id === setId), weightUnit, progressionOpen);
  }

  function onStep(delta: number) {
    // Cardio boxes have no steppers (KeypadAccessory shows none).
    if (
      !editing ||
      !workout ||
      editing.field === 'time' ||
      editing.field === 'distance' ||
      editing.field === 'incline'
    ) {
      return;
    }
    // Only ever the input that has the cursor. `editing` follows focus, but
    // a stale value (a row deleted or a set checked while focused) must not
    // step a box the user is not in.
    if (!inputRefs.current.get(`${editing.setId}:${editing.field}`)?.isFocused()) return;
    const set = workout.exercises.flatMap((we) => we.sets).find((s) => s.id === editing.setId);
    if (!set) return;
    // An empty box steps from its placeholder, the number the user can see.
    const placeholder = placeholderOf(set.id);
    if (editing.field === 'weight') {
      const next = steppedWeight(set.weight_value, placeholder?.weight?.value ?? null, delta, weightUnit);
      patchSet(set.id, { weight_value: next, stored: null });
    } else {
      const next = Math.max(0, (set.reps ?? placeholder?.reps ?? 0) + delta);
      patchSet(set.id, { reps: next });
    }
  }

  /** The focused weight box's value and placeholder, for the keypad's percent chips. */
  function editingWeight(): { value: number | null; placeholder: number | null } {
    if (!editing || editing.field !== 'weight' || !workout) return { value: null, placeholder: null };
    const set = workout.exercises.flatMap((we) => we.sets).find((s) => s.id === editing.setId);
    return {
      value: set?.weight_value ?? null,
      placeholder: set ? (placeholderOf(set.id)?.weight?.value ?? null) : null,
    };
  }

  /**
   * The keypad's percent mode, applied: writes the weight it worked out, as
   * a typed weight is written, then moves on exactly as Next or Done does.
   */
  function onPercent(weight: number) {
    if (!editing || editing.field !== 'weight' || !workout) return;
    // Only while the percent box has the cursor, so a stale `editing` (as
    // in onStep) never takes the weight.
    if (!percentInputRef.current?.isFocused()) return;
    patchSet(editing.setId, { weight_value: weight, stored: null });
    onKeypadAdvance();
  }

  /**
   * The check. Ticking a set fills each empty box from its placeholder and
   * logs that, with the placeholder weight's stored value and unit, so an
   * unedited carried weight ties its source rather than beating it by the
   * rounding. A box left empty with nothing to fall back on (the weight of
   * a weighted exercise, or the reps) stops the tick: that box takes focus,
   * the keypad opens and the row says why, so the tap is never silent.
   *
   * Otherwise the check puts the keypad away and leaves no box focused, so
   * the cursor never stays behind in the row just logged. The next set is
   * marked by its blue number only; the keypad opens when a box is tapped.
   *
   * A cardio set fills its time, distance and incline the same way and
   * needs only a time; distance and incline are optional. It starts no rest.
   */
  function toggleDone(set: WorkoutSet, placeholder: SetPlaceholder | null, weighted: boolean) {
    if (set.completed) {
      dismissKeyboard();
      patchSet(set.id, { completed: false });
      return;
    }
    const exercise = workout?.exercises.find((we) => we.sets.some((s) => s.id === set.id))?.exercise ?? null;
    const cardio = isCardio(exercise);
    const patch: Partial<WorkoutSet> = { completed: true };
    let missing: EditField | null;
    if (cardio) {
      if (set.duration_seconds == null && placeholder?.duration_seconds != null) {
        patch.duration_seconds = placeholder.duration_seconds;
      }
      if (set.distance_meters == null && placeholder?.distance_meters != null) {
        patch.distance_meters = placeholder.distance_meters;
      }
      if (set.incline_percent == null && placeholder?.incline_percent != null) {
        patch.incline_percent = placeholder.incline_percent;
      }
      missing = (patch.duration_seconds ?? set.duration_seconds) == null ? 'time' : null;
    } else {
      if (set.weight_value == null && placeholder?.weight) {
        patch.weight_value = placeholder.weight.value;
        patch.stored = placeholder.weight.stored;
      }
      if (set.reps == null && placeholder?.reps != null) patch.reps = placeholder.reps;
      missing =
        weighted && (patch.weight_value ?? set.weight_value) == null
          ? 'weight'
          : (patch.reps ?? set.reps) == null
            ? 'reps'
            : null;
    }
    if (missing) {
      setFieldHint({ setId: set.id, field: missing });
      inputRefs.current.get(`${set.id}:${missing}`)?.focus();
      return;
    }
    dismissKeyboard();
    setFieldHint((h) => (h?.setId === set.id ? null : h));
    patchSet(set.id, patch, true, suggestionOf(set.id));
    // One buzz per check: the PR success pattern when this set becomes a
    // PR for the first time this session, else the light confirmation.
    // Never on un-check.
    // Editing: the confirmation only, and no rest.
    if (!editMode && becomesPr(set, patch)) reward();
    else confirm();
    if (cardio || editMode) return;
    // The exercise's saved rest, else the default.
    const exerciseId = exercise?.id ?? null;
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
   * Pro: opens the plate calculator for a weight on a bar exercise, with
   * the bar and plates from Settings (the defaults until they are read).
   * `setId` is the box the closest weight goes in.
   */
  function openPlates(weight: number, exercise: ExerciseInfo, setId: string | null) {
    const bar = barWeightFor(exercise, weightUnit, proInputs?.barWeight ?? barWeight(weightUnit, null));
    if (bar == null) return;
    dismissKeyboard();
    setPlateSetId(setId);
    setPlateTarget({ weight, bar, plates: proInputs?.plates ?? availablePlates(weightUnit, null) });
    plateRef.current?.present();
  }

  /** The exercise of the set being edited, or null. */
  function editingExercise(): ExerciseInfo | null {
    if (!editing || !workout) return null;
    return workout.exercises.find((x) => x.sets.some((s) => s.id === editing.setId))?.exercise ?? null;
  }

  /** The keypad's weight step for the exercise of the set being edited, in the user's unit. */
  function editingWeightStep(): number {
    const we = editing ? workout?.exercises.find((x) => x.sets.some((s) => s.id === editing.setId)) : null;
    return we ? keypadWeightStep(we.exercise, weightUnit) : KEYPAD_STEPS.fallback[weightUnit];
  }

  /**
   * The input after the one being edited, inside the same exercise: weight to
   * reps of the same set, reps to the weight of the next set. A cardio set
   * goes time to distance, then to the next set's time; on a treadmill,
   * time to distance to incline, then the next set's time. Null on the
   * last input of the exercise, where the bar reads Done.
   */
  function nextInput(): { setId: string; field: EditField } | null {
    if (!editing || !workout) return null;
    if (editing.field === 'weight') return { setId: editing.setId, field: 'reps' };
    if (editing.field === 'time') return { setId: editing.setId, field: 'distance' };
    const we = workout.exercises.find((x) => x.sets.some((s) => s.id === editing.setId));
    if (!we) return null;
    if (editing.field === 'distance' && hasIncline(we.exercise)) return { setId: editing.setId, field: 'incline' };
    const i = we.sets.findIndex((s) => s.id === editing.setId);
    const next = we.sets[i + 1];
    if (!next) return null;
    return { setId: next.id, field: editing.field === 'distance' || editing.field === 'incline' ? 'time' : 'weight' };
  }

  /**
   * Next or Done on the keypad bar. Focus only: Next moves to the following
   * input, whose onFocus updates `editing`, and Done puts the keypad away,
   * keeping what was typed. Neither marks a set complete, including a set
   * whose check was refused for want of a value; completing a set is only
   * ever the check control, so a user editing a future set during a rest
   * is never made to log it.
   */
  function onKeypadAdvance() {
    const target = nextInput();
    if (target) {
      inputRefs.current.get(`${target.setId}:${target.field}`)?.focus();
      return;
    }
    dismissKeyboard();
  }

  /** Remembers, or with `removed` false forgets, that an exercise's warm-up row was deleted. */
  function noteRemovedWarmup(weId: string, removed: boolean) {
    const exerciseId = workoutRef.current?.exercises.find((we) => we.id === weId)?.exercise.id;
    if (!exerciseId || !workout) return;
    const next = new Set(removedWarmups);
    if (removed) next.add(exerciseId);
    else next.delete(exerciseId);
    setRemovedWarmups(next);
    void saveRemovedWarmups(workout.id, next);
  }

  function deleteSet(weId: string, set: WorkoutSet) {
    // Editing generates no warm-ups, and Cancel would have to take this back.
    if (isWarmupSet(set) && !editMode) noteRemovedWarmup(weId, true);
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
    if (isWarmupSet(undo.set) && !editMode) noteRemovedWarmup(undo.weId, false);
    // A set added since the delete may have taken this one's position.
    const siblings = workout.exercises.find((we) => we.id === undo.weId)?.sets ?? [];
    const restored = { ...undo.set, position: restoredSetPosition(siblings, undo.set.position) };
    await data.restoreSet(userId, workout.id, undo.weId, restored, weightUnit);
    editWorkout((w) =>
      w
        ? {
            ...w,
            exercises: w.exercises.map((we) =>
              we.id === undo.weId
                ? { ...we, sets: [...we.sets, restored].sort((a, b) => a.position - b.position) }
                : we,
            ),
          }
        : w,
    );
    setUndo(null);
  }

  /**
   * Add set seeds the new row so the user types as little as possible. The
   * new row is a working set, so the source, in order: the last working set
   * in this exercise with a value in either field (not the last set, which
   * on a routine-seeded exercise is often still empty), then the prior
   * session's working set for the new row, then nothing. Completion is
   * not consulted: a filled but unchecked set is
   * usually the one just typed. Local state, so a value typed a moment ago
   * counts whether or not its write has landed. A cardio set copies time,
   * distance and incline by the same rule.
   */
  async function addSet(weId: string) {
    if (!userId || !workout) return;
    const we = workout.exercises.find((x) => x.id === weId);
    if (!we) return;
    const position = nextSetPosition(we.sets);
    const cardio = isCardio(we.exercise);
    const filled = [...we.sets]
      .reverse()
      .find(
        (s) =>
          !isWarmupSet(s) &&
          (cardio
            ? s.duration_seconds != null || s.distance_meters != null || s.incline_percent != null
            : s.weight_value != null || s.reps != null),
      );
    // By row, not position: the two differ once a set has been deleted.
    const source = filled ?? priorSetForRow(we.prior, [...we.sets, {}], we.sets.length);
    const created = await data.addSet(
      userId,
      workout.id,
      weId,
      position,
      cardio
        ? {
            weight_value: null,
            reps: null,
            stored: null,
            duration_seconds: source?.duration_seconds ?? null,
            distance_meters: source?.distance_meters ?? null,
            incline_percent: source?.incline_percent ?? null,
          }
        : {
            weight_value: source?.weight_value ?? null,
            reps: source?.reps ?? null,
            stored: source?.stored ?? null,
          },
      weightUnit,
    );
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
    const run = confirmExercises(exercises);
    // Save and Cancel wait for this: an add reads the prior session before
    // it writes, and its write belongs in the draft.
    adding.current = run;
    await run;
    if (adding.current === run) adding.current = null;
  }

  async function confirmExercises(exercises: ExerciseInfo[]) {
    if (!userId || !workout) return;
    setPickerOpen(false);

    if (replacingWeId) {
      const weId = replacingWeId;
      const exercise = exercises[0];
      if (exercise) {
        await data.replaceExercise(userId, workout.id, weId, exercise);
        // Previous, the placeholders and the PR baseline were the replaced
        // exercise's, so they clear now and fill when the reads land. Not
        // awaited: Save on an edit waits for this function, and a read is
        // not a write. The phone's copy takes them like any other change.
        editWorkout((w) =>
          w
            ? { ...w, exercises: w.exercises.map((we) => (we.id === weId ? withReplacedExercise(we, exercise) : we)) }
            : w,
        );
        const before = editMode ? workout.createdAt : null;
        void Promise.all([
          data.getPriorSets(userId, exercise.id, weightUnit, workout.id, before),
          data.getPriorHistory(userId, exercise.id, workout.id, exercise, bodyweight, weightUnit, before),
        ]).then(([sets, baseline]) =>
          editWorkout((w) =>
            w ? { ...w, exercises: withPriorRead(w.exercises, weId, exercise.id, { ...sets, ...baseline }) } : w,
          ),
        );
      }
      setReplacingWeId(null);
      return;
    }

    // Sequential rather than Promise.all, so positions come out in selection
    // order and the cards appear in the order the user picked them.
    let position = workout.exercises.length;
    for (const exercise of exercises) {
      const added = await data.addExercise(
        userId,
        workout.id,
        exercise,
        position,
        bodyweight,
        weightUnit,
        editMode ? workout.createdAt : null,
      );
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

    if (action === 'history') {
      const we = workout.exercises.find((x) => x.id === weId);
      if (!we) return;
      // Pushed over this screen, which stays mounted: Back returns to the
      // workout as it was.
      router.push(navHref({ kind: 'exercise', id: we.exercise.id, tab: 'history', overWorkout: true }));
      return;
    }

    if (action === 'info') {
      const we = workout.exercises.find((x) => x.id === weId);
      if (!we) return;
      openInfo(we.exercise);
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

  /**
   * The info sheet for an exercise. From a set's starting-weight hint it
   * opens at Starting weight, and closing it puts the cursor back in that
   * set's weight box, so the number can be typed straight away. The sheet
   * takes the keyboard down while it is up.
   */
  function openInfo(exercise: ExerciseInfo, from: { setId: string } | null = null) {
    dismissKeyboard();
    setInfoScrollTo(from ? 'starting-weight' : null);
    refocusAfterInfo.current = from ? `${from.setId}:weight` : null;
    setInfoExercise(exercise);
    infoRef.current?.present();
  }

  function onInfoDismiss() {
    const key = refocusAfterInfo.current;
    refocusAfterInfo.current = null;
    if (key) inputRefs.current.get(key)?.focus();
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
    const done = async (fromAlert: boolean) => {
      // A second tap while the first waits on the server does nothing.
      if (ended.current) return;
      ended.current = true;
      const startedAt = Date.now();
      // The finish is going ahead.
      emphasize();
      // Waits a moment for the server, so with signal the summary reads a
      // complete workout. Without, the summary draws from the phone's copy.
      await data.finishWorkout(userId, workout, weightUnit);
      // From the alert, not before it has finished closing. With no signal
      // the finish returns at once, and iOS drops a modal presented while
      // an alert is still going away: the summary never opened, until the
      // next alert's close let it through.
      if (fromAlert) {
        const wait = ALERT_CLOSE_MS - (Date.now() - startedAt);
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      }
      // Replace, not push: the summary takes this screen's place in the
      // stack, so there is no finished workout to come back to.
      router.replace({ pathname: '/summary/[id]', params: { id: workout.id } });
    };
    if (pending === 0) {
      await done(false);
      return;
    }
    Alert.alert(
      'Finish workout?',
      `${pending} ${pending === 1 ? 'set is' : 'sets are'} still pending.`,
      [
        { text: 'Keep logging', style: 'cancel' },
        { text: 'Finish anyway', style: 'destructive', onPress: () => void done(true) },
      ],
    );
  }

  /** Closes the edit, back to the detail. */
  function closeEdit() {
    dismissKeyboard();
    router.back();
  }

  /**
   * Cancel, and the Android back button while editing. With nothing
   * changed it closes; otherwise it asks before dropping the draft.
   */
  async function onCancelEdit() {
    dismissKeyboard();
    await adding.current;
    if (!draftHasChanges()) {
      closeEdit();
      return;
    }
    Alert.alert('Discard your changes?', 'The workout stays as it was.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          discardDraft();
          closeEdit();
        },
      },
    ]);
  }

  /**
   * Save: queues the draft's writes, in order, waits a moment for the server,
   * and closes. PRs are worked out from the server's rows on every read, so
   * the wait is what lets the detail screen's ribbons show the edit on
   * return. With no signal it gives up and the queue sends them later.
   */
  async function onSaveEdit() {
    if (saved.current) return;
    dismissKeyboard();
    await adding.current;
    saved.current = true;
    const replaced = draftBodies().some(
      (b) => b.kind === 'update' && b.table === 'workout_exercises' && 'exercise_id' in b.patch,
    );
    const ops = await commitDraft();
    if (ops > 0) {
      void track(EVENTS.workoutEdited, { ops, replaced });
      if (workout) await syncedWithin(workout.id, SAVE_WAIT_MS);
    }
    closeEdit();
  }

  // Android's back does what Cancel does while editing, unless a screen is
  // pushed over this one: then it closes that screen. The latest handler,
  // so it sees the draft as it is now.
  const cancelEditRef = useRef(onCancelEdit);
  cancelEditRef.current = onCancelEdit;
  useEffect(() => {
    if (!editMode) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!navigation.isFocused()) return false;
      void cancelEditRef.current();
      return true;
    });
    return () => sub.remove();
  }, [editMode, navigation]);

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
      <CollapseChevron />
    </Pressable>
  );

  const cancelEditButton = (
    <Pressable
      onPress={() => void onCancelEdit()}
      hitSlop={10}
      accessibilityRole="button"
      style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
      <Text style={[type.button, { color: c.accentText }]}>Cancel</Text>
    </Pressable>
  );
  const leftButton = editRequested ? cancelEditButton : closeButton;

  // Same outer tree as the loaded return, so the Reveal persists and
  // crossfades. The close button is live while the workout loads.
  // Pro: body details, the bar and related lifts for the exercises new to
  // the user, so their first session gets a starting weight. Read again
  // when an exercise is added; cleared on leaving the screen.
  const firstSessionIds =
    workout && serverLoaded && progressionOpen
      ? workout.exercises
          .filter((we) => (we.history ?? []).every((h) => h.sets.length === 0))
          .map((we) => we.exercise.id)
          .join(',')
      : null;
  useEffect(() => {
    const w = workoutRef.current;
    if (!userId || !w || firstSessionIds == null) return;
    let cancelled = false;
    const ids = new Set(firstSessionIds.split(',').filter(Boolean));
    const first = w.exercises.filter((we) => ids.has(we.exercise.id)).map((we) => we.exercise);
    void loadProInputs(userId, weightUnit, w.id, first).then((inputs) => {
      if (!cancelled && inputs) setProInputs(inputs);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, weightUnit, firstSessionIds]);
  // Edit mode: no first sessions, but the plate sheet still wants the bar
  // and plates from Settings.
  useEffect(() => {
    const w = workoutRef.current;
    if (!editMode || !proGate || !userId || !w) return;
    let cancelled = false;
    void loadProInputs(userId, weightUnit, w.id, []).then((inputs) => {
      if (!cancelled && inputs) setProInputs(inputs);
    });
    return () => {
      cancelled = true;
    };
  }, [editMode, proGate, userId, weightUnit]);
  useEffect(() => () => setProInputs(null), [id]);

  // Pro: generated warm-ups become rows at the top of a card. Decided once
  // per card, as soon as its warm-ups are known (the Pro inputs carry the
  // Warm-up sets setting), and only for a card with nothing typed, ticked
  // or noted yet: rows never move under a user who has started.
  const warmupsDecided = useRef(new Set<string>());
  useEffect(() => {
    warmupsDecided.current = new Set();
    setRemovedWarmups(null);
    if (!id) return;
    let cancelled = false;
    void readRemovedWarmups(id).then((removed) => {
      if (!cancelled) setRemovedWarmups((cur) => cur ?? removed);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);
  useEffect(() => {
    const w = workout;
    if (!userId || !w || w.finishedAt || !progressionOpen || proInputs?.warmups === undefined || !removedWarmups) return;
    for (const we of w.exercises) {
      if (warmupsDecided.current.has(we.id)) continue;
      warmupsDecided.current.add(we.id);
      if (removedWarmups.has(we.exercise.id)) continue;
      const count = data.progressionFor(we, weightUnit, true)?.sets.filter((s) => s.generated).length ?? 0;
      if (count === 0 || !untouched(we)) continue;
      void data.addWarmupRows(userId, w.id, we, count, weightUnit).then((warmups) => {
        // From the latest rows, so anything typed meanwhile stays.
        editWorkout((cur) =>
          cur
            ? {
                ...cur,
                exercises: cur.exercises.map((x) =>
                  x.id === we.id
                    ? { ...x, sets: [...warmups, ...x.sets.map((s) => ({ ...s, position: s.position + count }))] }
                    : x,
                ),
              }
            : cur,
        );
        // The first card given warm-ups carries the tip, the first time ever.
        if (warmupTipAsked.current) return;
        warmupTipAsked.current = true;
        void warmupTipSeen(userId).then((seen) => {
          if (seen) return;
          setWarmupTipWeId(we.id);
          void markWarmupTipSeen(userId);
        });
      });
    }
  }, [userId, workout, progressionOpen, proInputs, weightUnit, editWorkout, removedWarmups]);

  // The tip explains a W row, so it goes when its card has none left. Cleared
  // from state, so undoing the delete does not bring it back. It was marked
  // seen when it showed.
  useEffect(() => {
    if (!warmupTipWeId) return;
    const we = workout?.exercises.find((x) => x.id === warmupTipWeId);
    if (!we?.sets.some(isWarmupSet)) setWarmupTipWeId(null);
  }, [workout, warmupTipWeId]);

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
  }, [workout, progressionOpen, introWeId, weightUnit, proInputs]);

  const progressionModel = (() => {
    const we = workout?.exercises.find((x) => x.id === progressionWeId);
    if (!we) return null;
    const p = data.progressionFor(we, weightUnit, progressionOpen);
    return p ? progressionSheet(p, we.exercise, weightUnit, we.sets) : null;
  })();

  if (loading) {
    return (
      <View style={[styles.fill, { backgroundColor: c.bg }]}>
        <Reveal
          ready={false}
          skeleton={
            <View style={styles.fill}>
              <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
                {leftButton}
                <View style={styles.headerText}>
                  <SkeletonText variant={type.screenTitle} width="58%" />
                  <SkeletonText variant={type.meta} width="72%" />
                </View>
                <View style={styles.headerActions}>
                  {editRequested ? null : <Skeleton width={36} height={36} radius={radius.input} />}
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

  // Working sets, as the summary's SETS counts them: warm-ups are not counted.
  const setsDone = countedSets(workout.exercises.flatMap((we) => we.sets)).length;
  const restRemaining = rest != null ? (rest.endsAt - now) / 1000 : 0;
  const progress = workoutProgress(workout.exercises);

  return (
    // A tap on anything that does not handle it (the header's text, the
    // space around the buttons) puts the keypad away. Taps on empty space in
    // the list are the scroll view's, which does the same through
    // keyboardShouldPersistTaps="handled".
    <View
      ref={rootRef}
      style={[styles.fill, { backgroundColor: c.bg }]}
      // Android also while the bar is up with no on-screen keyboard (a
      // hardware keyboard), which sends no keyboard event.
      onStartShouldSetResponder={() =>
        keyboard.top != null || (Platform.OS === 'android' && androidBar != null)
      }
      onResponderRelease={dismissKeyboard}>
      <Reveal ready skeleton={null} style={styles.fill}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          {editMode ? cancelEditButton : closeButton}
          <View style={styles.headerText}>
            <Text style={[type.screenTitle, { color: c.text }]}>{workout.name ?? 'Workout'}</Text>
            <Text style={[type.meta, { color: c.text2 }]}>
              {editMode ? (
                // The detail screen's date line in place of the clock.
                dateLine(workout.workoutDate ?? workout.createdAt.slice(0, 10), workout.createdAt)
              ) : (
                <Text style={[type.restTime, { color: c.text2 }]}>
                  {elapsedLabel(workout.createdAt, now)}
                </Text>
              )}
              {`  ·  ${workout.exercises.length} ${workout.exercises.length === 1 ? 'exercise' : 'exercises'}  ·  ${setsDone} ${setsDone === 1 ? 'set' : 'sets'} done`}
            </Text>
          </View>
          {editMode ? (
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => void onSaveEdit()}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.finish,
                  { backgroundColor: c.accent },
                  pressed && styles.pressed,
                ]}>
                <Text style={[type.button, { color: '#FFFFFF' }]}>Save</Text>
              </Pressable>
            </View>
          ) : (
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
                name={{ ios: 'trash', android: 'delete' }}
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
          )}
        </View>
        {/* The header's bottom edge: full bleed, outside its padding. None
            while editing. */}
        {editMode ? null : <WorkoutProgressBar progress={progress} />}

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
            { paddingBottom: spacing.screen + keyboardPad + trayHeight + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          onScroll={(e) => {
            scrollY.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}>
          {/* Until the first finish: what ticking is for. */}
          {userId && !editMode ? <FirstSessionBanner key={userId} userId={userId} unit={weightUnit} /> : null}
          <View>
            {editMode ? null : <LastTimeNote note={lastNote} />}
            <WorkoutNoteRow
              notes={workout.notes ?? ''}
              onPress={() => {
                dismissKeyboard();
                noteSheetRef.current?.present();
              }}
            />
          </View>

          {workout.exercises.map((we) => (
            <ExerciseCard
              key={we.id}
              we={we}
              unit={unit}
              bodyweight={bodyweight}
              onOpenSheet={() => openExerciseMenu(we.id)}
              onOpenInfo={() => openInfo(we.exercise)}
              onDismissKeypad={keypadShown ? dismissKeyboard : undefined}
              onOpenStartingWeight={editMode ? undefined : (setId) => openInfo(we.exercise, { setId })}
              progressionOff={editMode}
              onEditField={(setId, field) => {
                setEditing({ setId, field });
                setFieldHint((h) => (h?.setId === setId ? h : null));
              }}
              registerInput={registerInput}
              fieldHint={fieldHint}
              editing={editing}
              onChangeField={onChangeField}
              onToggleDone={toggleDone}
              onDeleteSet={(s) => deleteSet(we.id, s)}
              onAddSet={() => void addSet(we.id)}
              onPlatesForSet={
                proGate && usesBar(we.exercise)
                  ? (s) => {
                      if (s.weight_value != null) openPlates(s.weight_value, we.exercise, null);
                    }
                  : undefined
              }
              onOpenSetType={(s) => openSetType(s.id)}
              warmupTip={we.id === warmupTipWeId}
              onDismissWarmupTip={() => setWarmupTipWeId(null)}
              onOpenProgression={() => {
                dismissKeyboard();
                setProgressionWeId(we.id);
                setShowWarmupNote(false);
                const p = data.progressionFor(we, weightUnit, progressionOpen);
                if (userId && we.sets.some(isWarmupSet) && p?.sets.some((s) => s.generated)) {
                  void warmupNoteSeen(userId).then((seen) => {
                    if (seen) return;
                    setShowWarmupNote(true);
                    void markWarmupNoteSeen(userId);
                  });
                }
                progressionRef.current?.present();
              }}
              introChip={we.id === introWeId}
              onIntroDone={() => {
                progressionIntroPlayed.add(workout.id);
                setIntroWeId(null);
              }}
            />
          ))}

          {/* After the last card, in the scroll, so a running rest never covers
              it. Hidden while the keypad row is up. Kept in the layout, so the
              list does not jump as the keypad comes and goes. */}
          {!isEmpty ? (
            <View
              pointerEvents={keypadShown ? 'none' : 'auto'}
              accessibilityElementsHidden={keypadShown}
              importantForAccessibility={keypadShown ? 'no-hide-descendants' : 'auto'}
              style={keypadShown ? styles.hidden : undefined}>
              {addExerciseButton}
            </View>
          ) : null}

          {/* Empty workout: the recents list and the full-picker button sit
              together in the scroll, the two ways to add an exercise side by
              side. Once there is a card, the button follows the last card. */}
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

        {/* Over the end of the list while a rest runs. Not modal. */}
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
            { bottom: insets.bottom + trayHeight + spacing.screen, backgroundColor: c.surface2, borderColor: c.border },
          ]}>
          <Text style={[type.meta, { color: c.text }]}>Set deleted</Text>
          <Pressable onPress={() => void restoreDeleted()} hitSlop={8}>
            <Text style={[type.button, { color: c.accentText }]}>Undo</Text>
          </Pressable>
        </View>
      ) : null}

      <KeypadAccessory
        field={editing?.field ?? null}
        focusKey={editing ? `${editing.setId}:${editing.field}` : null}
        weightStep={editingWeightStep()}
        weightValue={editingWeight().value}
        weightPlaceholder={editingWeight().placeholder}
        androidBottom={androidBar}
        hasNext={nextInput() != null}
        restRemaining={rest != null ? restRemaining : null}
        onDismiss={dismissKeyboard}
        onStep={onStep}
        percentInputRef={percentInputRef}
        onPercent={onPercent}
        onAdvance={() => onKeypadAdvance()}
        onPlates={(() => {
          const ex = editingExercise();
          if (!proGate || !editing || editing.field !== 'weight' || !ex || !usesBar(ex)) return undefined;
          const setId = editing.setId;
          return () => {
            const { value, placeholder } = editingWeight();
            const w = value ?? placeholder;
            if (w != null) openPlates(w, ex, setId);
          };
        })()}
      />

      <PlateSheet
        ref={plateRef}
        target={plateTarget}
        unit={weightUnit}
        unitLabel={unit}
        onPick={plateSetId ? (w) => patchSet(plateSetId, { weight_value: w, stored: null }) : undefined}
      />

      <ExerciseInfoSheet ref={infoRef} exercise={infoExercise} scrollTo={infoScrollTo} onDismiss={onInfoDismiss} />

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
        showWarmupNote={showWarmupNote}
        onDone={() => progressionRef.current?.dismiss()}
        onHowItWorks={() => {
          progressionRef.current?.dismiss();
          router.push('/progression-guide');
        }}
      />

      <SetTypeSheet
        ref={setTypeRef}
        warmup={isWarmupSet(workout.exercises.flatMap((we) => we.sets).find((s) => s.id === setTypeId))}
        onPick={pickSetType}
      />

      <ReorderModal
        visible={reorderOpen}
        exercises={workout.exercises}
        onDone={(ordered) => void onReorderDone(ordered)}
      />

      <WorkoutNoteSheet ref={noteSheetRef} value={workout.notes ?? ''} onChangeText={onChangeNotes} />

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

/** How long an iOS alert takes to close; the summary opens no sooner than this after a confirm. */
const ALERT_CLOSE_MS = 400;

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
  // Edit mode's Cancel: the same height as the icon button it replaces.
  textButton: { height: 36, justifyContent: 'center' },
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
  hidden: { opacity: 0 },
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
