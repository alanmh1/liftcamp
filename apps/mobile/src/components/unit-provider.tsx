import { asWeightUnit, type WeightUnit } from '@liftcamp/shared';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/components/auth-provider';
import { getWeightUnit, setWeightUnit } from '@/data/home';

/** What the user sees after a number. The DB stores `lb`; the app shows `lbs`. */
export type UnitLabel = 'lbs' | 'kg';

type UnitState = {
  /** The stored unit, for data functions. `lb` until the profile loads. */
  unit: WeightUnit;
  /** `lbs` until the profile loads, and for any value that is not `kg`. */
  label: UnitLabel;
  loading: boolean;
  /**
   * Switches the unit and converts the profile's bodyweight with it, in one
   * write. Every screen reading this context re-renders in the new unit.
   * Resolves to the converted bodyweight, or false when the write failed and
   * the unit did not change.
   */
  setUnit: (next: WeightUnit, bodyweight: number | null) => Promise<{ bodyweight: number | null } | false>;
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
 * that prints a load. Logged sets carry their own unit and the data layer
 * converts them to this one on read, so switching never rewrites a set.
 */
export function UnitProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [unit, setUnitState] = useState<WeightUnit>('lb');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setUnitState('lb');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getWeightUnit(userId).then((stored) => {
      if (cancelled) return;
      setUnitState(asWeightUnit(stored));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setUnit = useCallback<UnitState['setUnit']>(
    async (next, bodyweight) => {
      if (!userId) return false;
      // setWeightUnit converts bodyweight from the other unit, so a repeat
      // tap on the unit already in force must not reach it.
      if (next === unit) return { bodyweight };
      const result = await setWeightUnit(userId, next, bodyweight);
      if (result) setUnitState(next);
      return result;
    },
    [userId, unit],
  );

  return (
    <Ctx.Provider value={{ unit, label: unitLabel(unit), loading, setUnit }}>{children}</Ctx.Provider>
  );
}
