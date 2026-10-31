import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { canCreateCustom } from '@liftcamp/shared';
import { SymbolView } from 'expo-symbols';
import { memo, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import type { SheetRef } from '@/components/BottomSheet';
import { CreateExerciseRow } from '@/components/exercises/create-exercise-row';
import { CustomExerciseSheet } from '@/components/exercises/custom-exercise-sheet';
import { CustomLimitSheet } from '@/components/exercises/custom-limit-sheet';
import { FilterChips, useLibrarySearch } from '@/components/exercises/library-filters';
import { ExerciseInfoSheet } from '@/components/exercise-info-sheet';
import { ExerciseThumb } from '@/components/exercise-media';
import { Skeleton, SkeletonText } from '@/components/skeleton';
import { Text, TextInput } from '@/components/text';
import { getLastDoneDates } from '@/data/exercise-progress';
import { getRecentExercises, type ExerciseInfo } from '@/data/workouts';
import { useCustomExerciseStatus } from '@/lib/custom-exercise-access';
import { useKeyboardOverlap } from '@/lib/keyboard-overlap';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/**
 * `multi` toggles rows and confirms from a footer button; `single` confirms
 * on the first tap. Replace from the exercise menu uses `single`, because a
 * card can only point at one exercise.
 */
export type PickerMode = 'multi' | 'single';

/**
 * One picker row. Two sibling touch targets that do not overlap: the row body
 * (thumbnail, text, selection marker) toggles or confirms, and the 44pt info
 * button opens the info sheet. Memoised so a selection change re-renders only
 * the rows whose number changed, which is what keeps 898 thumbnails smooth.
 */
const PickerRow = memo(function PickerRow({
  item,
  order,
  mode,
  onPress,
  onInfo,
}: {
  item: ExerciseInfo;
  order: number | undefined;
  mode: PickerMode;
  onPress: (item: ExerciseInfo) => void;
  onInfo: (item: ExerciseInfo) => void;
}) {
  const c = useColors();
  const selected = order != null;
  return (
    <View style={[styles.item, { backgroundColor: selected ? c.accentSoft : c.surface }]}>
      <Pressable
        onPress={() => onPress(item)}
        accessibilityRole={mode === 'multi' ? 'checkbox' : 'button'}
        accessibilityState={mode === 'multi' ? { checked: selected } : undefined}
        style={({ pressed }) => [styles.itemBody, pressed && styles.pressed]}>
        <ExerciseThumb exercise={item} />
        <View style={styles.itemText}>
          <Text style={[type.exerciseName, { color: c.text }]} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={[type.meta, { color: c.text2 }]} numberOfLines={1}>
            {[item.mechanic || null, item.equipment || null, item.primary_muscle || null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        {/* The slot is always laid out so the text column keeps its width;
            only a selected row draws anything in it. Selection order is still
            the Map's insertion order and still drives the add order, it is
            just no longer printed on the row. */}
        {mode === 'multi' ? (
          <View style={styles.markerSlot}>
            {selected ? (
              <View style={[styles.marker, { backgroundColor: c.accent }]}>
                <Text style={styles.markerCheck}>✓</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </Pressable>

      <Pressable
        onPress={() => onInfo(item)}
        accessibilityRole="button"
        accessibilityLabel={`About ${item.name}`}
        hitSlop={4}
        style={({ pressed }) => [styles.info, pressed && styles.pressed]}>
        <SymbolView
          name={{ ios: 'info.circle', android: 'info' }}
          size={22}
          tintColor={c.text2}
          fallback={<Text style={[styles.infoFallback, { color: c.text2 }]}>ⓘ</Text>}
        />
      </Pressable>
    </View>
  );
});

/**
 * The picker: the library's search and its Muscle, Equipment, Level and
 * Yours filters (library-filters.tsx, shared with the Workout tab's library) over a
 * list, A to Z. The chips sit above the list rather than in it, so they stay
 * on screen with the keyboard up. With no search and no filter, the user's
 * last 8 distinct exercises not already in the workout sit above the list
 * under Recent; a user with no other history gets the plain list.
 *
 * Selection is a Map keyed by exercise id. It survives searching, because the
 * map is independent of the current result set, and a Map's insertion order
 * is the selection order, which is the order the exercises are added to the
 * workout.
 */
export function ExercisePicker({
  visible,
  excludeIds,
  recentHint,
  mode,
  title,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  /** Exercise ids already in the workout, left out of Recent. */
  excludeIds: string[];
  /**
   * The screen's own recent list (getRecentExercises at its default 8), or
   * null before it loads. Only read to learn, before the picker's first
   * fetch returns, that Recent will be empty, so no skeleton is drawn for it.
   */
  recentHint: ExerciseInfo[] | null;
  mode: PickerMode;
  title: string;
  /** Selected exercises in selection order. One element in `single` mode. */
  onConfirm: (exercises: ExerciseInfo[]) => void;
  onClose: () => void;
}) {
  const c = useColors();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [lastDone, setLastDone] = useState<Map<string, string>>(new Map());
  // Null until the first fetch returns. Kept across opens, so a reopen
  // shows the last list while it refreshes rather than the section popping
  // in. Fetched with room for the exclusions and trimmed at render.
  const [recent, setRecent] = useState<ExerciseInfo[] | null>(null);
  const excludeRef = useRef(excludeIds);
  excludeRef.current = excludeIds;
  const { term, setTerm, filters, setFilters, library, rows, emptyCopy, unfiltered, reset, refresh } =
    useLibrarySearch(lastDone, visible);
  const [selected, setSelected] = useState<Map<string, ExerciseInfo>>(new Map());
  const searchRef = useRef<TextInput>(null);
  const infoRef = useRef<SheetRef>(null);
  // Custom exercises: the Create row under the list and in place of a
  // search miss, and the two sheets it opens. Nothing renders without
  // the flag (CreateExerciseRow returns null).
  const status = useCustomExerciseStatus();
  const createRef = useRef<SheetRef>(null);
  const limitRef = useRef<SheetRef>(null);
  const [createName, setCreateName] = useState('');
  function openCreate(name: string) {
    Keyboard.dismiss();
    if (!canCreateCustom(status)) {
      limitRef.current?.present();
      return;
    }
    setCreateName(name);
    createRef.current?.present();
  }
  // A new exercise is picked at once: confirmed in `single`, selected in
  // `multi`. The list reads again behind it so it is there on a reopen.
  function onCreated(exercise: ExerciseInfo) {
    refresh();
    if (mode === 'single') {
      onConfirm([exercise]);
      return;
    }
    setSelected((prev) => new Map(prev).set(exercise.id, exercise));
  }
  const androidBody = useRef<View>(null);
  const androidKeyboard = useKeyboardOverlap(androidBody);
  const [infoExercise, setInfoExercise] = useState<ExerciseInfo | null>(null);

  // A fresh selection, search and filters every time the picker opens.
  // Last done and Recent are read again too, so a workout finished (or an
  // exercise added) since the last open counts.
  useEffect(() => {
    if (!visible) return;
    setSelected(new Map());
    reset();
    if (!userId) return;
    let cancelled = false;
    getLastDoneDates(userId).then((m) => {
      if (!cancelled) setLastDone(m);
    });
    getRecentExercises(userId, RECENT_COUNT + excludeRef.current.length).then((r) => {
      if (!cancelled) setRecent(r);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, userId, reset]);

  function onRowPress(item: ExerciseInfo) {
    if (mode === 'single') {
      onConfirm([item]);
      return;
    }
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  }

  const orderOf = new Map([...selected.keys()].map((id, i) => [id, i + 1]));

  // Recent without what the workout already has, then the last 8. Filtered
  // here rather than in the fetch, so an exercise added since the last
  // fetch drops out at once and the next one moves up.
  const excluded = new Set(excludeIds);
  const recentRows = recent?.filter((e) => !excluded.has(e.id)).slice(0, RECENT_COUNT) ?? null;
  // Before the first fetch returns, the screen's list can already show the
  // section will be empty: fewer than 8 rows means it is the whole history,
  // and if all of it is in this workout there is nothing left to show.
  // Without a user there is no fetch, so nothing to wait for either.
  const knownEmpty =
    !userId ||
    (recentHint != null && recentHint.length < RECENT_COUNT && recentHint.every((e) => excluded.has(e.id)));
  // Skeleton rows hold the section's place until the first fetch returns,
  // so the list does not jump down when it lands.
  const recentData: PickerItem[] | null =
    recentRows ?? (knownEmpty ? null : Array.from({ length: RECENT_COUNT }, (_, i) => ({ skeleton: i })));

  // Recent only over the whole library. A recent exercise is in both
  // sections; selection is keyed by id, so a tick in one shows in the other.
  // No sections at all for an empty result, so the empty copy shows.
  const sections: PickerSection[] =
    rows == null || rows.length === 0
      ? []
      : unfiltered && recentData && recentData.length > 0
        ? [
            { key: 'recent', title: 'Recent', data: recentData },
            { key: 'all', title: 'All exercises', data: rows },
          ]
        : [{ key: 'all', title: null, data: rows }];
  const count = selected.size;

  const body = (
    <>
      <View style={styles.header}>
        <Text style={[type.screenTitle, { color: c.text }]}>{title}</Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={[type.button, { color: c.accentText }]}>Close</Text>
        </Pressable>
      </View>

      <TextInput
        ref={searchRef}
        value={term}
        onChangeText={setTerm}
        placeholder="Search exercises"
        placeholderTextColor={c.text3}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="done"
        onSubmitEditing={() => searchRef.current?.blur()}
        style={[
          styles.search,
          { backgroundColor: c.inputFill, borderColor: c.border, color: c.text },
        ]}
      />

      <FilterChips
        filters={filters}
        setFilters={setFilters}
        library={library}
        contentContainerStyle={styles.chips}
      />

      {rows === null ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => ('skeleton' in item ? `skeleton-${item.skeleton}` : item.id)}
          stickySectionHeadersEnabled={false}
          // A drag on the list drops the keyboard; a tap on a row
          // selects on the first touch instead of only dismissing.
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          // flex: 1 is what makes this scroll. Without a bounded height the
          // list grows to fit its content and there is nothing to scroll.
          style={styles.fill}
          contentContainerStyle={styles.list}
          // An empty search is all 902 exercises, so the list is
          // virtualized rather than rendered whole. 30 fills the first
          // screen with room to spare; the rest mount as they approach.
          initialNumToRender={30}
          maxToRenderPerBatch={20}
          windowSize={10}
          removeClippedSubviews
          renderSectionHeader={({ section }) =>
            section.title ? (
              <Text style={[type.label, styles.sectionTitle, { color: c.text3 }]}>
                {section.title}
              </Text>
            ) : null
          }
          // Room between one section's group and the next title.
          SectionSeparatorComponent={SectionGap}
          // A grouped list per section: rows on `surface`, a
          // hairline between them. Each row draws its share of the
          // group's border, since a section has no container view.
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: c.border }]} />
          )}
          // Rows re-render on selection change only when their own
          // number changes; the list needs to be told the data
          // depends on it, or memoised rows go stale.
          extraData={orderOf}
          ListEmptyComponent={
            emptyCopy && status?.enabled && term.trim() ? (
              <CreateExerciseRow status={status} variant="miss" term={term} onPress={() => openCreate(term)} />
            ) : emptyCopy ? (
              <Text style={[type.meta, styles.empty, { color: c.text2 }]}>{emptyCopy}</Text>
            ) : null
          }
          ListFooterComponent={
            rows.length > 0 ? (
              <CreateExerciseRow status={status} variant="footer" onPress={() => openCreate('')} />
            ) : null
          }
          renderItem={({ item, index, section }) => (
            <View
              style={[
                styles.groupRow,
                { borderColor: c.border },
                index === 0 && styles.groupFirst,
                index === section.data.length - 1 && styles.groupLast,
              ]}>
              {'skeleton' in item ? (
                <SkeletonRow />
              ) : (
                <PickerRow
                  item={item}
                  order={orderOf.get(item.id)}
                  mode={mode}
                  onPress={onRowPress}
                  onInfo={(ex) => {
                    // The search field may still be focused; a keyboard
                    // left up would cover the sheet's lower half.
                    Keyboard.dismiss();
                    setInfoExercise(ex);
                    infoRef.current?.present();
                  }}
                />
              )}
            </View>
          )}
        />
      )}

      {mode === 'multi' && count > 0 ? (
        <View style={[styles.footer, { backgroundColor: c.bg, borderTopColor: c.border }]}>
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              onConfirm([...selected.values()]);
            }}
            style={({ pressed }) => [
              styles.confirm,
              { backgroundColor: c.accent },
              pressed && styles.pressed,
            ]}>
            <Text style={[type.button, styles.confirmLabel]}>
              Add {count} {count === 1 ? 'exercise' : 'exercises'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* A RN Modal mounts into its own native root view, outside the tree that
          _layout.tsx wraps. Both providers therefore have to be re-established
          here: GestureHandlerRootView, or RNGH swallows the touches and the
          list will not scroll, and SafeAreaProvider, or every inset reads 0 and
          the header sits under the status bar. */}
      <GestureHandlerRootView style={styles.fill}>
        <SafeAreaProvider>
          {/* Third provider re-established for the same reason as the two
              above: a bottom sheet portals into the nearest provider's host,
              and the root's host is in a different native window from this
              Modal. Without this the info sheet opens behind the picker. */}
          <BottomSheetModalProvider>
            <View style={[styles.fill, { backgroundColor: c.bg }]}>
              <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
                {/* padding on iOS pushes the sticky footer up to sit on the
                    keyboard. Android gets a plain view lifted by the measured
                    keyboard overlap (lib/keyboard-overlap), which is 0 when
                    the window resized itself and the covered height when it
                    did not, so the footer sits on the keyboard either way.
                    The footer is in the flow below the list for this to
                    work: an absolute child is placed against the padding
                    box, so the padding never moved a `bottom: 0` footer. */}
                {Platform.OS === 'android' ? (
                  <View
                    ref={androidBody}
                    style={[styles.fill, androidKeyboard.overlap ? { paddingBottom: androidKeyboard.overlap } : null]}>
                    {body}
                  </View>
                ) : (
                  <KeyboardAvoidingView style={styles.fill} behavior="padding">
                    {body}
                  </KeyboardAvoidingView>
                )}
              </SafeAreaView>
            </View>
            <ExerciseInfoSheet ref={infoRef} exercise={infoExercise} />
            <CustomExerciseSheet ref={createRef} editing={null} initialName={createName} onSaved={onCreated} />
            <CustomLimitSheet ref={limitRef} limit={status?.limit ?? 0} />
          </BottomSheetModalProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** How many exercises Recent shows. */
const RECENT_COUNT = 8;

/** A Recent row still loading. */
type PickerItem = ExerciseInfo | { skeleton: number };

type PickerSection = { key: string; title: string | null; data: PickerItem[] };

/** A picker row's shape while Recent loads: thumbnail, name, meta. */
function SkeletonRow() {
  const c = useColors();
  return (
    <View style={[styles.item, { backgroundColor: c.surface }]} accessible accessibilityLabel="Loading">
      <View style={styles.itemBody}>
        <Skeleton width={48} height={48} radius={radius.input} />
        <View style={styles.itemText}>
          <SkeletonText variant={type.exerciseName} width="55%" />
          <SkeletonText variant={type.meta} width="40%" />
        </View>
      </View>
      {/* The info button's width, so the text column matches a real row. */}
      <View style={styles.info} />
    </View>
  );
}

/** Space between the sections, drawn above and below each one. */
function SectionGap() {
  return <View style={styles.sectionGap} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.md,
  },
  search: {
    marginHorizontal: spacing.screen,
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  chips: { paddingHorizontal: spacing.screen, paddingTop: spacing.md },
  loading: { marginTop: spacing.xl },
  empty: { textAlign: 'center', padding: spacing.xl },
  list: {
    paddingHorizontal: spacing.screen,
    paddingVertical: spacing.sm,
  },
  sectionTitle: { paddingHorizontal: spacing.xs, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  sectionGap: { height: spacing.xs },
  // The group's border in slices: sides on every row, top corners on the
  // first, bottom corners on the last.
  groupRow: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: 'hidden',
  },
  groupFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: radius.bar,
    borderTopRightRadius: radius.bar,
  },
  groupLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: radius.bar,
    borderBottomRightRadius: radius.bar,
  },
  // Edge to edge across the group.
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.md,
    paddingVertical: spacing.sm,
    paddingRight: spacing.xs,
  },
  itemBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  itemText: {
    flex: 1,
    gap: 2,
  },
  info: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoFallback: { fontSize: 20 },
  // Centred between the text column and the info button, which the body's
  // gap on one side and the info button's 44pt on the other frame evenly.
  markerSlot: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerCheck: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    padding: spacing.screen,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  confirm: {
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  confirmLabel: { color: '#FFFFFF' },
  pressed: { opacity: 0.8 },
});
