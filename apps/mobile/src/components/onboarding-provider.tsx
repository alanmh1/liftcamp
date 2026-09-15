import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const KEY = 'liftcamp:onboarded';

type OnboardingState = {
  onboarded: boolean;
  loading: boolean;
  complete: () => void;
  /** Dev only: forget completion so the flow mounts again. See Profile. */
  reset: () => Promise<void>;
};

const Ctx = createContext<OnboardingState | null>(null);

export function useOnboarding(): OnboardingState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useOnboarding must be used inside <OnboardingProvider>.');
  return v;
}

/**
 * Whether first launch has been completed on this install.
 *
 * Stored on the device, not on the account: signing out and back in does not
 * repeat onboarding, a fresh install does.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [onboarded, setOnboarded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      setOnboarded(v === '1');
      setLoading(false);
    });
  }, []);

  const complete = useCallback(() => {
    setOnboarded(true);
    void AsyncStorage.setItem(KEY, '1');
  }, []);

  // Flipping `onboarded` is what returns to the flow: the root stack's
  // guard on it unmounts the tabs and mounts onboarding.
  const reset = useCallback(async () => {
    await AsyncStorage.removeItem(KEY);
    setOnboarded(false);
  }, []);

  return <Ctx.Provider value={{ onboarded, loading, complete, reset }}>{children}</Ctx.Provider>;
}
