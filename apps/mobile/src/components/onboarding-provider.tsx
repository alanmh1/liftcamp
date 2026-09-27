import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveAccountOnboarded, shouldCacheOnboarded } from '@liftcamp/shared';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/components/auth-provider';
import { checkOnboarding } from '@/data/home';

const KEY = 'liftcamp:onboarded';

/**
 * The per-account cache: '1' once the account is confirmed onboarded.
 * Under the `liftcamp:` prefix, so Start fresh clears it with the rest.
 */
function accountKey(userId: string): string {
  return `${KEY}:${userId}`;
}

type OnboardingState = {
  /** Whether the current account (or, signed out, this install) has onboarded. */
  onboarded: boolean;
  /** True until the device flag is read, and while an account is being checked. */
  loading: boolean;
  complete: () => void;
  /**
   * Sends the install back to the first launch: the root holds on its
   * spinner while `work` runs (signing out, clearing storage), then the
   * device flag is false and the flow mounts with no session, exactly as
   * on a fresh install. For account deletion, where the root must not
   * show the sign-in screen for a frame between the two.
   */
  startOver: (work: () => Promise<void>) => Promise<void>;
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
 * account: with the flag set and a session present, the account is
 * checked once for that user id, and a missing `user_profiles` row or a
 * null `training_level` counts as un-onboarded whatever the flag says.
 * Those columns are what onboarding writes, so their absence is the real
 * signal; there is no separate flag column.
 *
 * Without the account check, any account created from the sign-in route
 * (a new email, a Google or Apple identity Supabase had not seen, or
 * Continue without account) landed on Home with no onboarding, because the
 * sign-in route only exists on an install that has already onboarded once.
 *
 * The account check reads a per-account cache first. A confirmed yes is
 * cached, so after the first launch the root never waits on the network
 * for this, and the native splash holds only for the session and fonts.
 * A failed read (no signal) never counts as "not onboarded": it falls back
 * to the device flag, which is set whenever this check runs. The rules
 * live in `resolveAccountOnboarded` in shared, with its tests.
 *
 * The check runs once per user id, not live: onboarding writes the level
 * on page 3, and a live read would unmount the flow before page 4.
 * `complete()` records the answer for the current account in memory and
 * in the cache as well as setting the flag, so the flow leaves without a
 * second read.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  // Null until AsyncStorage answers.
  const [deviceFlag, setDeviceFlag] = useState<boolean | null>(null);
  // The account check for the most recent user id it ran for.
  const [account, setAccount] = useState<{ userId: string; onboarded: boolean } | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => setDeviceFlag(v === '1'))
      .catch(() => setDeviceFlag(false));
  }, []);

  // The account check, only when the flag alone would send the user to the
  // tabs. With the flag false the flow mounts regardless, and a session
  // arriving inside it (Get started, or the page-1 sign-in) must not flip
  // the root into a loading state and remount the pager.
  useEffect(() => {
    if (!userId || deviceFlag !== true) return;
    if (account?.userId === userId) return;
    let cancelled = false;
    (async () => {
      const cached = await AsyncStorage.getItem(accountKey(userId)).then(
        (v) => v === '1',
        () => false,
      );
      const check = cached ? null : await checkOnboarding(userId);
      if (cancelled) return;
      if (shouldCacheOnboarded(check)) void AsyncStorage.setItem(accountKey(userId), '1');
      setAccount({ userId, onboarded: resolveAccountOnboarded({ cached, deviceFlag, check }) });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, deviceFlag, account]);

  const complete = useCallback(() => {
    setDeviceFlag(true);
    if (userId) {
      setAccount({ userId, onboarded: true });
      void AsyncStorage.setItem(accountKey(userId), '1');
    }
    void AsyncStorage.setItem(KEY, '1');
  }, [userId]);

  // Null reads as loading, which holds the root; the account check does
  // not run, since it wants the flag true.
  const startOver = useCallback(async (work: () => Promise<void>) => {
    setDeviceFlag(null);
    setAccount(null);
    try {
      await work();
    } finally {
      setDeviceFlag(false);
    }
  }, []);

  const checking = userId != null && deviceFlag === true && account?.userId !== userId;
  const loading = deviceFlag === null || checking;
  const onboarded =
    deviceFlag === true && (userId == null || (account?.userId === userId && account.onboarded));

  return <Ctx.Provider value={{ onboarded, loading, complete, startOver }}>{children}</Ctx.Provider>;
}
