import {
  CANONICAL_MUSCLES,
  formatEquipmentLabel,
  muscleLabel,
  normalizeSearch,
} from '@liftcamp/shared';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import type { SheetRef } from '@/components/BottomSheet';
import { EquipmentIcon } from '@/components/equipment-icon';
import { ExerciseThumb } from '@/components/exercise-media';
import { PickSheet, type PickOption } from '@/components/exercises/pick-sheet';
import { REVEAL_MS, Skeleton, SkeletonText } from '@/components/skeleton';
import { Text, TextInput } from '@/components/text';
import { peekAllExercises, searchExercises, type ExerciseInfo } from '@/data/workouts';
import { useTheme } from '@/theme/theme-provider';
import { listSurface, radius, spacing, type } from '@/theme/tokens';

/** Chip labels for `exercises.level`. The table stores `expert` for the top tier. */
const LEVELS: PickOption<string>[] = [
  { key: 'beginner', label: 'Beginner' },
  { key: 'intermediate', label: 'Intermediate' },
  { key: 'expert', label: 'Advanced' },
];

type Filters = { muscle: string | null; equipment: string | null; level: string | null; yours: boolean };

const NO_FILTERS: Filters = { muscle: null, equipment: null, level: null, yours: false };

/** "12 Sep", for the Last done column. */
function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * The exercise library: a search field over `exercises.search_all`, four
 * filter chips, and the list. Its own component so the picker can adopt it
 * later; `onSelect` is what a tap does, and the host decides.
 *
 * Search runs on the server through searchExercises (an empty term is the
 * whole library, cached for the session); the filters run here over the
 * results, since the rows carry everything the filters read.
 */
export function ExerciseLibrary({
  lastDone,
  onSelect,
}: {
  /** Exercise id to the date it was last done, for the Yours chip and the Last done column. */
  lastDone: Map<string, string>;
  onSelect: (exercise: ExerciseInfo) => void;
}) {
  const { scheme, colors: c } = useTheme();
  const [term, setTerm] = useState('');
  // Both start from the session cache when the library has loaded before.
  const [results, setResults] = useState<ExerciseInfo[] | null>(() => peekAllExercises() ?? null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [library, setLibrary] = useState<ExerciseInfo[]>(() => peekAllExercises() ?? []);
  // Rows fade in only on the render that replaces the skeleton. Rows that
  // mount later (a search, scrolling) appear as they always did.
  const waited = useRef(results === null);
  const revealed = useRef(false);
  const fadeRows = waited.current && !revealed.current && results !== null;
  useEffect(() => {
    if (results !== null) revealed.current = true;
  }, [results]);
  const muscleRef = useRef<SheetRef>(null);
  const equipmentRef = useRef<SheetRef>(null);
  const levelRef = useRef<SheetRef>(null);

  // The whole library once, for the Equipment chip's distinct values. The
  // same call the empty search makes, which shares its request in flight
  // and its cache after, so the two cost one fetch.
  useEffect(() => {
    searchExercises('').then(setLibrary);
  }, []);

  useEffect(() => {
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
  }, [term]);

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
    // search's compounds-first order.
    if (filters.yours) {
      out = [...out].sort((a, b) => (lastDone.get(b.id) ?? '').localeCompare(lastDone.get(a.id) ?? ''));
    }
    return out;
  }, [results, filters, lastDone]);

  const anyFilter = filters.muscle || filters.equipment || filters.level || filters.yours;
  const emptyCopy =
    filters.yours && lastDone.size === 0
      ? 'Exercises you log will show up here.'
      : normalizeSearch(term) || anyFilter
        ? 'No exercises match.'
        : null;

  return (
    <>
      <FlatList
        data={rows ?? []}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <Animated.View entering={fadeRows ? FadeIn.duration(REVEAL_MS) : undefined}>
            <LibraryRow item={item} lastDone={lastDone.get(item.id) ?? null} onPress={onSelect} />
          </Animated.View>
        )}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          <View style={styles.head}>
            <TextInput
              value={term}
              onChangeText={setTerm}
              placeholder="Search exercises"
              placeholderTextColor={c.text3}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              returnKeyType="search"
              style={[styles.search, { backgroundColor: c.inputFill, borderColor: c.border, color: c.text }]}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.chips}>
              <Chip
                label="Muscle"
                value={filters.muscle ? muscleLabel(filters.muscle) : null}
                onPress={() => muscleRef.current?.present()}
                onClear={() => setFilters((f) => ({ ...f, muscle: null }))}
              />
              <Chip
                label="Equipment"
                value={filters.equipment ? formatEquipmentLabel(filters.equipment) : null}
                onPress={() => equipmentRef.current?.present()}
                onClear={() => setFilters((f) => ({ ...f, equipment: null }))}
              />
              <Chip
                label="Level"
                value={LEVELS.find((l) => l.key === filters.level)?.label ?? null}
                onPress={() => levelRef.current?.present()}
                onClear={() => setFilters((f) => ({ ...f, level: null }))}
              />
              <Chip
                label="Yours"
                value={filters.yours ? 'Yours' : null}
                onPress={() => setFilters((f) => ({ ...f, yours: true }))}
                onClear={() => setFilters((f) => ({ ...f, yours: false }))}
              />
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          rows == null ? (
            <LibrarySkeleton />
          ) : emptyCopy ? (
            <Text style={[type.meta, styles.empty, { color: c.text2 }]}>{emptyCopy}</Text>
          ) : null
        }
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        // Twelve rows fill a screen; the first batch renders before scroll.
        initialNumToRender={14}
        windowSize={7}
      />

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

