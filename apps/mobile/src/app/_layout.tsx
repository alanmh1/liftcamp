import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthProvider, useAuth } from '@/components/auth-provider';
import { SignInScreen } from '@/components/sign-in-screen';
import { ThemedView } from '@/components/themed-view';

SplashScreen.preventAutoHideAsync();

/**
 * The auth gate. The tab navigator only mounts once there is a session, so no
 * screen inside it has to handle a signed-out state.
 */
function AuthGate() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return session ? <AppTabs /> : <SignInScreen />;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <AuthGate />
      </AuthProvider>
    </ThemeProvider>
  );
}
