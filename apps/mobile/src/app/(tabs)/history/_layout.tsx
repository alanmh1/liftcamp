import { Stack } from 'expo-router';

import { useColors } from '@/theme/theme-provider';
import { font } from '@/theme/tokens';

/**
 * History gets its own stack, the same shape as Home's, so a workout's
 * detail pushes over the list with the tab bar still showing and a native
 * back button. The list has no native header: it draws ScreenHeader, the
 * title with the workout pill beside it.
 */
export default function HistoryStackLayout() {
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
      <Stack.Screen name="index" options={{ title: 'History', headerShown: false }} />
      {/* One workout. The screen sets its own title once the workout loads. */}
      <Stack.Screen name="[id]" options={{ title: '' }} />
    </Stack>
  );
}