function Separator() {
  return <View style={styles.separator} />;
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

const SKELETON_ROWS = [
  ['52%', '38%'],
  ['64%', '44%'],
  ['46%', '34%'],
  ['58%', '40%'],
  ['70%', '46%'],
  ['50%', '36%'],
  ['62%', '42%'],
  ['44%', '32%'],
] as const;

/** The first load's rows: thumbnail, name and meta, under the real search and chips. */
function LibrarySkeleton() {
  const { scheme, colors: c } = useTheme();
  return (
    <Animated.View
      exiting={FadeOut.duration(REVEAL_MS)}
      accessible
      accessibilityLabel="Loading"
      style={styles.skeleton}>
      {SKELETON_ROWS.map(([name, meta], i) => (
        <View key={i} style={[styles.row, listSurface(scheme, c)]}>
          <Skeleton width={44} height={44} radius={radius.input} />
          <View style={styles.rowText}>
            <SkeletonText variant={type.exerciseName} width={name} />
            <SkeletonText variant={type.meta} width={meta} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

/**
 * One library row. Memoised so a Last done map refresh re-renders only the
 * rows whose date changed, which keeps 900 thumbnails smooth.
 */
const LibraryRow = memo(function LibraryRow({
  item,
  lastDone,
  onPress,
}: {
  item: ExerciseInfo;
  lastDone: string | null;
  onPress: (item: ExerciseInfo) => void;
}) {
  const { scheme, colors: c } = useTheme();
  const meta = [item.primary_muscle ? muscleLabel(item.primary_muscle) : null, formatEquipmentLabel(item.equipment)]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, listSurface(scheme, c), pressed && styles.pressed]}>
      <ExerciseThumb exercise={item} size={44} />
      <View style={styles.rowText}>
        <Text style={[type.exerciseName, { color: c.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[type.meta, { color: c.text2 }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {lastDone ? (
        <View style={styles.lastDone}>
          <Text style={[type.label, { color: c.text3 }]}>Last done</Text>
          <Text style={[type.prevNumeral, { color: c.text2 }]}>{shortDate(lastDone)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xl },
  head: { gap: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md },
  search: {
    height: 44,
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  separator: { height: spacing.sm },
  skeleton: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.bar,
    padding: spacing.md,
  },
  rowText: { flex: 1, gap: 2 },
  lastDone: { alignItems: 'flex-end', gap: 2 },
  empty: { textAlign: 'center', paddingTop: spacing.xl },
  pressed: { opacity: 0.7 },
});
