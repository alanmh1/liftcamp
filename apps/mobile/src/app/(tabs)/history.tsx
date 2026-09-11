import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

/** Finished workouts, newest first. Phase 6 screen 4; this is the tab shell. */
export default function HistoryScreen() {
  const c = useColors();
  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={[type.screenTitle, { color: c.text }]}>History</Text>
        <Text style={[type.meta, { color: c.text2 }]}>
          Finished workouts will list here, newest first.
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: spacing.screen, paddingTop: spacing.md, gap: spacing.sm },
});
