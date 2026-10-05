// First, so its clock starts before the other modules load.
import { markLaunch } from '@/lib/launch-timing';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from '@expo-google-fonts/outfit';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/components/auth-provider';
import { LaunchOverlay } from '@/components/launch-overlay';
import { OnboardingProvider, useOnboarding } from '@/components/onboarding-provider';
import { StartGateProvider } from '@/components/start-gate';
import { UnitProvider } from '@/components/unit-provider';
// Loaded at launch, so writes left on the phone from an earlier session start
// sending before any screen that writes is opened.
import '@/data/write-queue';
import { installNotificationHandler } from '@/lib/rest-alert';
import { TesterProSync } from '@/lib/tester-pro';
import { ThemeProvider, useColors } from '@/theme/theme-provider';
import { font } from '@/theme/tokens';

// Hidden by LaunchOverlay as soon as its logo image loads; the native
// splash is the background color alone, so the overlay takes over unseen.
SplashScreen.preventAutoHideAsync();

// Once, before any notification can arrive: a rest alert stays silent in
// the foreground, where the workout screen buzzes itself.
installNotificationHandler();

/**
 * Holds the app until the stored session, the onboarding answer and the
 * fonts are in, and carries the launch animation over it.
 */
function RootStack() {
  const { loading } = useAuth();
  const { loading: onboardingLoading } = useOnboarding();
  const c = useColors();

  // The four Outfit weights the type scale uses; see `font` in theme/tokens.
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  // `onboardingLoading` also covers the per-account check that runs when a
  // session arrives on an onboarded install. Holding here is what keeps a
  // new account from mounting Home for a frame and then bouncing to the
  // flow. After the first launch that check is answered from the device,
  // so the splash waits only on the stored session and the fonts.
  const ready = !loading && !onboardingLoading && fontsLoaded;

  // Cold-start timings, logged only in a build made with
  // EXPO_PUBLIC_LAUNCH_TIMING=1. See lib/launch-timing.
  useEffect(() => {
    if (!loading) markLaunch('session');
  }, [loading]);
  useEffect(() => {
    if (!onboardingLoading) markLaunch('onboarding');
  }, [onboardingLoading]);
  useEffect(() => {
    if (fontsLoaded) markLaunch('fonts');
  }, [fontsLoaded]);
  useEffect(() => {
    if (ready) markLaunch('ready');
  }, [ready]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Before the first `ready` this spinner is under the splash and the
          overlay. Later, a sign-in that starts an account check shows it. */}
      {ready ? (
        <AppStack />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      )}
      {/* Sits under the native splash until `ready`, then hides it and
          animates away over the app, which mounts at the same moment. */}
      <LaunchOverlay ready={ready} />
    </View>
  );
}

/**
 * Route gating. `Stack.Protected` unmounts a group when its guard is false
 * and the router falls through to the first group whose guard holds, so the
 * signed-out state and the app proper never coexist.
 */
function AppStack() {
  const { session } = useAuth();
  const { onboarded, notice } = useOnboarding();
  const c = useColors();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      {/* First launch, once per install. It signs the user in itself. */}
      <Stack.Protected guard={!onboarded}>
        {/* After an account deletion the flow opens with `notice`, and
            the welcome page confirms the delete once. */}
        <Stack.Screen name="onboarding" initialParams={notice ? { notice } : undefined} />
      </Stack.Protected>

      {/* Onboarded but signed out: the plain sign-in screen. */}
      <Stack.Protected guard={onboarded && !session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>

      <Stack.Protected guard={onboarded && !!session}>
        <Stack.Screen name="(tabs)" />
        {/* Anonymous users attach a Google or Apple identity here. */}
        <Stack.Screen name="link-account" options={{ presentation: 'modal' }} />
        {/* Pushed from the gear on Profile, with the native header and back
            button the tab stacks use. */}
        <Stack.Screen
          name="settings"
          options={{
            headerShown: true,
            title: 'Settings',
            headerBackTitle: 'Profile',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: c.bg },
            headerTitleStyle: { color: c.text, fontFamily: font.semibold },
            headerTintColor: c.accentText,
          }}
        />
        {/* The medal cabinet, pushed from the medal row on Profile. */}
        <Stack.Screen
          name="medals"
          options={{
            headerShown: true,
            title: 'Medals',
            headerBackTitle: 'Profile',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: c.bg },
            headerTitleStyle: { color: c.text, fontFamily: font.semibold },
            headerTintColor: c.accentText,
          }}
        />
        {/* Dev builds only; the screen redirects to Home in production. */}
        <Stack.Screen
          name="dev/week-card"
          options={{
            headerShown: true,
            title: 'Week card gallery',
            headerBackTitle: 'Settings',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: c.bg },
            headerTitleStyle: { color: c.text, fontFamily: font.semibold },
            headerTintColor: c.accentText,
          }}
        />
      </Stack.Protected>

      {/* Any session, onboarded or not: page 3 of onboarding starts a workout
          and Home's launch check opens it the moment onboarding completes.

          Full screen, per the spec. UIModalPresentationFullScreen has no
          pull-down gesture, so the screen carries its own way out: the caret
          at the top left dismisses and leaves the workout in progress, and
          Cancel in the header ⋮ discards. */}
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="workout/[id]" options={{ presentation: 'fullScreenModal' }} />
        {/* Finish replaces the workout with this, so the stack has no
            finished workout to swipe back to. Done is the only exit. */}
        <Stack.Screen
          name="summary/[id]"
          options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
        />
        {/* Pushed over the workout from the progression sheet's link, with
            the native header and back button. Static and offline-safe. */}
        <Stack.Screen
          name="progression-guide"
          options={{
            headerShown: true,
            title: 'How progression works',
            headerBackTitle: 'Back',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: c.bg },
            headerTitleStyle: { color: c.text, fontFamily: font.semibold },
            headerTintColor: c.accentText,
          }}
        />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <BottomSheetModalProvider>
            <AuthProvider>
              {/* Follows the session to read the user's tester Pro grant.
                  Renders nothing and holds nothing up. */}
              <TesterProSync />
              {/* Inside AuthProvider: whether onboarding is done is asked
                  per account, so it needs the session. */}
              <OnboardingProvider>
                <UnitProvider>
                  {/* Every workout start asks it first: a guest's second
                      needs an account. */}
                  <StartGateProvider>
                    <RootStack />
                  </StartGateProvider>
                </UnitProvider>
              </OnboardingProvider>
            </AuthProvider>
          </BottomSheetModalProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
