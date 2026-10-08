import { Stack } from 'expo-router';

import { TabStackProvider } from '@/components/tab-layout';
import { useColors } from '@/theme/theme-provider';
import { font } from '@/theme/tokens';

/**
 * Home's stack. Nothing pushes on it: its links go to Workout and Profile
 * (useNavHref). Home itself has no native header: it draws ScreenHeader,
 * the title with the workout pill beside it.
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
      </Stack>
    </TabStackProvider>
  );
}
