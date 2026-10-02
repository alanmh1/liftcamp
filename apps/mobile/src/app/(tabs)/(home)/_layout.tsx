import { Stack } from 'expo-router';

import { useColors } from '@/theme/theme-provider';
import { font } from '@/theme/tokens';

/**
 * Home gets its own stack so the routines list pushes over it with a native
 * back button. Home itself has no native header: it draws ScreenHeader, the
 * title with the workout pill beside it. Header colours follow the theme.
 */
export default function HomeStackLayout() {
  const c = useColors();

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: c.bg },
        // The native header draws its own text, so it is told the face by
        // name rather than through the Text wrapper.
        headerTitleStyle: { color: c.text, fontFamily: font.semibold },
        headerTintColor: c.accentText,
        contentStyle: { backgroundColor: c.bg },
      }}>
      {/* The title stays for the back button on pushed screens. */}
      <Stack.Screen name="index" options={{ title: 'Home', headerShown: false }} />
      <Stack.Screen name="routines" options={{ title: 'Routines' }} />
    </Stack>
  );
}
