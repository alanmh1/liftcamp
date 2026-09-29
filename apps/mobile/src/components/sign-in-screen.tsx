import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseSignInLine, pickSignInLine, SIGN_IN_LINE_KEY, SIGN_IN_LINES } from '@liftcamp/shared';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/components/auth-provider';
import { GoogleMark } from '@/components/google-mark';
import { LaunchWordmark } from '@/components/launch-wordmark';
import { LiftCampMark } from '@/components/liftcamp-mark';
import { Text, TextInput } from '@/components/text';
import {
  looksLikeEmail,
  normalizeEmail,
  RESEND_COOLDOWN_MS,
  sendEmailCode,
  verifyEmailCode,
} from '@/lib/email-sign-in';
import {
  appleSignInAvailable,
  signInWithApple,
  signInWithGoogle,
  type SignInMode,
  type SignInOutcome,
} from '@/lib/native-sign-in';
import { useTheme } from '@/theme/theme-provider';
import { palettes, radius, spacing, tabular, type } from '@/theme/tokens';

const BUTTON_H = 50;
const CODE_LENGTH = 6;

/**
 * Where the screen is in the email flow. Local state rather than a route:
 * the screen is hosted as a plain route, a native page sheet and an RN
 * Modal, and a push behaves differently in each.
 */
type Step = 'providers' | 'email' | 'code';

