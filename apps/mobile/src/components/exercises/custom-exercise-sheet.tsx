import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import {
  CANONICAL_MUSCLES,
  CUSTOM_EQUIPMENT,
  CUSTOM_NAME_MAX,
  customExerciseErrorCopy,
  draftProblem,
  EMPTY_DRAFT,
  formatEquipmentLabel,
  muscleLabel,
  rowToDraft,
  TRACK_TYPES,
  type CanonicalMuscle,
  type CustomExerciseDraft,
  type TrackType,
} from '@liftcamp/shared';
import { forwardRef, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { Segmented } from '@/components/exercises/segmented';
import { Chip, settingsStyles } from '@/components/settings-ui';
import { Text } from '@/components/text';
import {
  archiveCustomExercise,
  createCustomExercise,
  customExerciseHasSets,
  updateCustomExercise,
} from '@/data/custom-exercises';
import type { ExerciseInfo } from '@/data/workouts';
import { useColors } from '@/theme/theme-provider';
import { palettes, radius, spacing, type } from '@/theme/tokens';

/**
 * Create or edit a custom exercise. One sheet for both: `editing` null is
 * a new one, with `initialName` from a search that found nothing; set, it
 * is that exercise's draft with a Delete row at the bottom.
 *
 * Name, the main muscle, any others, equipment, how it is logged and
 * whether it is one side at a time. The server checks the same rules
 * (docs/custom-exercises.sql) and its refusal shows as the hint line, so
 * the cap and the flag can never be got around from here.
 *
 * Tracking locks once the exercise has a logged set. Switching a weighted
 * exercise to timed would leave its history and PRs reading wrong.
 */
export const CustomExerciseSheet = forwardRef<
  SheetRef,
  {
    editing: ExerciseInfo | null;
    initialName?: string;
    /** The saved row. The host adds it, selects it, or refreshes. */
    onSaved: (exercise: ExerciseInfo) => void;
    /** After a delete. The host leaves the screen or refreshes its list. */
    onDeleted?: (id: string) => void;
  }
>(function CustomExerciseSheet({ editing, initialName, onSaved, onDeleted }, ref) {
  const c = useColors();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [draft, setDraft] = useState<CustomExerciseDraft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [locked, setLocked] = useState(false);

  // A fresh draft for each exercise (or each new one), and the lock read
  // for an edit. A screen that re-presents the sheet for the same row
  // keeps what the user typed.
  useEffect(() => {
    setError(null);
    if (editing) {
      setDraft(rowToDraft(editing));
      setLocked(false);
      if (userId) {
        let cancelled = false;
        customExerciseHasSets(userId, editing.id).then((has) => {
          if (!cancelled) setLocked(has);
        });
        return () => {
          cancelled = true;
        };
      }
    } else {
      setDraft({ ...EMPTY_DRAFT, name: initialName ?? '' });
      setLocked(false);
    }
  }, [editing, initialName, userId]);

  const problem = draftProblem(draft);
  const canSave = busy === null && problem == null;

  function dismiss() {
    (ref as React.RefObject<SheetRef | null>).current?.dismiss();
  }

  async function save() {
    if (!userId || !canSave) return;
    setBusy('save');
    setError(null);
    const result = editing
      ? await updateCustomExercise(userId, editing.id, draft, locked)
      : await createCustomExercise(userId, draft);
    setBusy(null);
    if (!result.ok) {
      setError(customExerciseErrorCopy(result.error));
      return;
    }
    onSaved(result.exercise);
    dismiss();
  }

  function confirmDelete() {
    if (!userId || !editing) return;
    Alert.alert(`Delete ${editing.name}?`, 'Your logged sets stay in your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy('delete');
            const err = await archiveCustomExercise(userId, editing.id);
            setBusy(null);
            if (err) {
              setError(customExerciseErrorCopy(err));
              return;
            }
            onDeleted?.(editing.id);
            dismiss();
          })();
        },
      },
    ]);
  }

  function toggleSecondary(m: CanonicalMuscle) {
    setDraft((d) => ({
      ...d,
      secondaryMuscles: d.secondaryMuscles.includes(m)
        ? d.secondaryMuscles.filter((x) => x !== m)
        : [...d.secondaryMuscles, m],
    }));
  }

  return (
    <Sheet ref={ref} scroll>
      <Text style={[styles.header, { color: c.text2 }]}>{editing ? 'Edit exercise' : 'New exercise'}</Text>

      <View style={[styles.field, { backgroundColor: c.inputFill, borderColor: c.border }]}>
        <BottomSheetTextInput
          value={draft.name}
          onChangeText={(t) => {
            setDraft((d) => ({ ...d, name: t }));
            setError(null);
          }}
          autoFocus={!editing}
          placeholder="Exercise name"
          placeholderTextColor={c.text3}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={CUSTOM_NAME_MAX}
          returnKeyType="done"
          style={[styles.input, { color: c.text }]}
        />
      </View>

      <Text style={[type.label, styles.label, { color: c.text3 }]}>Main muscle</Text>
      <View style={settingsStyles.row}>
        {CANONICAL_MUSCLES.map((m) => (
          <Chip
            key={m}
            label={muscleLabel(m)}
            selected={draft.primaryMuscle === m}
            onPress={() =>
              setDraft((d) => ({
                ...d,
                primaryMuscle: m,
                secondaryMuscles: d.secondaryMuscles.filter((x) => x !== m),
              }))
            }
            c={c}
            capitalize={false}
          />
        ))}
      </View>

      <Text style={[type.label, styles.label, { color: c.text3 }]}>Also works (optional)</Text>
      <View style={settingsStyles.row}>
        {CANONICAL_MUSCLES.filter((m) => m !== draft.primaryMuscle).map((m) => (
          <Chip
            key={m}
            label={muscleLabel(m)}
            selected={draft.secondaryMuscles.includes(m)}
            onPress={() => toggleSecondary(m)}
            c={c}
            capitalize={false}
          />
        ))}
      </View>

      <Text style={[type.label, styles.label, { color: c.text3 }]}>Equipment (optional)</Text>
      <View style={settingsStyles.row}>
        {CUSTOM_EQUIPMENT.map((e) => (
          <Chip
            key={e}
            label={formatEquipmentLabel(e)}
            selected={draft.equipment === e}
            onPress={() =>
              setDraft((d) => ({
                ...d,
                equipment: d.equipment === e ? null : e,
              }))
            }
            c={c}
            capitalize={false}
          />
        ))}
      </View>

      <Text style={[type.label, styles.label, { color: c.text3 }]}>How you log it</Text>
      <View style={locked ? styles.locked : null} pointerEvents={locked ? 'none' : 'auto'}>
        <Segmented<TrackType>
          segments={TRACK_TYPES}
          value={draft.trackType}
          onChange={(trackType) => setDraft((d) => ({ ...d, trackType }))}
        />
      </View>
      {locked ? (
        <Text style={[type.meta, styles.lockNote, { color: c.text3 }]}>Can't change once you've logged it.</Text>
      ) : null}

      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={[type.button, { color: c.text }]}>One side at a time</Text>
          <Text style={[type.meta, { color: c.text2 }]}>Reps count per arm or leg.</Text>
        </View>
        <Switch
          value={draft.unilateral}
          onValueChange={(unilateral) => setDraft((d) => ({ ...d, unilateral }))}
          trackColor={{ true: c.accent }}
          accessibilityLabel="One side at a time"
        />
      </View>

      <Text style={[type.meta, styles.hint, { color: error ? c.danger : c.text3 }]}>{error ?? problem ?? ' '}</Text>

      <Pressable
        onPress={() => void save()}
        disabled={!canSave}
        accessibilityRole="button"
        style={({ pressed }) => [styles.save, { backgroundColor: c.accent }, (pressed || !canSave) && styles.pressed]}>
        <Text style={[type.button, { color: palettes.light.bg }]}>
          {busy === 'save' ? 'Saving…' : editing ? 'Save' : 'Create'}
        </Text>
      </Pressable>

      {editing ? (
        <Pressable
          onPress={confirmDelete}
          disabled={busy !== null}
          accessibilityRole="button"
          style={({ pressed }) => [styles.delete, pressed && styles.pressed]}>
          <Text style={[type.button, { color: c.danger }]}>{busy === 'delete' ? 'Deleting…' : 'Delete exercise'}</Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
});

const styles = StyleSheet.create({
  header: { fontSize: 15, paddingBottom: spacing.md, paddingHorizontal: 4 },
  field: {
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
  },
  input: { fontSize: 17, paddingVertical: spacing.md },
  label: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    paddingHorizontal: 4,
  },
  locked: { opacity: 0.5 },
  lockNote: { paddingTop: spacing.xs, paddingHorizontal: 4 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  switchText: { flex: 1, gap: 2 },
  hint: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: 4,
  },
  save: {
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  delete: { alignItems: 'center', paddingVertical: spacing.lg },
  pressed: { opacity: 0.7 },
});
