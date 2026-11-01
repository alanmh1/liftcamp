import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import {
  CANONICAL_MUSCLES,
  CUSTOM_EQUIPMENT,
  CUSTOM_NAME_MAX,
  customExerciseErrorCopy,
  draftProblem,
  EMPTY_DRAFT,
  findDuplicateExercise,
  formatEquipmentLabel,
  muscleLabel,
  rowToDraft,
  TRACK_TYPES,
  type CanonicalMuscle,
  type CustomExerciseDraft,
  type TrackType,
} from '@liftcamp/shared';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { Segmented } from '@/components/exercises/segmented';
import { EquipmentIcon } from '@/components/equipment-icon';
import { PickManySheet, PickSheet, type PickOption } from '@/components/exercises/pick-sheet';
import { ListGroup, ListRow } from '@/components/settings-ui';
import { Text } from '@/components/text';
import {
  archiveCustomExercise,
  createCustomExercise,
  customExerciseHasSets,
  updateCustomExercise,
} from '@/data/custom-exercises';
import { peekAllExercises, searchExercises, type ExerciseInfo } from '@/data/workouts';
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
 *
 * A line under the name asks the user to search first. The name is also
 * checked against the library as it is typed: one of the user's own with
 * that name blocks Create (it would be a second copy); a catalog match is
 * offered through `onPickExisting`, since a user may still want their own
 * variant.
 */
export const CustomExerciseSheet = forwardRef<
  SheetRef,
  {
    editing: ExerciseInfo | null;
    initialName?: string;
    /** The saved row. The host adds it, selects it, or refreshes. */
    onSaved: (exercise: ExerciseInfo) => void;
    /**
     * The host already knows the exercise has logged sets (the exercise
     * screen's history). True locks tracking at once; the sheet's own read
     * still runs, for a host that does not know.
     */
    hasSets?: boolean;
    /** A catalog exercise with the typed name, chosen instead of creating. Hosts treat it like a tap. */
    onPickExisting?: (exercise: ExerciseInfo) => void;
    /** After a delete. The host leaves the screen or refreshes its list. */
    onDeleted?: (id: string) => void;
  }
>(function CustomExerciseSheet({ editing, initialName, hasSets, onSaved, onPickExisting, onDeleted }, ref) {
  const c = useColors();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [draft, setDraft] = useState<CustomExerciseDraft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  const [readLocked, setReadLocked] = useState(false);
  const locked = !!editing && (hasSets || readLocked);
  // The library, for the duplicate check. Usually already in the session
  // cache from the screen that opened this sheet; read once otherwise.
  const [library, setLibrary] = useState<ExerciseInfo[]>(() => peekAllExercises() ?? []);
  useEffect(() => {
    if (library.length === 0) searchExercises('').then(setLibrary);
  }, [library.length]);

  // A fresh draft for each exercise (or each new one), and the lock read
  // for an edit. A screen that re-presents the sheet for the same row
  // keeps what the user typed.
  useEffect(() => {
    setError(null);
    if (editing) {
      setDraft(rowToDraft(editing));
      setReadLocked(false);
      if (userId) {
        let cancelled = false;
        customExerciseHasSets(userId, editing.id).then((has) => {
          if (!cancelled) setReadLocked(has);
        });
        return () => {
          cancelled = true;
        };
      }
    } else {
      setDraft({ ...EMPTY_DRAFT, name: initialName ?? '' });
      setReadLocked(false);
    }
  }, [editing, initialName, userId]);

  const duplicate = findDuplicateExercise(draft.name, library, editing?.id);
  const problem =
    draftProblem(draft) ?? (duplicate?.kind === 'own' ? `You already have ${duplicate.exercise.name}.` : null);
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

  // The three choices open pick sheets over this one, the same lists the
  // library's filter chips use, so the form stays one screen tall.
  const primaryRef = useRef<SheetRef>(null);
  const secondaryRef = useRef<SheetRef>(null);
  const equipmentRef = useRef<SheetRef>(null);
  const muscleOptions = useMemo<PickOption<string>[]>(
    () => CANONICAL_MUSCLES.map((m) => ({ key: m, label: muscleLabel(m) })),
    [],
  );
  const secondaryOptions = useMemo(
    () => muscleOptions.filter((o) => o.key !== draft.primaryMuscle),
    [muscleOptions, draft.primaryMuscle],
  );
  const equipmentOptions = useMemo<PickOption<string>[]>(
    () => [
      { key: '', label: 'None' },
      ...CUSTOM_EQUIPMENT.map((e) => ({
        key: e,
        label: formatEquipmentLabel(e),
        icon: <EquipmentIcon equipment={e} size={18} color={c.text2} />,
      })),
    ],
    [c.text2],
  );
  const secondaryLabel =
    draft.secondaryMuscles.length > 0 ? draft.secondaryMuscles.map(muscleLabel).join(', ') : null;

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
      {editing ? null : duplicate?.kind === 'catalog' ? (
        <Pressable
          onPress={() => {
            onPickExisting?.(duplicate.exercise);
            dismiss();
          }}
          disabled={!onPickExisting}
          accessibilityRole="button"
          style={({ pressed }) => [styles.existing, { backgroundColor: c.accentSoft }, pressed && styles.pressed]}>
          <Text style={[type.meta, { color: c.accentText }]}>
            {duplicate.exercise.name} is already in the library.{onPickExisting ? ' Tap to use it instead.' : ''}
          </Text>
        </Pressable>
      ) : (
        <Text style={[type.meta, styles.searchFirst, { color: c.text3 }]}>
          The library has over 900 exercises. Search it first, and create one only when yours isn't there.
        </Text>
      )}

      <View style={styles.group}>
        <ListGroup>
          <ListRow
            label="Main muscle"
            value={draft.primaryMuscle ? muscleLabel(draft.primaryMuscle) : null}
            onPress={() => primaryRef.current?.present()}
          />
          <ListRow label="Also works" value={secondaryLabel} onPress={() => secondaryRef.current?.present()} />
          <ListRow
            label="Equipment"
            value={draft.equipment ? formatEquipmentLabel(draft.equipment) : 'None'}
            onPress={() => equipmentRef.current?.present()}
          />
        </ListGroup>
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

      {/* `push`: these open over this sheet, which must stay up under them. */}
      <PickSheet
        ref={primaryRef}
        stackBehavior="push"
        title="Main muscle"
        options={muscleOptions}
        value={draft.primaryMuscle}
        onPick={(m) =>
          setDraft((d) => ({
            ...d,
            primaryMuscle: m as CanonicalMuscle,
            secondaryMuscles: d.secondaryMuscles.filter((x) => x !== m),
          }))
        }
      />
      <PickManySheet
        ref={secondaryRef}
        stackBehavior="push"
        title="Also works"
        options={secondaryOptions}
        values={draft.secondaryMuscles}
        onToggle={(m) => toggleSecondary(m as CanonicalMuscle)}
      />
      <PickSheet
        ref={equipmentRef}
        stackBehavior="push"
        title="Equipment"
        options={equipmentOptions}
        value={draft.equipment ?? ''}
        onPick={(e) => setDraft((d) => ({ ...d, equipment: e || null }))}
      />
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
  group: { paddingTop: spacing.lg },
  locked: { opacity: 0.5 },
  lockNote: { paddingTop: spacing.xs, paddingHorizontal: 4 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  switchText: { flex: 1, gap: 2 },
  searchFirst: { paddingTop: spacing.sm, paddingHorizontal: 4 },
  existing: { marginTop: spacing.sm, borderRadius: radius.input, padding: spacing.md },
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
