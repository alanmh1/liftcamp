import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SignInScreen } from '@/components/sign-in-screen';
import { useColors } from '@/theme/theme-provider';
import { spacing, type } from '@/theme/tokens';

/**
 * "Save your workouts": the sign-in screen in link mode, presented over the
 * tabs for an anonymous user. On success the identity is attached to the
 * current account and the session updates in place, so the Home row that
 * opened this disappears on its own.
 */
export default function LinkAccountScreen() {
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Text style={[type.button, { color: c.accentText }]}>Not now</Text>
        </Pressable>
      </View>
      <SignInScreen
        mode="link"
        onDone={(outcome) => {
          router.back();
          if (outcome.ok && outcome.existingAccount) {
            // The identity was already someone's account. We signed into it;
            // the guest session's rows stay with the guest user. Moving them
            // needs a database function, so say so rather than pretend.
            Alert.alert(
              'Signed in to your existing account',
              'Workouts from the guest session were not moved to it.',
            );
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.screen,
  },
});
