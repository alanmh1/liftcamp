import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { supabase } from '../../lib/supabase';

/**
 * The reads and the write behind Home's What's new card for 1.1
 * (components/home/whats-new-card.tsx). One key for the phone, under the
 * `liftcamp:` prefix, so account deletion and Start fresh clear it.
 */
const SEEN_KEY = 'liftcamp:whats-new:1.1';

/**
 * Whether to offer the card: iOS, not dismissed on this phone, and the user
 * has a workout logged from 1.0 (`app_version` "1.0.x (build)", see
 * appVersion in data/workouts.ts). The workout read is skipped once the
 * card was dismissed. Any failure answers false.
 */
export async function shouldOfferWhatsNew(userId: string): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    if ((await AsyncStorage.getItem(SEEN_KEY)) != null) return false;
    const { data, error } = await supabase
      .from('workouts')
      .select('id')
      .eq('user_id', userId)
      .like('app_version', '1.0%')
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
