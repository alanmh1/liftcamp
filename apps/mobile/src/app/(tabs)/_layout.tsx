import type { TabLayout } from '@liftcamp/shared';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useState } from 'react';
import { View } from 'react-native';

import { TabLayoutProvider } from '@/components/tab-layout';
import { useLaunchLayout } from '@/lib/social-access';
import { useColors } from '@/theme/theme-provider';

/**
 * Native tabs, system styling, accent for the selected one. Two layouts,
 * picked by the social flag (docs/social-spec.md, Navigation):
 *
 * - Four tabs without it, today's app: Home, History, Exercises, Profile.
 * - Three with it: Home, Workout, Profile. Workout holds the saved
 *   routines, the programs and the exercise library; History is a row on
 *   Profile that pushes it on Profile's stack.
 *
 * Every trigger is declared in both and the other layout's are `hidden`. A
 * hidden tab cannot be navigated to at all, so links into History and
 * Exercises go through `useNavHref`. The layout comes from the device's
 * cached flag, latched once per user per app run (lib/social-access.ts);
 * the server's answer only writes the cache, so a read that lands while
 * the app runs re-renders nothing here. Changing `hidden` while the app
 * runs remounts the navigator and resets every tab's state, so a changed
 * flag shows on the next launch, never before.
 *
 * No floating Start pill. Starting a workout is the first thing on Home, and
 * the active workout is a full-screen modal over these tabs, so the bar is
 * hidden while logging.
 *
 * Icons are SF Symbols on iOS and Material icons on Android, so no image
 * assets are involved.
 *
 * The entry point is `unstable-native-tabs` in expo-router 57.0.20; the
 * `native-tabs` alias is not in this version's package root. The component
 * API is the documented one.
 */
export default function TabsLayout() {
  const c = useColors();
  const current = useLaunchLayout();
  // The first answer, kept for as long as the tabs are mounted, so even a
  // guest linking an account (four, then that account's answer) keeps the
  // tabs it drew. At launch RootStack holds the splash until it is in;
  // after a sign-in it is one AsyncStorage read away.
  const [layout, setLayout] = useState<TabLayout | null>(current);
  if (layout == null && current != null) setLayout(current);

  if (layout == null) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  const three = layout === 'three';

  return (
    <TabLayoutProvider layout={layout}>
      <NativeTabs tintColor={c.accent} backgroundColor={c.bg}>
        <NativeTabs.Trigger name="(home)">
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="history" hidden={three}>
          <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="clock" md="history" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="exercises" hidden={three}>
          <NativeTabs.Trigger.Label>Exercises</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'dumbbell', selected: 'dumbbell.fill' }}
            md="fitness_center"
          />
        </NativeTabs.Trigger>
        {/* The Workout tab. Its folder is `train` because a `workout` folder
            would collide with the root `/workout/[id]` modal. */}
        <NativeTabs.Trigger name="train" hidden={!three}>
          <NativeTabs.Trigger.Label>Workout</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'dumbbell', selected: 'dumbbell.fill' }}
            md="fitness_center"
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'person', selected: 'person.fill' }}
            md="person"
          />
        </NativeTabs.Trigger>
      </NativeTabs>
    </TabLayoutProvider>
  );
}
