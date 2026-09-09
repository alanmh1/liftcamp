import { DMMono_400Regular, DMMono_500Medium, useFonts } from '@expo-google-fonts/dm-mono';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/components/auth-provider';
import { SignInScreen } from '@/components/sign-in-screen';
import { ThemeProvider, useColors } from '@/theme/theme-provider';

SplashScreen.preventAutoHideAsync();

/**
 * The auth gate. The stack only mounts once there is a session, so no screen
 * inside it has to handle a signed-out state.
 */
function AuthGate() {
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

  if (!session) return <SignInScreen />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="workout/[id]" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
