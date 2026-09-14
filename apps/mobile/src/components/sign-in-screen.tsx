import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import { GoogleMark } from '@/components/google-mark';
import {
  appleSignInAvailable,
  signInWithApple,
  signInWithGoogle,
  type SignInMode,
  type SignInOutcome,
} from '@/lib/native-sign-in';
import { useTheme } from '@/theme/theme-provider';
import { radius, spacing, type } from '@/theme/tokens';

const BUTTON_H = 50;

/**
 * Sign-in, in two modes.
 *
 * `signIn` is the signed-out screen: Apple, Google, or continue as a guest.
 * `link` is reached by an anonymous user who wants to keep their workouts:
 * the same two providers, attaching to the current account, and no guest
 * option because they already are one.
 *
 * Top to bottom: mark, heading, supporting line, the buttons, then the
 * optional dismiss as a text button at the very bottom, so nothing sits in a
 * corner on its own.
 *
 * Apple first, Google second, both reading "Continue with". Apple's review
 * guideline 4.8 wants Sign in with Apple at least as prominent as any other
 * option, and the native button is what satisfies its rules. Google's rules
 * allow a custom button with the G mark and an approved label, which lets it
 * match the Apple button's height, radius and width.
 *
 * The screen provides its own safe-area context. It is hosted three ways, as
 * a plain route, as a native page sheet, and inside an RN Modal, and each
 * reports different insets; a provider measured on this view is right in all
 * of them.
 */
export function SignInScreen(props: {
  mode?: SignInMode;
  onDone?: (outcome: SignInOutcome) => void;
  /** A bottom text button, "Not now" or "Back". Omit when there is no way back. */
  dismissLabel?: string;
  onDismiss?: () => void;
}) {
  return (
    <SafeAreaProvider>
      <SignInContent {...props} />
    </SafeAreaProvider>
  );
}

function SignInContent({
  mode = 'signIn',
  onDone,
  dismissLabel,
  onDismiss,
}: {
  mode?: SignInMode;
  onDone?: (outcome: SignInOutcome) => void;
  dismissLabel?: string;
  onDismiss?: () => void;
}) {
  const { signInAnonymously, error: anonError } = useAuth();
  const { scheme, colors: c } = useTheme();
  const insets = useSafeAreaInsets();
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
  const message = error ?? anonError;

  return (
    <View
      style={[
        styles.fill,
        {
          backgroundColor: c.bg,
          paddingTop: Math.max(insets.top, spacing.lg) + spacing.md,
          paddingBottom: Math.max(insets.bottom, spacing.lg),
        },
      ]}>
      <View style={styles.top}>
        <Image source={require('../../assets/images/splash-icon.png')} style={styles.mark} />
        <Text style={[type.screenTitle, { color: c.text }]}>
          {linking ? 'Save your workouts' : 'LiftCamp'}
        </Text>
        <Text style={[type.meta, styles.lead, { color: c.text2 }]}>
          {linking
            ? 'Add an account and everything you have logged comes with it, on this phone and the next.'
            : 'Start logging now. You can add an account later and keep everything you have logged.'}
        </Text>
      </View>

      <View style={styles.buttons}>
        {appleAvailable ? (
          <View style={styles.slot}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={
                scheme === 'dark'
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={radius.bar}
              style={styles.fillButton}
              onPress={() => void run('apple')}
            />
            {busy === 'apple' ? <Spinner /> : null}
          </View>
        ) : null}

        <View style={styles.slot}>
          <Pressable
            onPress={() => void run('google')}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            style={({ pressed }) => [
              styles.fillButton,
              styles.google,
              { backgroundColor: c.surface, borderColor: c.border },
              pressed && styles.pressed,
            ]}>
            <View style={styles.googleMark}>
              <GoogleMark size={20} />
            </View>
            <Text style={[type.button, styles.googleLabel, { color: c.text }]}>
              Continue with Google
            </Text>
          </Pressable>
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
              styles.fillButton,
              styles.guest,
              { borderColor: c.border },
              (pressed || busy === 'guest') && styles.pressed,
            ]}>
            <Text style={[type.button, { color: c.text }]}>
              {busy === 'guest' ? 'Starting…' : 'Continue without account'}
            </Text>
          </Pressable>
        ) : null}

        {message ? (
          <Text style={[type.meta, styles.centered, { color: c.danger }]}>{message}</Text>
        ) : null}
        {Platform.OS === 'android' && !appleAvailable ? (
          <Text style={[type.meta, styles.centered, { color: c.text3 }]}>
            Sign in with Apple is available on iPhone and iPad.
          </Text>
        ) : null}
      </View>

      {dismissLabel && onDismiss ? (
        <Pressable
          onPress={onDismiss}
          disabled={busy !== null}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}>
          <Text style={[type.button, { color: c.text2 }]}>{dismissLabel}</Text>
        </Pressable>
      ) : null}
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

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    paddingHorizontal: spacing.screen,
  },
  top: {
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  mark: { width: 96, height: 96, marginBottom: spacing.sm },
  lead: { textAlign: 'center', maxWidth: 320, fontSize: 15, lineHeight: 22 },
  // Takes the remaining height so the buttons sit in the lower half and the
  // dismiss lands at the bottom, without either being crowded by the other.
  buttons: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  slot: { height: BUTTON_H, justifyContent: 'center' },
  fillButton: { width: '100%', height: BUTTON_H, borderRadius: radius.bar },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  // The mark holds the left edge; the label centres on the whole button, the
  // way the Apple button lays out its own glyph and text.
  googleMark: {
    position: 'absolute',
    left: spacing.lg,
  },
  googleLabel: { fontSize: 17 },
  guest: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: { textAlign: 'center' },
  dismiss: {
    alignSelf: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  spinner: {
    position: 'absolute',
    right: spacing.lg,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});
