import { waitingRequestCount } from '@liftcamp/shared';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { useFollowRows, useFollowsSync } from '@/lib/follows';
import { useSocialOn } from '@/lib/social-access';
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
 * With the social flag, Profile shows a badge with the number of follow
 * requests waiting on the user. The follow rows are read here
 * (lib/follows.ts), so every social surface shares one read.
 *
 * The entry point is `unstable-native-tabs` in expo-router 57.0.20; the
 * `native-tabs` alias is not in this version's package root. The component
 * API is the documented one.
 */
export default function TabsLayout() {
  const c = useColors();
  const { session } = useAuth();
  // Null with social off, so nothing is read for a user without it.
  const socialUser = useSocialOn() === true ? (session?.user.id ?? null) : null;
  useFollowsSync(socialUser);
  const rows = useFollowRows(socialUser);
  const waiting = socialUser && rows ? waitingRequestCount(rows, socialUser, Date.now()) : 0;
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
        <NativeTabs.Trigger.Badge hidden={waiting === 0}>{String(waiting)}</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
