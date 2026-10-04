import { Stack } from 'expo-router';

import { TabStackProvider } from '@/components/tab-layout';
import { useColors } from '@/theme/theme-provider';
import { font } from '@/theme/tokens';

/**
 * The Exercises tab's stack, the same shape as History's: the library
 * draws ScreenHeader instead of a native header, an exercise pushes over
 * it, and a workout opened from an exercise pushes over that, so Back
 * always returns to where the user was in this tab.
 */
export default function ExercisesStackLayout() {
  const c = useColors();

  return (
    <TabStackProvider stack="exercises">
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
        <Stack.Screen name="index" options={{ title: 'Exercises', headerShown: false }} />
        {/* The screens set their own titles once their rows load. */}
        <Stack.Screen name="[id]" options={{ title: '' }} />
        <Stack.Screen name="workout/[id]" options={{ title: '' }} />
      </Stack>
    </TabStackProvider>
  );
}
