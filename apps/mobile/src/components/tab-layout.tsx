import { navHref, type NavTarget, type TabLayout, type TabStack } from '@liftcamp/shared';
import type { Href } from 'expo-router';
import { createContext, useCallback, useContext, type ReactNode } from 'react';

/**
 * Which tab bar this launch drew, from (tabs)/_layout.tsx: "four" without
 * the social flag, "three" with it. Screens read this, never the live
 * flag, so what a screen shows always matches the tabs on screen. Four
 * outside the tabs.
 */
const LayoutContext = createContext<TabLayout>('four');

/** The tab stack a screen sits in, from that stack's _layout. */
const StackContext = createContext<TabStack>(null);

export function TabLayoutProvider({ layout, children }: { layout: TabLayout; children: ReactNode }) {
  return <LayoutContext.Provider value={layout}>{children}</LayoutContext.Provider>;
}

export function TabStackProvider({ stack, children }: { stack: TabStack; children: ReactNode }) {
  return <StackContext.Provider value={stack}>{children}</StackContext.Provider>;
}

export function useTabLayout(): TabLayout {
  return useContext(LayoutContext);
}

/**
 * Where a link into History, a workout, an exercise or the routines list
 * goes from this screen. The rules are `navHref` in shared; a hidden tab
 * cannot be navigated to, so no screen hard-codes a tab path.
 */
export function useNavHref(): (target: NavTarget) => Href {
  const layout = useContext(LayoutContext);
  const stack = useContext(StackContext);
  // The paths are the typed routes' own; shared does not see their types.
  return useCallback((target: NavTarget) => navHref(target, layout, stack) as Href, [layout, stack]);
}
