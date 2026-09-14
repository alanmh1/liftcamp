import { Stack } from 'expo-router';

import { useColors } from '@/theme/theme-provider';
import { font } from '@/theme/tokens';

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
        // The native header draws its own text, so it is told the face by
        // name rather than through the Text wrapper.
        headerTitleStyle: { color: c.text, fontFamily: font.semibold },
        headerLargeTitleStyle: { color: c.text, fontFamily: font.bold },
        headerTintColor: c.accentText,
        contentStyle: { backgroundColor: c.bg },
      }}>
      <Stack.Screen name="index" options={{ title: 'Home' }} />
    </Stack>
  );
}
