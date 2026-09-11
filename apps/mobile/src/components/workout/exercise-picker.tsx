import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { searchExercises, type ExerciseInfo } from '@/data/workouts';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/**
 * `multi` toggles rows and confirms from a footer button; `single` confirms
 * on the first tap. Replace from the exercise menu uses `single`, because a
 * card can only point at one exercise.
 */
export type PickerMode = 'multi' | 'single';

/**
 * Minimal picker: a search field against `exercises.search_all` and a list,
 * compounds first. The full picker with equipment and muscle filters is
 * Phase 6 screen 2.
 *
 * Selection is a Map keyed by exercise id. It survives searching, because the
 * map is independent of the current result set, and a Map's insertion order
 * is the selection order, which is both the number drawn on the row and the
 * order the exercises are added to the workout.
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
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<ExerciseInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Map<string, ExerciseInfo>>(new Map());
  const searchRef = useRef<TextInput>(null);

  // A fresh selection every time the picker opens.
  useEffect(() => {
    if (visible) {
      setSelected(new Map());
      setTerm('');
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    // Debounced so a fast typist does not fire a query per keystroke.
    const t = setTimeout(() => {
      searchExercises(term).then((rows) => {
        if (!cancelled) {
          setResults(rows);
          setLoading(false);
        }
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term, visible]);

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

                {loading && results.length === 0 ? (
                  <ActivityIndicator style={styles.loading} />
                ) : (
                  <FlatList
                    data={results}
                    keyExtractor={(item) => item.id}
                    // A drag on the list drops the keyboard; a tap on a row
                    // selects on the first touch instead of only dismissing.
                    keyboardDismissMode="on-drag"
                    keyboardShouldPersistTaps="handled"
                    // flex: 1 is what makes this scroll. Without a bounded height the
                    // list grows to fit its content and there is nothing to scroll.
                    style={styles.fill}
                    contentContainerStyle={styles.list}
                    // An empty search is all 898 exercises, so the list is
                    // virtualized rather than rendered whole. 30 fills the first
                    // screen with room to spare; the rest mount as they approach.
                    initialNumToRender={30}
                    maxToRenderPerBatch={20}
                    windowSize={10}
                    removeClippedSubviews
                    // The footer covers the last row otherwise.
                    ListFooterComponent={count > 0 ? <View style={styles.footerSpacer} /> : null}
                    // Rows re-render on selection change only when their own
                    // number changes; FlatList needs to be told the data depends
                    // on it, or memoised rows go stale.
                    extraData={orderOf}
                    ListEmptyComponent={
                      <Text style={[type.meta, { color: c.text2 }]}>
                        Nothing matches “{term}”.
                      </Text>
                    }
                    renderItem={({ item }) => {
                      const n = orderOf.get(item.id);
                      return (
                        <Pressable
                          onPress={() => onRowPress(item)}
                          accessibilityRole={mode === 'multi' ? 'checkbox' : 'button'}
                          accessibilityState={mode === 'multi' ? { checked: n != null } : undefined}
                          style={({ pressed }) => [
                            styles.item,
                            { backgroundColor: n != null ? c.accentSoft : c.surface2 },
                            pressed && styles.pressed,
                          ]}>
                          <View style={styles.itemText}>
                            <Text style={[type.exerciseName, { color: c.text }]}>{item.name}</Text>
                            <Text style={[type.meta, { color: c.text2 }]}>
                              {[item.mechanic || null, item.equipment || null, item.primary_muscle || null]
                                .filter(Boolean)
                                .join(' · ')}
                            </Text>
                          </View>
                          {mode === 'multi' ? (
                            <View
                              style={[
                                styles.marker,
                                n != null
                                  ? { backgroundColor: c.accent, borderColor: c.accent }
                                  : { borderColor: c.border },
                              ]}>
                              {n != null ? <Text style={styles.markerText}>{n}</Text> : null}
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    }}
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
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Modal>
  );
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
  loading: { marginTop: spacing.xl },
  list: {
    padding: spacing.screen,
    gap: spacing.sm,
  },
  footerSpacer: { height: FOOTER_HEIGHT },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.input,
    padding: spacing.md,
  },
  itemText: {
    flex: 1,
    gap: 2,
  },
  marker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: {
    color: '#FFFFFF',
    fontSize: 13,
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
