import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/components/auth-provider';
import { getTrainingPrefs } from '@/data/home';

const KEY = 'liftcamp:onboarded';

type OnboardingState = {
  /** Whether the current account (or, signed out, this install) has onboarded. */
  onboarded: boolean;
  /** True until the device flag is read, and while an account is being checked. */
  loading: boolean;
  complete: () => void;
};

const Ctx = createContext<OnboardingState | null>(null);

export function useOnboarding(): OnboardingState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useOnboarding must be used inside <OnboardingProvider>.');
  return v;
}

/**
 * Whether onboarding has been completed, per account.
 *
 * Two signals. The device flag in AsyncStorage is the fast path: false
 * means this install has never finished the flow, so onboarding mounts
 * with no round trip, and it is what decides between onboarding and
 * sign-in when nobody is signed in. The account check is what makes it per
 * account: with the flag set and a session present, the profile is read
 * once for that user id, and a missing `user_profiles` row or a null
 * `training_level` counts as un-onboarded whatever the flag says. Those
 * columns are what onboarding writes, so their absence is the real signal;
 * there is no separate flag column.
 *
 * Without the account check, any account created from the sign-in route
 * (a new email, a Google or Apple identity Supabase had not seen, or
 * Continue without account) landed on Home with no onboarding, because the
 * sign-in route only exists on an install that has already onboarded once.
 *
 * The check runs once per user id, not live: onboarding writes the level
 * on page 3, and a live read would unmount the flow before page 4.
 * `complete()` records the answer for the current account in memory as
 * well as setting the flag, so the flow leaves without a second read.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  // Null until AsyncStorage answers.
  const [deviceFlag, setDeviceFlag] = useState<boolean | null>(null);
  // The account check for the most recent user id it ran for.
  const [account, setAccount] = useState<{ userId: string; onboarded: boolean } | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => setDeviceFlag(v === '1'));
  }, []);

  // The account read, only when the flag alone would send the user to the
  // tabs. With the flag false the flow mounts regardless, and a session
  // arriving inside it (Get started, or the page-1 sign-in) must not flip
  // the root into a loading state and remount the pager.
  useEffect(() => {
    if (!userId || deviceFlag !== true) return;
    if (account?.userId === userId) return;
    let cancelled = false;
    getTrainingPrefs(userId).then((prefs) => {
      if (!cancelled) setAccount({ userId, onboarded: prefs.level != null });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, deviceFlag, account]);

  const complete = useCallback(() => {
    setDeviceFlag(true);
    if (userId) setAccount({ userId, onboarded: true });
    void AsyncStorage.setItem(KEY, '1');
  }, [userId]);

  const checking = userId != null && deviceFlag === true && account?.userId !== userId;
  const loading = deviceFlag === null || checking;
  const onboarded =
    deviceFlag === true && (userId == null || (account?.userId === userId && account.onboarded));

  return <Ctx.Provider value={{ onboarded, loading, complete }}>{children}</Ctx.Provider>;
}
