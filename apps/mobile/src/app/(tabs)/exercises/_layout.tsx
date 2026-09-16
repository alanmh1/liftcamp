import { Stack } from 'expo-router';

import { useColors } from '@/theme/theme-provider';
import { font } from '@/theme/tokens';

/**
 * The Exercises tab's stack, the same shape as History's: the library
 * carries the large title, an exercise pushes over it, and a workout
 * opened from an exercise pushes over that, so Back always returns to
 * where the user was in this tab.
 */
export default function ExercisesStackLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Exercises' }} />
      {/* The screens set their own titles once their rows load. */}
      <Stack.Screen name="[id]" options={{ title: '', headerLargeTitle: false }} />
      <Stack.Screen name="workout/[id]" options={{ title: '', headerLargeTitle: false }} />
    </Stack>
  );
}
