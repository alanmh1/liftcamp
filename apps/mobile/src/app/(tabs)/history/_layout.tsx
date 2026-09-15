import { Stack } from 'expo-router';

import { useColors } from '@/theme/theme-provider';
import { font } from '@/theme/tokens';

/**
 * History gets its own stack, the same shape as Home's, so a workout's
 * detail pushes over the list with the tab bar still showing and a native
 * back button. The list carries the large title that collapses on scroll.
 */
export default function HistoryStackLayout() {
  const c = useColors();

  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerLargeTitleShadowVisible: false,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: c.bg },
        headerLargeStyle: { backgroundColor: c.bg },
        // The native header draws its own text, so it is told the face by
        // name rather than through the Text wrapper.
        headerTitleStyle: { color: c.text, fontFamily: font.semibold },
        headerLargeTitleStyle: { color: c.text, fontFamily: font.bold },
        headerTintColor: c.accentText,
        contentStyle: { backgroundColor: c.bg },
      }}>
      <Stack.Screen name="index" options={{ title: 'History' }} />
      {/* One workout. A plain push with a small title; the large title is
          the list's. The screen sets its own title once the workout loads. */}
      <Stack.Screen name="[id]" options={{ title: '', headerLargeTitle: false }} />
    </Stack>
  );
}
