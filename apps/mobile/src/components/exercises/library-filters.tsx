import { CANONICAL_MUSCLES, formatEquipmentLabel, muscleLabel, normalizeSearch } from '@liftcamp/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import type { SheetRef } from '@/components/BottomSheet';
import { EquipmentIcon } from '@/components/equipment-icon';
import { PickSheet, type PickOption } from '@/components/exercises/pick-sheet';
import { Text } from '@/components/text';
import { peekAllExercises, searchExercises, type ExerciseInfo } from '@/data/workouts';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/** Chip labels for `exercises.level`. The table stores `expert` for the top tier. */
const LEVELS: PickOption<string>[] = [
  { key: 'beginner', label: 'Beginner' },
  { key: 'intermediate', label: 'Intermediate' },
  { key: 'expert', label: 'Advanced' },
];

export type Filters = { muscle: string | null; equipment: string | null; level: string | null; yours: boolean };

export const NO_FILTERS: Filters = { muscle: null, equipment: null, level: null, yours: false };

/**
 * Search and filters over the exercise library, shared by the Workout tab
 * and the workout's picker.
 *
 * Search runs on the server through searchExercises (an empty term is the
 * whole library, cached for the session); the filters run here over the
 * results, since the rows carry everything the filters read. `active` false
 * pauses the search, for a picker that is closed.
 */
