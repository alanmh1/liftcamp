import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';

import { useColors } from '@/theme/theme-provider';

/**
 * Native tabs, system styling, accent for the selected one. Three tabs:
 * Home, Workout, Profile. Workout holds the saved routines, the programs
 * and the exercise library; History is a row on Profile that pushes it on
 * Profile's stack. Links into History, a workout, an exercise or the
 * routines list go through `useNavHref` (components/tab-layout.tsx).
 *
 * No floating Start pill. Starting a workout is the first thing on Home, and
 * the active workout is a full-screen modal over these tabs, so the bar is
 * hidden while logging.
 *
 * Icons are SF Symbols on iOS and Material icons on Android, so no image
 * assets are involved. The Material set has no filled variants in the font
 * the tabs use, so Android shows one glyph per tab: home (house),
 * fitness_center (dumbbell), person (person).
 *
 * Android only: every tab shows its label (Material hides them on
 * unselected tabs when there are more than three), the active indicator is
 * the accent's soft tint, and the selected icon and label use accentText,
 * which is the accent on light and reads on the dark indicator. iOS gets
 * none of these props, so its bar is the system one as before.
 *
 * The entry point is `unstable-native-tabs` in expo-router 57.0.20; the
 * `native-tabs` alias is not in this version's package root. The component
 * API is the documented one.
 */
export default function TabsLayout() {
  const c = useColors();
  const android =
    Platform.OS === 'android'
      ? { labelVisibilityMode: 'labeled' as const, indicatorColor: c.accentSoft }
      : {};

  return (
    <NativeTabs
      tintColor={Platform.OS === 'android' ? c.accentText : c.accent}
      backgroundColor={c.bg}
      {...android}>
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      {/* The Workout tab. Its folder is `train` because a `workout` folder
          would collide with the root `/workout/[id]` modal. */}
      <NativeTabs.Trigger name="train">
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
  );
}
