import { useEffect, useRef } from 'react';
import { Image, View } from 'react-native';

import { WORDMARK } from '@/components/launch-overlay';
import { measureViewInWindow, registerHandoffTarget, useHandoffRevealed } from '@/lib/launch-handoff';
import { useTheme } from '@/theme/theme-provider';

/** On-screen width in points. The overlay's is the same, so the handoff is a move with no resize. */
const WIDTH = 160;

/**
 * The wordmark on the onboarding welcome page: the same image the launch
 * overlay shows, so on a cold start the overlay's can land on this one.
 *
 * It registers itself as the handoff target and stays invisible, holding
 * its space, until the overlay reveals it: at the moment the overlay's
 * wordmark lands here, or at once if the overlay has already gone. There
 * is never a frame with two on screen. See lib/launch-handoff.
 */
export function WelcomeWordmark() {
  const { scheme } = useTheme();
  const revealed = useHandoffRevealed();
  const ref = useRef<View>(null);

  useEffect(() => registerHandoffTarget(() => measureViewInWindow(ref.current)), []);

  return (
    // collapsable={false}: Android would otherwise flatten this wrapper out
    // of the native tree, and it could not be measured.
    <View
      ref={ref}
      collapsable={false}
      style={{ opacity: revealed ? 1 : 0 }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="LiftCamp">
      <Image
        source={WORDMARK.images[scheme]}
        style={{ width: WIDTH, height: WIDTH * WORDMARK.aspect }}
        resizeMode="contain"
        fadeDuration={0}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}