/**
 * Sign-in, in two modes.
 *
 * `signIn` is the signed-out screen: Apple, Google, email, or continue as a
 * guest. `link` is reached by an anonymous user who wants to keep their
 * workouts: the same three options, attaching to the current account, and
 * no guest option because they already are one.
 *
 * Email is two more steps on this same screen: an address, then the 6-digit
 * code that was sent to it. The code auto-submits at six digits, and a
 * Verify button covers the retry after a wrong one.
 *
 * One group, centred in the available height: mark, heading, supporting
 * line, the buttons, then the optional dismiss last. Nothing anchors to an
 * edge or sits in a corner on its own.
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
  /**
   * The signed-out sign-in route only: the first step's subtitle is one of
   * `SIGN_IN_LINES`, a different one each time the screen appears.
   */
  rotatingLead?: boolean;
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
  rotatingLead = false,
}: {
  mode?: SignInMode;
  onDone?: (outcome: SignInOutcome) => void;
  dismissLabel?: string;
  onDismiss?: () => void;
  rotatingLead?: boolean;
}) {
  const { signInAnonymously, error: anonError } = useAuth();
  const { scheme, colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<'apple' | 'google' | 'guest' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('providers');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  // When the next send is allowed, as a timestamp. Ticked once a second
  // while in the future so the Resend label counts down.
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const codeInput = useRef<TextInput>(null);

  // Picked once per appearance, against the one shown last time, which is
  // stored so the next appearance can avoid it. Blank for the moment the
  // read takes, rather than showing a line that might then change.
  const [rotatingLine, setRotatingLine] = useState<string | null>(null);
  useEffect(() => {
    if (!rotatingLead) return;
    let cancelled = false;
    (async () => {
      const last = parseSignInLine(await AsyncStorage.getItem(SIGN_IN_LINE_KEY).catch(() => null));
      const next = pickSignInLine(last);
      if (cancelled) return;
      setRotatingLine(SIGN_IN_LINES[next]);
      void AsyncStorage.setItem(SIGN_IN_LINE_KEY, String(next)).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [rotatingLead]);

  useEffect(() => {
    appleSignInAvailable().then(setAppleAvailable);
  }, []);

  useEffect(() => {
    if (resendAt <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [resendAt]);

  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));

  async function sendCode() {
    if (busy || !looksLikeEmail(email)) return;
    setBusy('email');
    setError(null);
    const result = await sendEmailCode(email, mode);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setResendAt(Date.now() + RESEND_COOLDOWN_MS);
    setNow(Date.now());
    setCode('');
    setStep('code');
  }

  async function verifyCode(token: string) {
    if (busy || token.length !== CODE_LENGTH) return;
    setBusy('email');
    setError(null);
    const outcome = await verifyEmailCode(email, token, mode);
    setBusy(null);
    if (!outcome.ok) {
      if (!outcome.cancelled) setError(outcome.error);
      // The code stays in the box so a one-digit slip is a one-digit fix.
      codeInput.current?.focus();
      return;
    }
    onDone?.(outcome);
  }

  function onCodeChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH) void verifyCode(digits);
  }

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
  // Signing in, on the first step: the wordmark stands in for the mark and
  // title. Linking keeps its own heading, and the email steps say what
  // they ask for.
  const wordmark = !linking && step === 'providers';

  // The link heading stays through every step; the sign-in heading gives
  // way to the email one so the screen says what it is asking for.
  const title = linking ? 'Save your workouts' : 'Sign in with email';
  const lead =
    step === 'code'
      ? `Enter the code we sent to ${normalizeEmail(email)}.`
      : step === 'email'
        ? 'We will send you a 6 digit code.'
        : linking
          ? 'Add an account and everything you have logged comes with it, on this phone and the next.'
          : rotatingLead
            ? (rotatingLine ?? ' ')
            : 'Start logging now. You can add an account later and keep everything you have logged.';

  // Back inside the email flow retraces a step; on the first step it is the
  // host's dismiss, when the host offers one.
  const back =
    step === 'code'
      ? { label: 'Back', onPress: () => { setError(null); setStep('email'); } }
      : step === 'email'
        ? { label: 'Back', onPress: () => { setError(null); setStep('providers'); } }
        : dismissLabel && onDismiss
          ? { label: dismissLabel, onPress: onDismiss }
          : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[
        styles.fill,
        {
          backgroundColor: c.bg,
          paddingTop: Math.max(insets.top, spacing.lg) + spacing.md,
          paddingBottom: Math.max(insets.bottom, spacing.lg),
        },
      ]}>
      <View style={styles.top}>
        {wordmark ? (
          // The launch wordmark, which a cold start onto this screen lands
          // the overlay's on (see lib/launch-handoff). It carries the name,
          // so there is no title under it.
          <LaunchWordmark />
        ) : (
          <>
            {/* Drawn, not a PNG, so the tile's corners are transparent on
                both paper and graphite. */}
            <View style={styles.mark}>
              <LiftCampMark size={96} />
            </View>
            <Text style={[type.screenTitle, { color: c.text }]}>{title}</Text>
          </>
        )}
        <Text style={[type.meta, styles.lead, { color: c.text2 }]}>{lead}</Text>
      </View>

      {step === 'email' ? (
        <View style={styles.buttons}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoFocus
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="go"
            onSubmitEditing={() => void sendCode()}
            placeholder="you@example.com"
            placeholderTextColor={c.text3}
            editable={busy === null}
            style={[styles.input, { backgroundColor: c.inputFill, borderColor: c.border, color: c.text }]}
          />
          <View style={styles.slot}>
            <Pressable
              onPress={() => void sendCode()}
              disabled={busy !== null || !looksLikeEmail(email)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.fillButton,
                styles.primary,
                { backgroundColor: c.accent },
                (pressed || busy !== null || !looksLikeEmail(email)) && styles.pressed,
              ]}>
              <Text style={[type.button, styles.primaryLabel]}>Continue</Text>
            </Pressable>
            {busy === 'email' ? <Spinner light /> : null}
          </View>
          {message ? (
            <Text style={[type.meta, styles.centered, { color: c.danger }]}>{message}</Text>
          ) : null}
        </View>
      ) : step === 'code' ? (
        <View style={styles.buttons}>
          <TextInput
            ref={codeInput}
            value={code}
            onChangeText={onCodeChange}
            autoFocus
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            returnKeyType="done"
            onSubmitEditing={() => void verifyCode(code)}
            placeholder="123456"
            placeholderTextColor={c.text3}
            editable={busy === null}
            style={[
              styles.input,
              styles.codeInput,
              { backgroundColor: c.inputFill, borderColor: c.border, color: c.text },
            ]}
          />
          <View style={styles.slot}>
            <Pressable
              onPress={() => void verifyCode(code)}
              disabled={busy !== null || code.length !== CODE_LENGTH}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.fillButton,
                styles.primary,
                { backgroundColor: c.accent },
                (pressed || busy !== null || code.length !== CODE_LENGTH) && styles.pressed,
              ]}>
              <Text style={[type.button, styles.primaryLabel]}>Verify</Text>
            </Pressable>
            {busy === 'email' ? <Spinner light /> : null}
          </View>
          <Pressable
            onPress={() => void sendCode()}
            disabled={busy !== null || resendIn > 0}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.fillButton,
              styles.guest,
              { borderColor: c.border },
              (pressed || resendIn > 0) && styles.pressed,
            ]}>
            <Text style={[type.button, { color: c.text }, resendIn > 0 && tabular]}>
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
            </Text>
          </Pressable>
          {message ? (
            <Text style={[type.meta, styles.centered, { color: c.danger }]}>{message}</Text>
          ) : null}
        </View>
      ) : (
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
            <GoogleMark size={20} />
            <Text style={[type.button, styles.googleLabel, { color: c.text }]}>
              Continue with Google
            </Text>
          </Pressable>
          {busy === 'google' ? <Spinner /> : null}
        </View>

        <Pressable
          onPress={() => {
            if (busy) return;
            setError(null);
            setStep('email');
          }}
          disabled={busy !== null}
          accessibilityRole="button"
          accessibilityLabel="Continue with email"
          style={({ pressed }) => [
            styles.fillButton,
            styles.google,
            { backgroundColor: c.surface, borderColor: c.border },
            pressed && styles.pressed,
          ]}>
          <Text style={[type.button, styles.googleLabel, { color: c.text }]}>Continue with email</Text>
        </Pressable>

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
      )}

      {back ? (
        <Pressable
          onPress={back.onPress}
          disabled={busy !== null}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}>
          <Text style={[type.button, { color: c.text2 }]}>{back.label}</Text>
        </Pressable>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** `light` puts a paper spinner on the filled accent button. */
function Spinner({ light = false }: { light?: boolean }) {
  return (
    <View style={styles.spinner} pointerEvents="none">
      <ActivityIndicator color={light ? palettes.light.bg : undefined} />
    </View>
  );
}

const styles = StyleSheet.create({
  // The whole group centres in whatever height the host gives it.
  fill: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
    gap: spacing.xl,
  },
  top: {
    alignItems: 'center',
    gap: spacing.md,
  },
  mark: { marginBottom: spacing.sm },
  lead: { textAlign: 'center', maxWidth: 320, fontSize: 15, lineHeight: 22 },
  buttons: {
    gap: spacing.md,
  },
  slot: { height: BUTTON_H, justifyContent: 'center' },
  fillButton: { width: '100%', height: BUTTON_H, borderRadius: radius.bar },
  // Mark and label centred together as one pair, which is how the native
  // Apple button lays out its glyph and text, so the two read as a set.
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
  },
  googleLabel: { fontSize: 17 },
  guest: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Filled accent, the one primary action on the email steps.
  primary: { alignItems: 'center', justifyContent: 'center' },
  // Paper on plate blue in both modes; the button does not follow the theme.
  primaryLabel: { color: palettes.light.bg, fontSize: 17 },
  input: {
    height: BUTTON_H,
    borderWidth: 1,
    borderRadius: radius.bar,
    paddingHorizontal: spacing.lg,
    fontSize: 17,
  },
  // Wide spacing so six digits read as a code, not a number.
  codeInput: { textAlign: 'center', letterSpacing: 6, ...tabular },
  centered: { textAlign: 'center' },
  dismiss: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: -spacing.sm,
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
