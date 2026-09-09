import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/** Plate blue, from the Chalk design system. */
const ACCENT = '#1B5FA8';

export function SignInScreen() {
  const { signInAnonymously, error } = useAuth();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.hero}>
          <ThemedText type="title">LiftCamp</ThemedText>
          <ThemedText type="small" style={styles.blurb}>
            Start logging now. You can add an account later and keep everything you
            have logged.
          </ThemedText>
        </ThemedView>

        <Pressable
          accessibilityRole="button"
          onPress={signInAnonymously}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
          <Text style={styles.buttonLabel}>Continue without account</Text>
        </Pressable>

        {error ? (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        ) : null}
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
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
  },
  hero: {
    gap: Spacing.two,
  },
  blurb: {
    textAlign: 'left',
  },
  button: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    color: '#B3261E',
  },
});
