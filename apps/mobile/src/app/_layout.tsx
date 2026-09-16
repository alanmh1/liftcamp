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
import { OnboardingProvider, useOnboarding } from '@/components/onboarding-provider';
import { UnitProvider } from '@/components/unit-provider';
import { ThemeProvider, useColors } from '@/theme/theme-provider';

SplashScreen.preventAutoHideAsync();

/**
 * Route gating. `Stack.Protected` unmounts a group when its guard is false
 * and the router falls through to the first group whose guard holds, so the
 * signed-out state and the app proper never coexist.
 */
function RootStack() {
  const { session, loading } = useAuth();
  const { onboarded, loading: onboardingLoading } = useOnboarding();
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
  // flow.
  const ready = !loading && !onboardingLoading && fontsLoaded;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      {/* First launch, once per install. It signs the user in itself. */}
      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      {/* Onboarded but signed out: the plain sign-in screen. */}
      <Stack.Protected guard={onboarded && !session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>

      <Stack.Protected guard={onboarded && !!session}>
        <Stack.Screen name="(tabs)" />
        {/* Anonymous users attach a Google or Apple identity here. */}
        <Stack.Screen name="link-account" options={{ presentation: 'modal' }} />
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
              {/* Inside AuthProvider: whether onboarding is done is asked
                  per account, so it needs the session. */}
              <OnboardingProvider>
                <UnitProvider>
                  <RootStack />
                </UnitProvider>
              </OnboardingProvider>
            </AuthProvider>
          </BottomSheetModalProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
