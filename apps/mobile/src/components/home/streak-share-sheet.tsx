import type { StreakShare } from '@liftcamp/shared';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { STREAK_CARD_BACKGROUND, StreakCard } from '@/components/home/streak-card';
import { ShareActions } from '@/components/share/share-actions';
import { CARD_SIZE } from '@/components/summary/share-card';
import { SHARE_URL } from '@/lib/share-image';
import { useColors } from '@/theme/theme-provider';
import { spacing } from '@/theme/tokens';

export type StreakShareHandle = {
  /** Opens the preview for a streak (streakShare in shared). */
  present: (share: StreakShare) => void;
};

/**
 * The streak card's preview in a sheet, with Share. Opened from the streak
 * chip on the week card and from the Share button a milestone week's
 * celebration leaves under its line.
 *
 * Share works as the summary's does: the card is mounted at 1080 points
 * offscreen only for the capture, then goes to the system share sheet.
 * The buttons are ShareActions, as on the summary.
 * The offscreen copy is rendered where this component is mounted, beside
 * the sheet rather than in it, since the sheet portals to the root.
 *
 * The card is the same in light and dark (it is an image for social), so
 * the preview and the capture match without passing the theme along.
 */
export const StreakShareSheet = forwardRef<StreakShareHandle>(function StreakShareSheet(_props, ref) {
  const c = useColors();
  const { width } = useWindowDimensions();
  const sheet = useRef<SheetRef>(null);
  const [share, setShare] = useState<StreakShare | null>(null);
  const [capturing, setCapturing] = useState(false);
  const captureView = useRef<View>(null);
  const captureLaidOut = useRef<(() => void) | null>(null);

  useImperativeHandle(ref, () => ({
    present: (next: StreakShare) => {
      if (next.weeks < 1) return;
      setShare(next);
      sheet.current?.present();
    },
  }));

  /** Mounts the card at 1080 offscreen, waits for layout, captures it. */
  const capture = useCallback(async (): Promise<string | null> => {
    setCapturing(true);
    await new Promise<void>((resolve) => {
      captureLaidOut.current = resolve;
    });
    // One frame after layout, so the text inside has been drawn too.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      return await captureRef(captureView, {
        format: 'png',
        width: CARD_SIZE,
        height: CARD_SIZE,
        quality: 1,
        result: 'tmpfile',
      });
    } catch {
      return null;
    } finally {
      setCapturing(false);
      captureLaidOut.current = null;
    }
  }, []);

  // The sheet's body is inset by the screen padding on each side, and the
  // hairline edge sits inside that.
  const edge = StyleSheet.hairlineWidth;
  const cardWidth = width - spacing.screen * 2 - edge * 2;
  // The card's corner is 48 of its 1080 points.
  const cardRadius = (cardWidth * 48) / CARD_SIZE;

  return (
    <>
      {/* Offscreen, at share resolution, only while a capture is in flight. */}
      {capturing && share ? (
        <View style={styles.offscreen} pointerEvents="none">
          <View onLayout={() => captureLaidOut.current?.()} collapsable={false}>
            <StreakCard ref={captureView} share={share} size={CARD_SIZE} />
          </View>
        </View>
      ) : null}

      <Sheet ref={sheet}>
        <View style={styles.body}>
          {share ? (
            <View style={[styles.cardEdge, { borderColor: c.border, borderWidth: edge, borderRadius: cardRadius + edge }]}>
              <StreakCard share={share} size={cardWidth} />
            </View>
          ) : null}
          {share ? (
            <ShareActions
              surface="streak"
              capture={capture}
              message={`My ${share.weeks}-week streak on LiftCamp ${SHARE_URL}`}
              background={STREAK_CARD_BACKGROUND}
            />
          ) : null}
        </View>
      </Sheet>
    </>
  );
});

const styles = StyleSheet.create({
  body: { gap: spacing.lg, paddingTop: spacing.sm },
  // A hairline around the card on the sheet. It sits outside the card, so
  // the capture has none.
  cardEdge: { alignSelf: 'center', overflow: 'hidden' },
  offscreen: { position: 'absolute', left: -CARD_SIZE * 2, top: 0 },
});
