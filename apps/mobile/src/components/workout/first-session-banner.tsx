import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORAGE_PREFIX, type WeightUnit } from '@liftcamp/shared';
import { useEffect, useState } from 'react';
import Animated, { FadeOut, useReducedMotion } from 'react-native-reanimated';

import { WHATS_NEW_EXIT_MS } from '@/components/home/whats-new-card';
import { TipNote } from '@/components/tip-note';
import * as home from '@/data/home';
import { networkFailedSince } from '@/lib/network';

/**
 * Two lines at the top of the workout for someone who has never finished
 * one: what ticking is for, and that one exercise is enough to finish.
 * Read once on mount: the server's finished count, plus any finish still
 * queued on the phone. With no answer from the server it stays hidden, so
 * nobody with a history sees it offline.
 *
 * The X writes `liftcamp:first-banner:<userId>` and the card fades out the
 * way the What's new card does. After that, or after the first finish, it
 * never shows again. Drawn as a TipNote. No haptic.
 *
 * The workout screen renders it keyed by the user, above the first card.
 */

function dismissedKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}first-banner:${userId}`;
}

export function FirstSessionBanner({ userId, unit }: { userId: string; unit: WeightUnit }) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const dismissed = await AsyncStorage.getItem(dismissedKey(userId)).catch(() => null);
      if (dismissed != null) return;
      const started = Date.now();
      const [count, phone] = await Promise.all([
        home.getFinishedWorkoutCount(userId),
        home.getLocalHomeState(userId, unit),
      ]);
      if (networkFailedSince(started)) return;
      if (live && count + phone.finished.length === 0) setShown(true);
    })();
    return () => {
      live = false;
    };
    // Once per mount; the unit changing does not change the answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function dismiss() {
    await AsyncStorage.setItem(dismissedKey(userId), new Date().toISOString()).catch(() => {});
    setShown(false);
  }

  if (!shown) return null;
  return (
    <Animated.View exiting={reduceMotion ? undefined : FadeOut.duration(WHATS_NEW_EXIT_MS)}>
      <TipNote onDismiss={() => void dismiss()}>
        {"Tick each set as you finish it.\nFinish whenever you're done, even after one exercise."}
      </TipNote>
    </Animated.View>
  );
}
