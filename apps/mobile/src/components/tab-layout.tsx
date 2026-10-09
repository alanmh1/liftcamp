import { navHref, type NavTarget, type TabStack } from '@liftcamp/shared';
import type { Href } from 'expo-router';
import { createContext, useCallback, useContext, type ReactNode } from 'react';

/** The tab stack a screen sits in, from that stack's _layout. */
const StackContext = createContext<TabStack>(null);

export function TabStackProvider({ stack, children }: { stack: TabStack; children: ReactNode }) {
  return <StackContext.Provider value={stack}>{children}</StackContext.Provider>;
}

/**
 * Where a link into History, a workout, an exercise, the library or the routines list
 * goes from this screen. The rules are `navHref` in shared, so no screen
 * hard-codes a tab path.
 */
export function useNavHref(): (target: NavTarget) => Href {
  const stack = useContext(StackContext);
  // The paths are the typed routes' own; shared does not see their types.
  return useCallback((target: NavTarget) => navHref(target, stack) as Href, [stack]);
}
