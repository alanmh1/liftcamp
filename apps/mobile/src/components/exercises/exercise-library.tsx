import { canCreateCustom, formatEquipmentLabel, muscleLabel } from '@liftcamp/shared';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import type { SheetRef } from '@/components/BottomSheet';
import { ExerciseThumb } from '@/components/exercise-media';
import { CreateExerciseRow } from '@/components/exercises/create-exercise-row';
import { CustomExerciseSheet } from '@/components/exercises/custom-exercise-sheet';
import { CustomLimitSheet } from '@/components/exercises/custom-limit-sheet';
import { FilterChips, useLibrarySearch } from '@/components/exercises/library-filters';
import { REVEAL_MS, Skeleton, SkeletonText } from '@/components/skeleton';
import { Text, TextInput } from '@/components/text';
import type { ExerciseInfo } from '@/data/workouts';
import { useCustomExerciseStatus } from '@/lib/custom-exercise-access';
import { SCROLL_END_PADDING, scrollInsetProps } from '@/lib/scroll-insets';
import { useTheme } from '@/theme/theme-provider';
import { listSurface, radius, spacing, type } from '@/theme/tokens';

/** "Sep 12", for the Last done column. */
function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

/**
 * The exercise library: a search field over `exercises.search_all`, four
 * filter chips, and the list. `onSelect` is what a tap does, and the host
 * decides. The search and filters live in library-filters.tsx, which the
 * workout's picker shares. Workout's library screen (train/exercises.tsx)
 * is the host.
 *
 * With custom exercises on for the user, a search that finds nothing
 * offers to create it by name, and a standing row under the list does the
 * same. A new one opens its screen through `onSelect`, like a tap would.
 */
export function ExerciseLibrary({
  lastDone,
  onSelect,
}: {
  /** Exercise id to the date it was last done, for the Yours chip and the Last done column. */
  lastDone: Map<string, string>;
  onSelect: (exercise: ExerciseInfo) => void;
}) {
  const c = useTheme().colors;
  const { term, setTerm, filters, setFilters, library, rows, emptyCopy, refresh } = useLibrarySearch(lastDone);
  const status = useCustomExerciseStatus();
  const createRef = useRef<SheetRef>(null);
  const limitRef = useRef<SheetRef>(null);
  const [createName, setCreateName] = useState('');
  const openCreate = useCallback(
    (name: string) => {
      Keyboard.dismiss();
      if (!canCreateCustom(status)) {
        limitRef.current?.present();
        return;
      }
      setCreateName(name);
      createRef.current?.present();
    },
    [status],
  );
  // A row tap usually opens another screen. The search field would keep the
  // keyboard up over it, since the list lets taps through to rows.
  const select = useCallback(
    (exercise: ExerciseInfo) => {
      Keyboard.dismiss();
      onSelect(exercise);
    },
    [onSelect],
  );
  // Rows fade in only on the render that replaces the skeleton. Rows that
  // mount later (a search, scrolling) appear as they always did.
  const waited = useRef(rows === null);
  const revealed = useRef(false);
  const fadeRows = waited.current && !revealed.current && rows !== null;
  useEffect(() => {
    if (rows !== null) revealed.current = true;
  }, [rows]);

  return (
    <>
      <FlatList
        data={rows ?? []}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <Animated.View entering={fadeRows ? FadeIn.duration(REVEAL_MS) : undefined}>
            <LibraryRow item={item} lastDone={lastDone.get(item.id) ?? null} onPress={select} />
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
              style={[
                styles.search,
                {
                  backgroundColor: c.inputFill,
                  borderColor: c.border,
                  color: c.text,
                },
              ]}
            />
            <FilterChips filters={filters} setFilters={setFilters} library={library} />
          </View>
        }
        ListEmptyComponent={
          rows == null ? (
            <LibrarySkeleton />
          ) : emptyCopy && status?.enabled && term.trim() ? (
            <CreateExerciseRow status={status} variant="miss" term={term} onPress={() => openCreate(term)} />
          ) : emptyCopy ? (
            <Text style={[type.meta, styles.empty, { color: c.text2 }]}>{emptyCopy}</Text>
          ) : null
        }
        ListFooterComponent={
          rows != null && rows.length > 0 ? (
            <CreateExerciseRow status={status} variant="footer" onPress={() => openCreate('')} />
          ) : null
        }
        {...scrollInsetProps}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        // Twelve rows fill a screen; the first batch renders before scroll.
        initialNumToRender={14}
        windowSize={7}
      />
      {/* The sheets portal into the root provider's host, so they sit
        beside the list rather than in it. A new exercise opens like a
        tapped row; the list reads again behind it. */}
      <CustomExerciseSheet
        ref={createRef}
        editing={null}
        initialName={createName}
        onSaved={(exercise) => {
          refresh();
          onSelect(exercise);
        }}
      />
      <CustomLimitSheet ref={limitRef} limit={status?.limit ?? 0} />
    </>
  );
}

function Separator() {
  return <View style={styles.separator} />;
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
  list: {
    paddingHorizontal: spacing.screen,
    paddingBottom: SCROLL_END_PADDING,
  },
  head: { gap: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md },
  search: {
    height: 44,
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    fontSize: 16,
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
