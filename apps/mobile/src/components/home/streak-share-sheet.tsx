import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { Sheet, type SheetRef } from '@/components/BottomSheet';
import { StreakCard } from '@/components/home/streak-card';
import { CARD_SIZE } from '@/components/summary/share-card';
import { Text } from '@/components/text';
import { SHARE_URL, shareImage } from '@/lib/share-image';
import { ThemeOverride, useTheme } from '@/theme/theme-provider';
import { palettes, radius, spacing, type } from '@/theme/tokens';

export type StreakShareHandle = {
  /** Opens the preview for a streak of `weeks`. */
  present: (weeks: number) => void;
};

/**
 * The streak card's preview in a sheet, with Share. Opened from the streak
 * chip on the week card and from the Share button a milestone week's
 * celebration leaves under its line.
 *
 * Share works as the summary's does: the card is mounted at 1080 points
 * offscreen only for the capture, then goes to the system share sheet.
 * The offscreen copy is rendered where this component is mounted, beside
 * the sheet rather than in it, since the sheet portals to the root.
 *
 * The scheme is read here and handed to both copies, so the preview in
 * the portalled sheet and the captured image always match, including in
 * the dev gallery's theme override.
 */
export const StreakShareSheet = forwardRef<StreakShareHandle>(function StreakShareSheet(_props, ref) {
  const { scheme, colors: c } = useTheme();
  const { width } = useWindowDimensions();
  const sheet = useRef<SheetRef>(null);
  const [weeks, setWeeks] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const captureView = useRef<View>(null);
  const captureLaidOut = useRef<(() => void) | null>(null);

  useImperativeHandle(ref, () => ({
    present: (n: number) => {
      if (n < 1) return;
      setWeeks(n);
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

  async function onShare() {
    if (sharing) return;
    setSharing(true);
    const uri = await capture();
    setSharing(false);
    if (!uri) {
      Alert.alert('Could not make the image.', 'Try again.');
      return;
    }
    await shareImage(uri, `My ${weeks}-week streak on LiftCamp ${SHARE_URL}`);
  }

  // The sheet's body is inset by the screen padding on each side, and the
  // hairline edge sits inside that.
  const edge = StyleSheet.hairlineWidth;
  const cardWidth = width - spacing.screen * 2 - edge * 2;
  // The card's corner is 48 of its 1080 points.
  const cardRadius = (cardWidth * 48) / CARD_SIZE;

  return (
    <>
      {/* Offscreen, at share resolution, only while a capture is in flight. */}
      {capturing ? (
        <View style={styles.offscreen} pointerEvents="none">
          <View onLayout={() => captureLaidOut.current?.()} collapsable={false}>
            <ThemeOverride scheme={scheme}>
              <StreakCard ref={captureView} weeks={weeks} size={CARD_SIZE} />
            </ThemeOverride>
          </View>
        </View>
      ) : null}

      <Sheet ref={sheet}>
        <View style={styles.body}>
          {weeks > 0 ? (
            <ThemeOverride scheme={scheme}>
              <View style={[styles.cardEdge, { borderColor: c.border, borderWidth: edge, borderRadius: cardRadius + edge }]}>
                <StreakCard weeks={weeks} size={cardWidth} />
              </View>
            </ThemeOverride>
          ) : null}
          <Pressable
            onPress={() => void onShare()}
            disabled={sharing}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.share,
              { backgroundColor: c.accent },
              (pressed || sharing) && styles.pressed,
            ]}>
            <Text style={[type.button, { color: palettes.light.bg }]}>{sharing ? 'Preparing…' : 'Share'}</Text>
          </Pressable>
        </View>
      </Sheet>
    </>
  );
});

const styles = StyleSheet.create({
  body: { gap: spacing.lg, paddingTop: spacing.sm },
  // A hairline so the card's edge shows on the sheet in both modes: paper
  // on white in light, graphite on the darker surface in dark. The border
  // sits outside the card, so the capture has none.
  cardEdge: { alignSelf: 'center', overflow: 'hidden' },
  share: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.bar,
    paddingVertical: spacing.lg,
  },
  offscreen: { position: 'absolute', left: -CARD_SIZE * 2, top: 0 },
  pressed: { opacity: 0.7 },
});
