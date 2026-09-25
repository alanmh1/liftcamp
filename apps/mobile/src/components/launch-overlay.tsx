import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, useColorScheme } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/**
 * A copy of the native splash that takes over when it hides, then moves:
 * the logo dips and springs back, and the overlay fades to reveal the app,
 * about 660 ms in all. With Reduce Motion on it is a plain 200 ms fade.
 *
 * It has to match the native splash exactly, so it copies the
 * expo-splash-screen config in app.json rather than the app's theme:
 *
 * - Background: the splash colors, chosen by the system appearance, since
 *   that is what the launch screen follows. The app's own Light, Dark or
 *   Auto setting is revealed by the fade.
 * - Image: iOS shows the wordmark (1024 x 1230), light or dark; Android
 *   shows splash-icon.png (1024 square) in both.
 * - Size and place: `imageWidth` points wide, height by aspect, centered on
 *   the whole window, not the safe area, which is how the plugin's
 *   storyboard lays it out. Android 12 and later put the icon in a system
 *   slot of their own sizing, so there it is a close match, not exact.
 *
 * The overlay renders from the first frame, under the native splash, and
 * hides the splash only once the root is ready and its own image has
 * loaded, so no frame shows between the two. The app mounts underneath as
 * soon as it is ready; nothing here waits on the network.
 *
 * It lives in the root layout's state, so it plays on a cold start only.
 * A resume from the background does not rerun it.
 */

/** Keep in step with `imageWidth` in app.json's expo-splash-screen config. */
const IMAGE_WIDTH = 160;

/** Keep in step with `backgroundColor` and `dark.backgroundColor` there. */
const BACKGROUND = { light: '#FDFCFB', dark: '#221F1B' } as const;

const IMAGES =
  Platform.OS === 'ios'
    ? {
        light: require('../../assets/images/splash-wordmark.png'),
        dark: require('../../assets/images/splash-wordmark-dark.png'),
        aspect: 1230 / 1024,
      }
    : {
        light: require('../../assets/images/splash-icon.png'),
        dark: require('../../assets/images/splash-icon.png'),
        aspect: 1,
      };

/** Timings, in ms. The dip and the spring overlap the start of the fade. */
const DIP_MS = 120;
const DIP_SCALE = 0.94;
const FADE_DELAY_MS = 400;
const FADE_MS = 260;
const REDUCED_FADE_MS = 200;

/**
 * If the image never reports a load, hide the splash anyway after this
 * long once the root is ready, rather than leave it up.
 */
const IMAGE_TIMEOUT_MS = 1000;

export function LaunchOverlay({ ready }: { ready: boolean }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const reduceMotion = useReducedMotion();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [done, setDone] = useState(false);
  const started = useRef(false);

  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!ready || imageLoaded) return;
    const t = setTimeout(() => setImageLoaded(true), IMAGE_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [ready, imageLoaded]);

  useEffect(() => {
    if (!ready || !imageLoaded || started.current) return;
    started.current = true;
    void SplashScreen.hideAsync();

    const finish = (finished?: boolean) => {
      'worklet';
      if (finished) runOnJS(setDone)(true);
    };

    if (reduceMotion) {
      // Reanimated skips animations under Reduce Motion by default, which
      // would cut straight to the app. The plain fade is the reduced form,
      // so it opts out of that.
      opacity.value = withTiming(
        0,
        { duration: REDUCED_FADE_MS, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never },
        finish,
      );
      return;
    }
    scale.value = withSequence(
      withTiming(DIP_SCALE, { duration: DIP_MS, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 12, stiffness: 260, mass: 0.6 }),
    );
    opacity.value = withDelay(
      FADE_DELAY_MS,
      withTiming(0, { duration: FADE_MS, easing: Easing.in(Easing.quad) }, finish),
    );
  }, [ready, imageLoaded, reduceMotion, scale, opacity]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (done) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: BACKGROUND[scheme] }, overlayStyle]}>
      <Animated.View style={logoStyle}>
        <Image
          source={IMAGES[scheme]}
          style={{ width: IMAGE_WIDTH, height: IMAGE_WIDTH * IMAGES.aspect }}
          resizeMode="contain"
          fadeDuration={0}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(true)}
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', zIndex: 1000, elevation: 1000 },
});
