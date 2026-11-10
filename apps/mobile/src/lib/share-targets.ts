import { TIKTOK_SHARE_CALLBACK_URL, tikTokShareOn } from '@liftcamp/shared';
import { useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { useAuth } from '@/components/auth-provider';
import { supabase } from '../../lib/supabase';
import ShareTargets, { type TikTokShareResult } from '../../modules/share-targets';

/**
 * Sending a card straight to Instagram Stories or TikTok, on iOS. Android
 * has no native module, so both buttons stay hidden there and it keeps the
 * system sheet.
 */

/** The Meta App ID, which Instagram requires on every share to Stories. */
const INSTAGRAM_APP_ID = '967576539232975';

const INSTAGRAM_URL = 'instagram-stories://share';
/** TikTok's two app schemes, one per regional build. */
const TIKTOK_URLS = ['snssdk1233://', 'snssdk1180://'];

async function installed(url: string): Promise<boolean> {
  return Linking.canOpenURL(url).catch(() => false);
}

/** The tiktok_share flag from the two tables RLS lets a member read. Fails closed. */
async function readTikTokFlag(userId: string): Promise<{ enabledForAll: boolean; userState: string | null } | null> {
  try {
    const [global, own] = await Promise.all([
      supabase.from('app_flags').select('enabled_for_all').eq('flag', 'tiktok_share').maybeSingle(),
      supabase.from('user_flags').select('state').eq('flag', 'tiktok_share').eq('user_id', userId).maybeSingle(),
    ]);
    if (global.error || own.error) return null;
    return { enabledForAll: global.data?.enabled_for_all ?? false, userState: own.data?.state ?? null };
  } catch {
    return null;
  }
}

/**
 * Which direct targets to offer. Both start hidden and appear once checked,
 * and the check runs again on returning to the app, in case one was
 * installed. Nothing waits on it, so an offline read only leaves TikTok out.
 */
export function useShareTargets(): { instagram: boolean; tiktok: boolean } {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const isGuest = !!session?.user.is_anonymous;
  const [targets, setTargets] = useState({ instagram: false, tiktok: false });

  useEffect(() => {
    if (!ShareTargets) return;
    let live = true;

    async function check() {
      const [instagram, tiktokInstalled] = await Promise.all([
        installed(INSTAGRAM_URL),
        Promise.all(TIKTOK_URLS.map(installed)).then((found) => found.some(Boolean)),
      ]);
      let tiktok = false;
      if (tiktokInstalled && ShareTargets?.tikTokConfigured) {
        const flag = !__DEV__ && userId && !isGuest ? await readTikTokFlag(userId) : null;
        tiktok = tikTokShareOn({
          isDev: __DEV__,
          isGuest,
          enabledForAll: flag?.enabledForAll ?? false,
          userState: flag?.userState ?? null,
        });
      }
      if (live) setTargets({ instagram, tiktok });
    }

    void check();
    const listener = AppState.addEventListener('change', (next) => {
      if (next === 'active') void check();
    });
    return () => {
      live = false;
      listener.remove();
    };
  }, [userId, isGuest]);

  return targets;
}

/** False when Instagram could not be opened or the image could not be read. */
export async function shareToInstagramStories(imageUri: string, backgroundColor: string): Promise<boolean> {
  if (!ShareTargets) return false;
  return ShareTargets.shareToInstagramStories(imageUri, INSTAGRAM_APP_ID, backgroundColor);
}

/** Settles when TikTok returns to the app, which it may never do. */
export async function shareToTikTok(imageUri: string): Promise<TikTokShareResult> {
  if (!ShareTargets) return { status: 'failed' };
  return ShareTargets.shareToTikTok(imageUri, TIKTOK_SHARE_CALLBACK_URL);
}
