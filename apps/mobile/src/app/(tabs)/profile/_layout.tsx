import { Stack } from 'expo-router';

import { TabStackProvider } from '@/components/tab-layout';
import { useColors } from '@/theme/theme-provider';
import { font } from '@/theme/tokens';

/**
 * Profile's stack. The root draws ScreenHeader with the gear instead of a
 * native header. History pushes over it from the History row, a workout's
 * detail over History, and an exercise from the PR and strength rows; each
 * has the native back button. With the social flag, Followers and Following
 * push from the counts under the stats.
 */
export default function ProfileStackLayout() {
  const c = useColors();

  return (
    <TabStackProvider stack="profile">
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
        <Stack.Screen name="index" options={{ title: 'Profile', headerShown: false }} />
        <Stack.Screen name="history" options={{ title: 'History' }} />
        {/* The screens set their own titles once their rows load. */}
        <Stack.Screen name="workout/[id]" options={{ title: '' }} />
        <Stack.Screen name="exercise/[id]" options={{ title: '' }} />
        {/* Social only: the counts on Profile and Home's requests line. */}
        <Stack.Screen name="followers" options={{ title: 'Followers' }} />
        <Stack.Screen name="following" options={{ title: 'Following' }} />
      </Stack>
    </TabStackProvider>
  );
}

/**
 * Home's week card and last workout card push History and a workout here
 * from another tab; the root goes under them so Back lands on Profile.
 */
export const unstable_settings = { initialRouteName: 'index' };
