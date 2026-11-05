import { Stack } from 'expo-router';

import { TabStackProvider } from '@/components/tab-layout';
import { useColors } from '@/theme/theme-provider';
import { font } from '@/theme/tokens';

/**
 * Home's stack. A starter routine's tile pushes its detail here, and a
 * saved routine's detail can be. A routine's exercises push over them, and
 * a workout opened from one of those exercises over that, so Back walks
 * the same way; every other link goes to Workout or Profile (useNavHref).
 * Home itself has no native header: it draws ScreenHeader, the title with
 * the workout pill beside it.
 */
export default function HomeStackLayout() {
  const c = useColors();

  return (
    <TabStackProvider stack="home">
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
        <Stack.Screen name="index" options={{ title: 'Home', headerShown: false }} />
        {/* The routine screens set their titles from the routine. */}
        <Stack.Screen name="routine/[id]" options={{ title: '' }} />
        <Stack.Screen name="program/[name]" options={{ title: '' }} />
        {/* The screens set their own titles once their rows load. */}
        <Stack.Screen name="exercise/[id]" options={{ title: '' }} />
        <Stack.Screen name="session/[id]" options={{ title: '' }} />
      </Stack>
    </TabStackProvider>
  );
}
