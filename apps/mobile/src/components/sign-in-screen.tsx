import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import { useColors } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

export function SignInScreen() {
  const { signInAnonymously, error } = useAuth();
  const c = useColors();

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.hero}>
          <Text style={[type.screenTitle, { color: c.text }]}>LiftCamp</Text>
          <Text style={[type.meta, { color: c.text2 }]}>
            Start logging now. You can add an account later and keep everything you
            have logged.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={signInAnonymously}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: c.accent },
            pressed && styles.pressed,
          ]}>
          <Text style={[type.button, styles.buttonLabel]}>Continue without account</Text>
        </Pressable>

        {error ? <Text style={[type.meta, { color: c.danger }]}>{error}</Text> : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
    gap: spacing.xl,
  },
  hero: { gap: spacing.sm },
  button: {
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  buttonLabel: { color: '#FFFFFF' },
  pressed: { opacity: 0.8 },
});
