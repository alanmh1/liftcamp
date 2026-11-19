import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import {
  COPY_NAME_MAX,
  copyPlan,
  copyRoutineName,
  copySkippedLine,
  socialHandle,
  type CopyPlan,
} from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { forwardRef, useImperativeHandle, useMemo, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { saveRoutineError } from '@/components/history/save-routine-sheet';
import { useStartGate } from '@/components/start-gate';
import { MAX_FONT_SCALE, Text } from '@/components/text';
import { useWeightUnit } from '@/components/unit-provider';
import { saveCopiedRoutine, startCopiedWorkout } from '@/data/home';
import { socialWorkout, type FriendWorkout } from '@/data/social';
import { useRoutineCapCheck } from '@/lib/pro';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

export type CopyWorkoutSheetRef = {
  /** Opens the sheet for a friend's workout. `loaded` skips the read when the screen already has it. */
  open: (workoutId: string, loaded?: FriendWorkout | null) => void;
};

/**
 * Copy workout (docs/social-v1-spec.md, Branch 1; board Copy in the
 * "LiftCamp feed options" canvas). From the feed card's ⋯ menu and the
 * read-only friend workout. Anyone who can see a workout can copy it,
 * mutual follow or not.
 *
 * - Start now: a new workout of the user's own with the friend's
 *   exercises, set counts and reps (startCopiedWorkout), through the start
 *   gate like every start. Weights come from the user's own history.
 * - Save as a routine: a name field, "Pull from @will" to start with, then
 *   Save (saveCopiedRoutine), behind the free routine cap.
 *
 * Custom exercises are skipped, with a line saying how many; with nothing
 * left both choices are disabled. The plan comes from copyPlan in shared.
 *
 * Rows and an input, so the sheet keeps the left edge (apps/mobile/CLAUDE.md).
 */
export const CopyWorkoutSheet = forwardRef<CopyWorkoutSheetRef>(function CopyWorkoutSheet(_props, ref) {
  const c = useColors();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { unit: weightUnit } = useWeightUnit();
  const { guardStart } = useStartGate();
  const routineCapOk = useRoutineCapCheck();
  const sheet = useRef<SheetRef>(null);
  // The workout the sheet is for, so a read that lands after another open is dropped.
  const openFor = useRef<string | null>(null);

  // Undefined while reading, null when the read failed or the workout cannot be seen.
  const [workout, setWorkout] = useState<FriendWorkout | null | undefined>(undefined);
  const [step, setStep] = useState<'choose' | 'name'>('choose');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      open: (workoutId, loaded) => {
        openFor.current = workoutId;
        setStep('choose');
        setBusy(false);
        setError(null);
        setWorkout(loaded ?? undefined);
        sheet.current?.present();
        if (loaded) return;
        void socialWorkout(workoutId)
          .then((result) => {
            if (openFor.current !== workoutId) return;
            setWorkout(result.ok ? (result.data ?? null) : null);
          })
          .catch(() => {
            if (openFor.current === workoutId) setWorkout(null);
          });
      },
    }),
    [],
  );

  const plan: CopyPlan | null = useMemo(
    () =>
      workout
        ? copyPlan(
            workout.exercises.map((we) => ({
              exerciseId: we.exercise.id,
              isCustom: we.exercise.is_custom,
              sets: we.sets,
            })),
          )
        : null,
    [workout],
  );
  const skipped = plan ? copySkippedLine(plan) : null;
  const nothing = plan != null && plan.exercises.length === 0;
  const title = workout ? `Copy ${socialHandle(workout.username)}'s ${workout.name?.trim() || 'workout'}` : 'Copy workout';
  const routineName = workout ? copyRoutineName(workout.name, workout.username) : '';

  function close() {
    openFor.current = null;
    sheet.current?.dismiss();
  }

  async function startNow() {
    if (!userId || !workout || !plan || nothing || busy) return;
    const source = { name: workout.name?.trim() || null, exercises: plan.exercises };
    // The gate may ask about a workout in progress; its alert reads better
    // with the sheet gone.
    close();
    await guardStart(async () => {
      const id = await startCopiedWorkout(userId, source.name, source.exercises, weightUnit);
      if (id) router.push({ pathname: '/workout/[id]', params: { id } });
      else Alert.alert('Could not start that workout.', 'Check your connection and try again.');
    });
  }

  async function toNameStep() {
    if (!userId || !workout || nothing || busy) return;
    if (!(await routineCapOk(userId))) return;
    setName(routineName);
    setError(null);
    setStep('name');
  }

  async function saveRoutine() {
    const trimmed = name.trim();
    if (!userId || !plan || nothing || busy || trimmed.length === 0) return;
    setBusy(true);
    setError(null);
    const result = await saveCopiedRoutine(userId, trimmed, plan.exercises);
    setBusy(false);
    if (!result.ok) {
      setError(saveRoutineError(result.reason));
      return;
    }
    close();
    Alert.alert('Routine saved', `"${trimmed}" is in your routines on the Workout tab.`);
  }

  return (
    <Sheet
      ref={sheet}
      onDismiss={() => {
        openFor.current = null;
      }}>
      <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
        {step === 'name' ? 'Save as a routine' : title}
      </Text>

      {workout === undefined ? (
        <ActivityIndicator style={styles.loading} />
      ) : workout === null ? (
        <Text style={[type.meta, styles.body, { color: c.text2 }]}>
          Could not load this workout. Check your connection and try again.
        </Text>
      ) : step === 'choose' ? (
        <>
          <Text style={[styles.body, { color: c.text2 }]}>
            Same exercises, sets and reps. Weights fill in from your own history, not theirs.
          </Text>
          <View style={styles.options}>
            <Option
              icon={{ ios: 'play.fill', android: 'play_arrow' }}
              label="Start it now"
              detail="Opens as a new workout you can change"
              disabled={nothing}
              onPress={() => void startNow()}
            />
            <Option
              icon={{ ios: 'bookmark', android: 'bookmark' }}
              label="Save as a routine"
              detail={`Adds "${routineName}" to your routines`}
              disabled={nothing}
              onPress={() => void toNameStep()}
            />
          </View>
          {skipped ? <Text style={[type.meta, styles.skipped, { color: c.text2 }]}>{skipped}</Text> : null}
        </>
      ) : (
        <>
          <BottomSheetTextInput
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            value={name}
            onChangeText={(t) => {
              setName(t);
              setError(null);
            }}
            autoFocus
            selectTextOnFocus
            maxLength={COPY_NAME_MAX}
            returnKeyType="done"
            onSubmitEditing={() => void saveRoutine()}
            accessibilityLabel="Routine name"
            style={[styles.input, { backgroundColor: c.inputFill, borderColor: c.border, color: c.text }]}
          />
          <Text style={[type.meta, styles.hint, { color: error ? c.danger : c.text3 }]}>
            {error ?? 'Saves each exercise with its sets and reps. No weights.'}
          </Text>
          <Pressable
            onPress={() => void saveRoutine()}
            disabled={busy || name.trim().length === 0}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.save,
              { backgroundColor: c.accent },
              (pressed || busy || name.trim().length === 0) && styles.pressed,
            ]}>
            <Text style={[type.button, { color: '#FFFFFF' }]}>{busy ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </>
      )}
    </Sheet>
  );
});

