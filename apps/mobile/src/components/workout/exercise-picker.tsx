import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
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
import { FilterChips, useLibrarySearch } from '@/components/exercises/library-filters';
import { ExerciseInfoSheet } from '@/components/exercise-info-sheet';
import { ExerciseThumb } from '@/components/exercise-media';
import { Text, TextInput } from '@/components/text';
import { getLastDoneDates } from '@/data/exercise-progress';
import { getRecentExercises, type ExerciseInfo } from '@/data/workouts';
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
          name="info.circle"
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
 * Yours filters (library-filters.tsx, shared with the Exercises tab) over a
 * list, A to Z. The chips sit above the list rather than in it, so they stay
 * on screen with the keyboard up. With no search and no filter, the user's
 * last 8 distinct exercises sit above the list under Recent; a user with no
 * history gets the plain list.
 *
 * Selection is a Map keyed by exercise id. It survives searching, because the
 * map is independent of the current result set, and a Map's insertion order
 * is the selection order, which is the order the exercises are added to the
 * workout.
 */
export function ExercisePicker({
  visible,
  mode,
  title,
  onConfirm,
  onClose,
}: {
  visible: boolean;
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
  // Kept across opens, so a reopen shows the last list while it refreshes
  // rather than the section popping in.
  const [recent, setRecent] = useState<ExerciseInfo[]>([]);
  const { term, setTerm, filters, setFilters, library, rows, emptyCopy, unfiltered, reset } =
    useLibrarySearch(lastDone, visible);
  const [selected, setSelected] = useState<Map<string, ExerciseInfo>>(new Map());
  const searchRef = useRef<TextInput>(null);
  const infoRef = useRef<SheetRef>(null);
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
    getRecentExercises(userId).then((r) => {
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

  // Recent only over the whole library. A recent exercise is in both
  // sections; selection is keyed by id, so a tick in one shows in the other.
  // No sections at all for an empty result, so the empty copy shows.
  const sections: PickerSection[] =
    rows == null || rows.length === 0
      ? []
      : unfiltered && recent.length > 0
        ? [
            { key: 'recent', title: 'Recent', data: recent },
            { key: 'all', title: 'All exercises', data: rows },
          ]
        : [{ key: 'all', title: null, data: rows }];
  const count = selected.size;

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
                    keyboard. Android resizes the window itself (adjustResize),
                    so it gets no behavior and the default layout does the job. */}
                <KeyboardAvoidingView
                  style={styles.fill}
                  behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
                      keyExtractor={(item) => item.id}
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
                      // The footer covers the last row otherwise.
                      ListFooterComponent={count > 0 ? <View style={styles.footerSpacer} /> : null}
                      // Rows re-render on selection change only when their own
                      // number changes; the list needs to be told the data
                      // depends on it, or memoised rows go stale.
                      extraData={orderOf}
                      ListEmptyComponent={
                        emptyCopy ? (
                          <Text style={[type.meta, styles.empty, { color: c.text2 }]}>{emptyCopy}</Text>
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
                </KeyboardAvoidingView>
              </SafeAreaView>
            </View>
            <ExerciseInfoSheet ref={infoRef} exercise={infoExercise} />
          </BottomSheetModalProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Modal>
  );
}

type PickerSection = { key: string; title: string | null; data: ExerciseInfo[] };

/** Space between the sections, drawn above and below each one. */
function SectionGap() {
  return <View style={styles.sectionGap} />;
}

const FOOTER_HEIGHT = 76;

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
  footerSpacer: { height: FOOTER_HEIGHT },
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
