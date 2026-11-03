import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../../lib/supabase';

/**
 * The reads and the write behind Home's What's new card for November 2026
 * (components/home/whats-new-card.tsx, docs/whats-new-nov-spec.md). One key
 * for the phone, under the `liftcamp:` prefix, so account deletion and
 * Start fresh clear it.
 */

/** Names this card in analytics, so a later card can be told apart. */
export const WHATS_NEW_CARD = '2026-11';
const SEEN_KEY = `liftcamp:whats-new:${WHATS_NEW_CARD}`;
/** Midnight Pacific, 4 Nov 2026. Accounts newer than this never see the card. */
const LOGGED_BEFORE = '2026-11-04T08:00:00Z';

/**
 * Whether to offer the card: not dismissed on this phone, and the user has
 * a finished workout logged in the app before the cutoff. Imported workouts
 * (`platform = 'import'`) don't count. The workout read is skipped once the
 * card was dismissed. Any failure answers false.
 */
export async function shouldOfferWhatsNew(userId: string): Promise<boolean> {
  try {
    if ((await AsyncStorage.getItem(SEEN_KEY)) != null) return false;
    const { data, error } = await supabase
      .from('workouts')
      .select('id')
      .eq('user_id', userId)
      .not('finished_at', 'is', null)
      .in('platform', ['ios', 'android'])
      .lt('created_at', LOGGED_BEFORE)
      .limit(1);
    if (error) return false;
    return (data ?? []).length > 0;
  } catch {
    return false;
  }
}

/** Never offered again on this phone. */
export async function markWhatsNewSeen(): Promise<void> {
  await AsyncStorage.setItem(SEEN_KEY, new Date().toISOString()).catch(() => {});
}
