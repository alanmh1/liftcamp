import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

/** The exercise library as a browsable tab. Phase 6 screen 2; tab shell only. */
export default function ExercisesScreen() {
  const c = useColors();
  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={[type.screenTitle, { color: c.text }]}>Exercises</Text>
        <Text style={[type.meta, { color: c.text2 }]}>
          The full library with filters and detail sheet arrives with screen 2.
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: spacing.screen, paddingTop: spacing.md, gap: spacing.sm },
});