export function useLibrarySearch(lastDone: Map<string, string>, active = true) {
  const [term, setTerm] = useState('');
  // Both start from the session cache when the library has loaded before.
  const [results, setResults] = useState<ExerciseInfo[] | null>(() => peekAllExercises() ?? null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [library, setLibrary] = useState<ExerciseInfo[]>(() => peekAllExercises() ?? []);

  // The whole library once, for the Equipment chip's distinct values. The
  // same call the empty search makes, which shares its request in flight
  // and its cache after, so the two cost one fetch.
  useEffect(() => {
    if (active) searchExercises('').then(setLibrary);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    // Debounced so a fast typist does not fire a query per keystroke. The
    // empty term is the whole library, one shared request that is cached
    // after the first, so it runs at once: on open and when the search is
    // cleared.
    const t = setTimeout(
      () => {
        searchExercises(term).then((rows) => {
          if (!cancelled) setResults(rows);
        });
      },
      term.trim() === '' ? 0 : 200,
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term, active]);

  /** Filtered results, or null until the first search returns. */
  const rows = useMemo(() => {
    if (!results) return null;
    let out = results.filter(
      (e) =>
        (!filters.muscle || e.primary_muscle === filters.muscle) &&
        (!filters.equipment || e.equipment === filters.equipment) &&
        (!filters.level || e.level === filters.level) &&
        (!filters.yours || lastDone.has(e.id)),
    );
    // Yours reads as a log, most recent first; everything else keeps the
    // search's A to Z order.
    if (filters.yours) {
      out = [...out].sort((a, b) => (lastDone.get(b.id) ?? '').localeCompare(lastDone.get(a.id) ?? ''));
    }
    return out;
  }, [results, filters, lastDone]);

  const anyFilter = Boolean(filters.muscle || filters.equipment || filters.level || filters.yours);
  /** Neither a search term nor a filter: the list is the whole library. */
  const unfiltered = !normalizeSearch(term) && !anyFilter;
  /** What an empty list says, or null when it should say nothing. */
  const emptyCopy =
    filters.yours && lastDone.size === 0
      ? 'Exercises you log will show up here.'
      : unfiltered
        ? null
        : 'No exercises match.';

  /** Clears the search and every filter. Stable, so an open effect can call it. */
  const reset = useCallback(() => {
    setTerm('');
    setFilters(NO_FILTERS);
  }, []);

  return {
    term,
    setTerm,
    filters,
    setFilters,
    library,
    rows,
    emptyCopy,
    unfiltered,
    reset,
  };
}

/**
 * The Muscle, Equipment, Level and Yours chips, and the sheets the first
 * three open. The row persists taps so a chip works on the first touch with
 * the keyboard up, and the keyboard drops before a sheet rises, since a
 * sheet does not avoid it and would open behind it.
 */
export function FilterChips({
  filters,
  setFilters,
  library,
  contentContainerStyle,
}: {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  /** The whole library, for the Equipment chip's distinct values. */
  library: ExerciseInfo[];
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const c = useTheme().colors;
  const muscleRef = useRef<SheetRef>(null);
  const equipmentRef = useRef<SheetRef>(null);
  const levelRef = useRef<SheetRef>(null);

  const equipmentOptions = useMemo<PickOption<string>[]>(() => {
    const seen = new Map<string, number>();
    for (const e of library) if (e.equipment) seen.set(e.equipment, (seen.get(e.equipment) ?? 0) + 1);
    return [...seen.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => ({
        key,
        label: formatEquipmentLabel(key),
        icon: <EquipmentIcon equipment={key} size={18} color={c.text2} />,
      }));
  }, [library, c.text2]);

  const muscleOptions = useMemo<PickOption<string>[]>(
    () => CANONICAL_MUSCLES.map((m) => ({ key: m, label: muscleLabel(m) })),
    [],
  );

  function present(ref: React.RefObject<SheetRef | null>) {
    Keyboard.dismiss();
    ref.current?.present();
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.row}
        contentContainerStyle={[styles.chips, contentContainerStyle]}>
        <Chip
          label="Muscle"
          value={filters.muscle ? muscleLabel(filters.muscle) : null}
          onPress={() => present(muscleRef)}
          onClear={() => setFilters((f) => ({ ...f, muscle: null }))}
        />
        <Chip
          label="Equipment"
          value={filters.equipment ? formatEquipmentLabel(filters.equipment) : null}
          onPress={() => present(equipmentRef)}
          onClear={() => setFilters((f) => ({ ...f, equipment: null }))}
        />
        <Chip
          label="Level"
          value={LEVELS.find((l) => l.key === filters.level)?.label ?? null}
          onPress={() => present(levelRef)}
          onClear={() => setFilters((f) => ({ ...f, level: null }))}
        />
        <Chip
          label="Yours"
          value={filters.yours ? 'Yours' : null}
          onPress={() => setFilters((f) => ({ ...f, yours: true }))}
          onClear={() => setFilters((f) => ({ ...f, yours: false }))}
        />
      </ScrollView>

      <PickSheet
        ref={muscleRef}
        title="Muscle"
        options={muscleOptions}
        value={filters.muscle}
        onPick={(muscle) => setFilters((f) => ({ ...f, muscle }))}
      />
      <PickSheet
        ref={equipmentRef}
        title="Equipment"
        options={equipmentOptions}
        value={filters.equipment}
        onPick={(equipment) => setFilters((f) => ({ ...f, equipment }))}
      />
      <PickSheet
        ref={levelRef}
        title="Level"
        options={LEVELS}
        value={filters.level}
        onPick={(level) => setFilters((f) => ({ ...f, level }))}
      />
    </>
  );
}

/** A filter chip. Idle it names the filter; active it shows the value and a clear control. */
function Chip({
  label,
  value,
  onPress,
  onClear,
}: {
  label: string;
  value: string | null;
  onPress: () => void;
  onClear: () => void;
}) {
  const c = useTheme().colors;
  const active = value != null;
  return (
    <Pressable
      onPress={active ? onClear : onPress}
      accessibilityRole="button"
      accessibilityLabel={active ? `${label} ${value}, clear` : label}
      style={({ pressed }) => [
        styles.chip,
        active ? { backgroundColor: c.accentSoft } : { borderColor: c.border, borderWidth: 1 },
        pressed && styles.pressed,
      ]}>
      <Text style={[type.button, { fontSize: 14, color: active ? c.accentText : c.text }]}>
        {active ? value : label}
      </Text>
      {active ? <Text style={[type.button, { fontSize: 14, color: c.accentText }]}>×</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // A horizontal ScrollView in a column stretches to fill it otherwise.
  row: { flexGrow: 0 },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  pressed: { opacity: 0.7 },
});