function Option({
  icon,
  label,
  detail,
  disabled,
  onPress,
}: {
  icon: ComponentProps<typeof SymbolView>['name'];
  label: string;
  detail: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint={detail}
      style={({ pressed }) => [
        styles.option,
        { backgroundColor: c.surface2 },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <SymbolView
        name={icon}
        size={22}
        tintColor={disabled ? c.text3 : c.accentText}
        fallback={<View style={styles.iconSpace} />}
      />
      <View style={styles.optionText}>
        <Text style={[styles.optionLabel, { color: disabled ? c.text3 : c.text }]}>{label}</Text>
        <Text style={[type.meta, { color: c.text2 }]}>{detail}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700', paddingHorizontal: 4, paddingBottom: spacing.xs },
  body: { fontSize: 15, lineHeight: 20, paddingHorizontal: 4, paddingBottom: spacing.md },
  loading: { marginVertical: spacing.xl },
  options: { gap: spacing.sm },
  option: {
    minHeight: 64,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { fontSize: 16, fontWeight: '600' },
  iconSpace: { width: 22 },
  skipped: { paddingTop: spacing.md, paddingHorizontal: 4 },
  input: {
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 17,
  },
  hint: { paddingTop: spacing.sm, paddingBottom: spacing.md, paddingHorizontal: 4 },
  save: { borderRadius: radius.bar, paddingVertical: spacing.lg, alignItems: 'center' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.6 },
});
