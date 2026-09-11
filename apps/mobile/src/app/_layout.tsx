import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DMMono_400Regular, DMMono_500Medium, useFonts } from '@expo-google-fonts/dm-mono';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/components/auth-provider';
import { ThemeProvider, useColors } from '@/theme/theme-provider';

SplashScreen.preventAutoHideAsync();

/**
 * Route gating. `Stack.Protected` unmounts a group when its guard is false
 * and the router falls through to the first group whose guard holds, so the
 * signed-out state and the app proper never coexist.
 */
function RootStack() {
  const { session, loading } = useAuth();
  const c = useColors();

  const [fontsLoaded] = useFonts({ DMMono_400Regular, DMMono_500Medium });

  useEffect(() => {
    if (!loading && fontsLoaded) void SplashScreen.hideAsync();
  }, [loading, fontsLoaded]);

  if (loading || !fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>

      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        {/* Full-screen over the tabs, so the bar is hidden while logging. */}
        <Stack.Screen
          name="workout/[id]"
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
              <RootStack />
            </AuthProvider>
          </BottomSheetModalProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
