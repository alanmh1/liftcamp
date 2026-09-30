import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORAGE_PREFIX, asWeightUnit, type WeightUnit } from '@liftcamp/shared';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/components/auth-provider';
import { getWeightUnit, primeHomeCache, setWeightUnit } from '@/data/home';

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
 * The unit this phone last had from the server for the account. Under the
 * `liftcamp:` prefix, so account deletion and Start fresh clear it.
 */
function unitKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}unit:${userId}`;
}

async function readKeptUnit(userId: string): Promise<WeightUnit | null> {
  try {
    const v = await AsyncStorage.getItem(unitKey(userId));
    return v === 'kg' || v === 'lb' ? v : null;
  } catch {
    return null;
  }
}

function keepUnit(userId: string, unit: WeightUnit): void {
  void AsyncStorage.setItem(unitKey(userId), unit).catch(() => {});
}

/**
 * The user's weight unit, shared by every screen that prints a load. Logged
 * sets carry their own unit and the data layer converts them to this one on
 * read, so switching never rewrites a set.
 *
 * Launch never waits on the network for it. The unit kept on the phone
 * answers at once, and Home's cache for that unit is loaded into memory
 * before `loading` turns false, so Home's first frame draws from it. The
 * server read runs behind that. Every request through supabase-js first
 * waits on auth-js's initialization, which with an expired token and no
 * signal is about 20 s of refresh retries; this read waiting that long
 * held Home, the workout screen and the summary on skeletons. A failed
 * read keeps the kept unit. Only an account this phone has never read
 * waits for the server, since a guessed unit would show every weight
 * converted wrong.
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
    void (async () => {
      const kept = await readKeptUnit(userId);
      if (kept) {
        await primeHomeCache(userId, kept);
        if (cancelled) return;
        setUnitState(kept);
        setLoading(false);
      }

      const stored = await getWeightUnit(userId);
      if (cancelled) return;
      if (stored === undefined) {
        // No answer. With a kept unit, nothing to change; with none, the
        // default, as before the unit was kept.
        if (!kept) {
          setUnitState('lb');
          setLoading(false);
        }
        return;
      }
      const next = asWeightUnit(stored);
      keepUnit(userId, next);
      if (next !== kept) {
        await primeHomeCache(userId, next);
        if (cancelled) return;
        setUnitState(next);
      }
      setLoading(false);
    })();
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
      if (result) {
        keepUnit(userId, next);
        setUnitState(next);
      }
      return result;
    },
    [userId, unit],
  );

  return (
    <Ctx.Provider value={{ unit, label: unitLabel(unit), loading, setUnit }}>{children}</Ctx.Provider>
  );
}
