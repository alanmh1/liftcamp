import { Stack } from 'expo-router';

import { TabStackProvider } from '@/components/tab-layout';
import { useColors } from '@/theme/theme-provider';
import { font } from '@/theme/tokens';

/**
 * The Workout tab's stack, with the social flag. The tab's root draws
 * ScreenHeader instead of a native header; the program browser, an
 * exercise, and a workout opened from an exercise push over it, so Back
 * always returns to where the user was in this tab.
 */
export default function TrainStackLayout() {
  const c = useColors();

  return (
    <TabStackProvider stack="train">
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
        <Stack.Screen name="index" options={{ title: 'Workout', headerShown: false }} />
        <Stack.Screen name="routines" options={{ title: 'Routines' }} />
        {/* The screens set their own titles once their rows load. */}
        <Stack.Screen name="exercise/[id]" options={{ title: '' }} />
        <Stack.Screen name="workout/[id]" options={{ title: '' }} />
      </Stack>
    </TabStackProvider>
  );
}

/**
 * A link from another tab (Home's See all, Profile's empty state) pushes
 * the routines list here; the root goes under it so Back lands on the tab.
 */
export const unstable_settings = { initialRouteName: 'index' };
