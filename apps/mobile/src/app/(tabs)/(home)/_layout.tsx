import { Stack } from 'expo-router';

import { useColors } from '@/theme/theme-provider';

/**
 * Home gets its own stack so it can have the large title that collapses on
 * scroll, standard iOS large-title behaviour. Header colours follow the theme.
 */
export default function HomeStackLayout() {
  const c = useColors();

  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerLargeTitleShadowVisible: false,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: c.bg },
        headerLargeStyle: { backgroundColor: c.bg },
        headerTitleStyle: { color: c.text },
        headerLargeTitleStyle: { color: c.text },
        headerTintColor: c.accentText,
        contentStyle: { backgroundColor: c.bg },
      }}>
      <Stack.Screen name="index" options={{ title: 'Home' }} />
    </Stack>
  );
}
