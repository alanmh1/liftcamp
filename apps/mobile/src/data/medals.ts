import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  medalCabinet,
  medalEarnsFromDates,
  medalKey,
  weekStreak,
  type MedalCabinet,
  type MedalEarn,
} from '@liftcamp/shared';

import { localDateIso } from '@/data/home';
import { supabase } from '../../lib/supabase';

/**
 * Streak medals on the server. The earn events are computed from workout
 * history (medalEarnEvents in packages/shared medals.ts); this file stores
 * them in user_medals and reads them back for the cabinet. Insert only:
 * the table grants clients SELECT and INSERT and nothing else, so a later
 * change of target, which rewrites the computed history, never removes a
 * medal. See supabase/migrations/20261003150000_user_medals.sql.
 */

/** The keys already stored, so a Home load with nothing new sends nothing. Under `liftcamp:`, so account deletion and Start fresh clear it. */
const syncedKey = (userId: string) => `liftcamp:medals-synced:${userId}`;

async function readSynced(userId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(syncedKey(userId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Local noon on a YYYY-MM-DD day, clear of any time zone edge. */
function localNoon(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/**
 * Stores every medal the history earns that is not stored yet. Called on
 * Home load with the server's finished dates and the weekly target. The
 * first call for an account backfills its whole history. A failure is
 * left for the next load; a medal already stored, from this phone or
 * another, is skipped by the unique key.
 */
export async function syncMedals(userId: string, dates: readonly string[], target: number): Promise<void> {
  const events = medalEarnsFromDates(dates, target);
  if (events.length === 0) return;
  const synced = await readSynced(userId);
  const missing = events.filter((e) => !synced.has(medalKey(e)));
  if (missing.length === 0) return;

  const today = localDateIso(new Date());
  const { error } = await supabase.from('user_medals').upsert(
    missing.map((e) => ({
      user_id: userId,
      weeks: e.weeks,
      earned_week_start: e.weekStart,
      // The day the week was hit. Earned today, the moment it is stored.
      earned_at: (e.earnedOn === today ? new Date() : localNoon(e.earnedOn)).toISOString(),
    })),
    { onConflict: 'user_id,weeks,earned_week_start', ignoreDuplicates: true },
  );
  if (error) return;
  for (const e of missing) synced.add(medalKey(e));
  await AsyncStorage.setItem(syncedKey(userId), JSON.stringify([...synced])).catch(() => {});
}

/** Every stored medal, as earn records. Null when the read failed. */
export async function getStoredMedals(userId: string): Promise<MedalEarn[] | null> {
  const { data, error } = await supabase
    .from('user_medals')
    .select('weeks, earned_week_start, earned_at')
    .eq('user_id', userId);
  if (error || !data) return null;
  return data.map((r) => ({
    weeks: r.weeks,
    weekStart: r.earned_week_start,
    earnedOn: localDateIso(new Date(r.earned_at)),
  }));
}

/**
 * The cabinet Profile and the medals screen draw: the stored medals and
 * the ones the history earns now, together (a medal earned this week shows
 * before its row is stored, and a stored one stays after a target change),
 * with the next rung counted from the current streak.
 */
export function buildCabinet(stored: readonly MedalEarn[] | null, dates: readonly string[], target: number): MedalCabinet {
  const computed = medalEarnsFromDates(dates, target);
  return medalCabinet([...(stored ?? []), ...computed], weekStreak(dates, target).current);
}
