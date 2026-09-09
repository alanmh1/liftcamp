import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { searchExercises, type ExerciseInfo } from '@/data/workouts';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/**
 * Minimal picker: a search field against `exercises.search_all` and a list,
 * compounds first. Enough to add an exercise. The full picker with equipment
 * and muscle filters is Phase 6 screen 2.
 */
export function ExercisePicker({
  visible,
  title = 'Add exercise',
  onPick,
  onClose,
}: {
  visible: boolean;
  title?: string;
  onPick: (exercise: ExerciseInfo) => void;
  onClose: () => void;
}) {
  const c = useColors();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<ExerciseInfo[]>([]);
  const [loading, setLoading] = useState(false);

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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.fill, { backgroundColor: c.bg }]}>
        <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Text style={[type.screenTitle, { color: c.text }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={[type.button, { color: c.accentText }]}>Close</Text>
            </Pressable>
          </View>

          <TextInput
            value={term}
            onChangeText={setTerm}
            placeholder="Search exercises"
            placeholderTextColor={c.text3}
            autoCorrect={false}
            autoCapitalize="none"
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
              keyboardShouldPersistTaps="handled"
              // flex: 1 is what makes this scroll. Without a bounded height the
              // list grows to fit its content and there is nothing to scroll.
              style={styles.fill}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <Text style={[type.meta, { color: c.text2 }]}>
                  Nothing matches “{term}”.
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onPick(item)}
                  style={({ pressed }) => [
                    styles.item,
                    { backgroundColor: c.surface2 },
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[type.exerciseName, { color: c.text }]}>{item.name}</Text>
                  <Text style={[type.meta, { color: c.text2 }]}>
                    {[item.mechanic || null, item.equipment || null, item.primary_muscle || null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </Pressable>
              )}
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
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
  loading: { marginTop: spacing.xl },
  list: {
    padding: spacing.screen,
    gap: spacing.sm,
  },
  item: {
    borderRadius: radius.input,
    padding: spacing.md,
    gap: 2,
  },
  pressed: { opacity: 0.7 },
});
