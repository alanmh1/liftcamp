import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import {
  appleSignInAvailable,
  signInWithApple,
  signInWithGoogle,
  type SignInMode,
  type SignInOutcome,
} from '@/lib/native-sign-in';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

/**
 * Sign-in, in two modes.
 *
 * `signIn` is the signed-out screen: Apple, Google, or continue as a guest.
 * `link` is reached from Home by an anonymous user who wants to keep their
 * workouts: the same two providers, attaching to the current account, and no
 * guest option because they already are one.
 *
 * Apple sits first and Google second. Apple's review guideline 4.8 wants Sign
 * in with Apple at least as prominent as any other third-party option, and
 * the native AppleAuthenticationButton is what satisfies its button rules.
 */
export function SignInScreen({
  mode = 'signIn',
  onDone,
}: {
  mode?: SignInMode;
  onDone?: (outcome: SignInOutcome) => void;
}) {
  const { signInAnonymously, error: anonError } = useAuth();
  const { scheme, colors: c } = useTheme();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<'apple' | 'google' | 'guest' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    appleSignInAvailable().then(setAppleAvailable);
  }, []);

  async function run(provider: 'apple' | 'google') {
    if (busy) return;
    setBusy(provider);
    setError(null);
    const outcome =
      provider === 'apple' ? await signInWithApple(mode) : await signInWithGoogle(mode);
    setBusy(null);
    if (!outcome.ok) {
      if (!outcome.cancelled) setError(outcome.error);
      return;
    }
    onDone?.(outcome);
  }

  const linking = mode === 'link';

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.hero}>
          <Text style={[type.screenTitle, { color: c.text }]}>
            {linking ? 'Save your workouts' : 'LiftCamp'}
          </Text>
          <Text style={[type.meta, { color: c.text2 }]}>
            {linking
              ? 'Add an account and everything you have logged comes with it, on this phone and the next.'
              : 'Start logging now. You can add an account later and keep everything you have logged.'}
          </Text>
        </View>

        <View style={styles.buttons}>
          {appleAvailable ? (
            <View style={styles.buttonSlot}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                  linking
                    ? AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
                    : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                }
                buttonStyle={
                  scheme === 'dark'
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={radius.bar}
                style={styles.apple}
                onPress={() => void run('apple')}
              />
              {busy === 'apple' ? <Spinner /> : null}
            </View>
          ) : null}

          <View style={styles.buttonSlot}>
            <GoogleSigninButton
              size={GoogleSigninButton.Size.Wide}
              color={scheme === 'dark' ? GoogleSigninButton.Color.Light : GoogleSigninButton.Color.Dark}
              disabled={busy !== null}
              onPress={() => void run('google')}
              style={styles.google}
            />
            {busy === 'google' ? <Spinner /> : null}
          </View>

          {!linking ? (
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                if (busy) return;
                setBusy('guest');
                await signInAnonymously();
                setBusy(null);
              }}
              disabled={busy !== null}
              style={({ pressed }) => [
                styles.guest,
                { borderColor: c.border },
                (pressed || busy === 'guest') && styles.pressed,
              ]}>
              <Text style={[type.button, { color: c.text }]}>
                {busy === 'guest' ? 'Starting…' : 'Continue without account'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {error || anonError ? (
          <Text style={[type.meta, styles.error, { color: c.danger }]}>{error ?? anonError}</Text>
        ) : null}

        {Platform.OS === 'android' && !appleAvailable ? (
          <Text style={[type.meta, styles.note, { color: c.text3 }]}>
            Sign in with Apple is available on iPhone and iPad.
          </Text>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

function Spinner() {
  return (
    <View style={styles.spinner} pointerEvents="none">
      <ActivityIndicator />
    </View>
  );
}

const BUTTON_H = 50;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
    gap: spacing.xl,
  },
  hero: { gap: spacing.sm },
  buttons: { gap: spacing.md },
  buttonSlot: { height: BUTTON_H, justifyContent: 'center' },
  apple: { width: '100%', height: BUTTON_H },
  // The Google button draws its own chrome; stretch it to the same footprint.
  google: { width: '100%', height: BUTTON_H },
  guest: {
    height: BUTTON_H,
    borderWidth: 1,
    borderRadius: radius.bar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    position: 'absolute',
    right: spacing.lg,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  error: { textAlign: 'center' },
  note: { textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
