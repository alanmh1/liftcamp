import { CANONICAL_MUSCLES } from '@liftcamp/shared';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

/**
 * Phase 3 smoke screen. It exists to prove one thing: that Metro resolves
 * `@liftcamp/shared` out of the workspace root. Replace it with the active
 * workout screen in Phase 6.
 */
export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">Muscle vocabulary</ThemedText>
        <ThemedText type="small">
          {CANONICAL_MUSCLES.length} canonical names, imported from @liftcamp/shared
        </ThemedText>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}>
          {CANONICAL_MUSCLES.map((muscle, i) => (
            <ThemedView key={muscle} type="backgroundElement" style={styles.row}>
              <ThemedText type="code" style={styles.index}>
                {String(i + 1).padStart(2, '0')}
              </ThemedText>
              <ThemedText>{muscle}</ThemedText>
            </ThemedView>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  scroll: {
    alignSelf: 'stretch',
  },
  list: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  index: {
    minWidth: 28,
  },
});
