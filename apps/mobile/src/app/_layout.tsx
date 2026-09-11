import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DMMono_400Regular, DMMono_500Medium, useFonts } from '@expo-google-fonts/dm-mono';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/components/auth-provider';
import { OnboardingProvider, useOnboarding } from '@/components/onboarding-provider';
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

  const [fontsLoaded] = useFonts({ DMMono_400Regular, DMMono_500Medium });

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
      </Stack.Protected>

      {/* Any session, onboarded or not: page 3 of onboarding starts a workout
          and Home's launch check opens it the moment onboarding completes.

          'modal' is UIModalPresentationPageSheet, which is what carries the
          pull-down gesture on iOS. 'fullScreenModal' never had one: it is
          UIModalPresentationFullScreen, and gestureEnabled has nothing to
          enable there. Pull-down leaves the workout in progress and Home
          shows the Resume card; Cancel in the header ⋮ is the discard. */}
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="workout/[id]" options={{ presentation: 'modal' }} />
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
            <OnboardingProvider>
              <AuthProvider>
                <RootStack />
              </AuthProvider>
            </OnboardingProvider>
          </BottomSheetModalProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
