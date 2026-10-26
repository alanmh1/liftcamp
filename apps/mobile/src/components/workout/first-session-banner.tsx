import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_STORAGE_PREFIX, type WeightUnit } from '@liftcamp/shared';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeOut, useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { WHATS_NEW_EXIT_MS } from '@/components/home/whats-new-card';
import { Text } from '@/components/text';
import * as home from '@/data/home';
import { networkFailedSince } from '@/lib/network';
import { useTheme } from '@/theme/theme-provider';
import { cardSurface, spacing, type } from '@/theme/tokens';

/**
 * Two lines at the top of the workout for someone who has never finished
 * one: what ticking is for, and that one exercise is enough to finish.
 * Read once on mount: the server's finished count, plus any finish still
 * queued on the phone. With no answer from the server it stays hidden, so
 * nobody with a history sees it offline.
 *
 * The X writes `liftcamp:first-banner:<userId>` and the card fades out the
 * way the What's new card does. After that, or after the first finish, it
 * never shows again. No haptic, no accent, no icon.
 *
 * The workout screen renders it keyed by the user, above the first card.
 */

const RADIUS = 12;
const DISMISS_HIT = 44;

function dismissedKey(userId: string): string {
  return `${APP_STORAGE_PREFIX}first-banner:${userId}`;
}

export function FirstSessionBanner({ userId, unit }: { userId: string; unit: WeightUnit }) {
  const { scheme, colors: c } = useTheme();
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
    <Animated.View
      exiting={reduceMotion ? undefined : FadeOut.duration(WHATS_NEW_EXIT_MS)}
      style={[styles.card, cardSurface(scheme, c)]}>
      <Text style={[type.meta, styles.body, { color: c.text }]}>
        {"Tick each set as you finish it.\nFinish whenever you're done, even after one exercise."}
      </Text>
      <Pressable
        onPress={() => void dismiss()}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}>
        <Svg width={14} height={14} viewBox="0 0 14 14">
          <Path d="M2 2l10 10M12 2L2 12" stroke={c.text3} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: RADIUS,
    padding: spacing.card,
  },
  body: { flex: 1, fontSize: 15, lineHeight: 22 },
  // 44 pt to tap, pulled into the card's corner so the glyph sits on the
  // padding line, as on the What's new card.
  dismiss: {
    width: DISMISS_HIT,
    height: DISMISS_HIT,
    marginTop: -spacing.md,
    marginRight: -spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
