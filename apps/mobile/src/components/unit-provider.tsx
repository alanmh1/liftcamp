import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/components/auth-provider';
import { getWeightUnit } from '@/data/home';

/** What the user sees after a number. The DB stores `lb`; the app shows `lbs`. */
export type UnitLabel = 'lbs' | 'kg';

type UnitState = {
  /** `lbs` until the profile loads, and for any value that is not `kg`. */
  label: UnitLabel;
  loading: boolean;
};

const Ctx = createContext<UnitState | null>(null);

export function useWeightUnit(): UnitState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWeightUnit must be used inside <UnitProvider>.');
  return v;
}

/**
 * `user_profiles.weight_unit` is free text behind a CHECK, so the map is
 * explicit: `lb` and anything unexpected show as lbs, only `kg` shows as kg.
 */
export function unitLabel(stored: string | null | undefined): UnitLabel {
  return stored === 'kg' ? 'kg' : 'lbs';
}

/**
 * The user's weight unit, read once per session and shared by every screen
 * that prints a load. Read-only for now: switching units needs a decision
 * about converting logged weights first, so there is no setter here yet.
 */
export function UnitProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [label, setLabel] = useState<UnitLabel>('lbs');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLabel('lbs');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getWeightUnit(userId).then((stored) => {
      if (cancelled) return;
      setLabel(unitLabel(stored));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return <Ctx.Provider value={{ label, loading }}>{children}</Ctx.Provider>;
}
