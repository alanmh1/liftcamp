import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, useColorScheme, useWindowDimensions } from 'react-native';
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

import { measureHandoffTarget, measureViewInWindow, revealHandoffTarget } from '@/lib/launch-handoff';
import { markLaunch } from '@/lib/launch-timing';

/**
 * The drop, tuned here. The logo starts above the top edge of the screen
 * and falls to its centered place, accelerating the whole way, like a
 * weight dropped from a height.
 */
const DROP = {
  /** How far above the top edge the logo starts, in points. 0 starts it just out of view. */
  startOffset: 40,
  /** The fall, from the start to the landing. */
  ms: 420,
} as const;

/**
 * The rep, tuned here. It starts the moment the drop lands: the landing is
 * the squash, the stretch and lift is the rebound, and the second landing
 * settles to rest. Scales are about the bottom edge of the image, so the
 * logo stays planted while it squashes and stretches.
 *
 *   drop           0 to 420 ms (DROP.ms)
 *   squash         the next 120 ms
 *   stretch, lift  the next 200 ms
 *   land           the next 160 ms, then a spring to rest
 *   fade           once the land is done and the app is ready, whichever
 *                  is later, after `fade.delayMs`
 *
 * On the onboarding welcome page the fade is a handoff instead: after the
 * same hold the wordmark moves onto the welcome page's own wordmark
 * (`HANDOFF`), that one appears under it, and only the background fades.
 */
const REP = {
  squash: { ms: 120, scaleX: 1.12, scaleY: 0.88 },
  stretch: { ms: 200, scaleX: 0.94, scaleY: 1.08, lift: -24 },
  land: { ms: 160, scaleX: 1.06, scaleY: 0.94 },
  /** From the landing squash back to 1. */
  settle: { damping: 10, stiffness: 300, mass: 0.5 },
  /**
   * From whichever of the landing and ready comes later. The hold lets
   * the settle spring finish and the logo sit still before it goes.
   */
  fade: { delayMs: 700, ms: 350 },
} as const;

/** The move onto the welcome page's wordmark, before the background fades. */
const HANDOFF = { ms: 350 } as const;

/** Reduce Motion drops the drop, the rep and the handoff: the logo sits still, then this fade. */
const REDUCED_FADE_MS = 200;

/**
 * The launch. The native splash is the background color alone (the
 * plugin's image is a transparent PNG), so this overlay can put the logo
 * wherever it likes without a jump.
 *
 * - The overlay renders from the first frame, under the native splash,
 *   with the logo above the screen. When its image has loaded it hides
 *   the native splash and starts the drop straight away, without waiting
 *   for the app.
 * - The app mounts underneath as soon as it is ready. The overlay fades
 *   only once both the rep has landed and the app is ready, so a slow
 *   start shows the logo at rest, not a frozen drop, and a fast one never
 *   cuts the rep short. Nothing here waits on the network.
 * - Background: the splash colors, chosen by the system appearance, since
 *   that is what the native splash follows. The app's own Light, Dark or
 *   Auto setting is revealed by the fade.
 * - Image: the wordmark, light or dark, `IMAGE_WIDTH` points wide and
 *   centered on the whole window, on both platforms.
 * - Leaving: onto the welcome page, the wordmark moves to where the page
 *   shows its own and the page's appears in its place (see
 *   lib/launch-handoff), so there is only ever one on screen. Anywhere
 *   else, the whole overlay fades.
 *
 * It lives in the root layout's state, so it plays on a cold start only.
 * A resume from the background does not rerun it.
 */

/** The logo's width on screen, in points. The wordmark PNGs are 1024 x 1230. */
const IMAGE_WIDTH = 160;
const IMAGE_HEIGHT = IMAGE_WIDTH * (1230 / 1024);

/** Keep in step with `backgroundColor` and `dark.backgroundColor` in app.json. */
const BACKGROUND = { light: '#FDFCFB', dark: '#221F1B' } as const;

const IMAGES = {
  light: require('../../assets/images/splash-wordmark.png'),
  dark: require('../../assets/images/splash-wordmark-dark.png'),
};

/** The wordmark, for the onboarding welcome page, which shows the same one. */
export const WORDMARK = { images: IMAGES, aspect: 1230 / 1024 } as const;

/**
 * If the image never reports a load, start anyway after this long from
 * mount, rather than leave the native splash up.
 */
const IMAGE_TIMEOUT_MS = 1000;

export function LaunchOverlay({ ready }: { ready: boolean }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const reduceMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [landed, setLanded] = useState(false);
  const [done, setDone] = useState(false);
  const started = useRef(false);
  const fading = useRef(false);

  // The logo is centered, so its top is half the window and half its own
  // height above the center. Starting that far up, plus the offset, puts
  // it fully above the screen.
  const dropStart = -(windowHeight / 2 + IMAGE_HEIGHT / 2 + DROP.startOffset);

  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);
  const lift = useSharedValue(reduceMotion ? 0 : dropStart);
  const opacity = useSharedValue(1);
  // The handoff: a move and scale about the wordmark's center, and the
  // wordmark's own opacity, dropped once the welcome page's is showing.
  const moveX = useSharedValue(0);
  const moveY = useSharedValue(0);
  const moveScale = useSharedValue(1);
  const imageOpacity = useSharedValue(1);
  const imageRef = useRef<Image>(null);

  useEffect(() => {
    if (imageLoaded) return;
    const t = setTimeout(() => setImageLoaded(true), IMAGE_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [imageLoaded]);

  // Step 1: the image is in, so hide the native splash and start moving.
  useEffect(() => {
    if (!imageLoaded || started.current) return;
    started.current = true;
    markLaunch('overlay image loaded');
    void SplashScreen.hideAsync();

    if (reduceMotion) {
      setLanded(true);
      return;
    }

    const onLanded = (finished?: boolean) => {
      'worklet';
      if (finished) runOnJS(setLanded)(true);
    };

    // Squash eases out, the lift decelerates like a thrown weight, and
    // both falls accelerate like one dropped.
    const { squash, stretch, land, settle } = REP;
    const fall = { duration: DROP.ms, easing: Easing.in(Easing.quad) };
    const squashIn = { duration: squash.ms, easing: Easing.out(Easing.quad) };
    const stretchUp = { duration: stretch.ms, easing: Easing.out(Easing.cubic) };
    const dropDown = { duration: land.ms, easing: Easing.in(Easing.quad) };

    lift.value = withSequence(
      withTiming(0, fall),
      withTiming(0, squashIn),
      withTiming(stretch.lift, stretchUp),
      withTiming(0, dropDown, onLanded),
    );
    scaleX.value = withDelay(
      DROP.ms,
      withSequence(
        withTiming(squash.scaleX, squashIn),
        withTiming(stretch.scaleX, stretchUp),
        withTiming(land.scaleX, dropDown),
        withSpring(1, settle),
      ),
    );
    scaleY.value = withDelay(
      DROP.ms,
      withSequence(
        withTiming(squash.scaleY, squashIn),
        withTiming(stretch.scaleY, stretchUp),
        withTiming(land.scaleY, dropDown),
        withSpring(1, settle),
      ),
    );
  }, [imageLoaded, reduceMotion, lift, scaleX, scaleY]);

  // Step 2: leave once the rep has landed and the app is ready, whichever
  // comes later: a handoff onto the welcome page if it is showing, else a
  // fade.
  useEffect(() => {
    if (!landed || !ready || fading.current) return;
    fading.current = true;
    markLaunch('fade start');

    const finish = (finished?: boolean) => {
      'worklet';
      if (finished) runOnJS(setDone)(true);
    };
    const fadeOut = () => {
      opacity.value = withTiming(0, { duration: REP.fade.ms, easing: Easing.in(Easing.quad) }, finish);
    };

    if (reduceMotion) {
      // No move: the welcome wordmark shows under the overlay and the two
      // cross in the fade. Reanimated skips animations under Reduce Motion
      // by default, which would cut straight to the app. The plain fade is
      // the reduced form, so it opts out of that.
      revealHandoffTarget();
      opacity.value = withTiming(
        0,
        { duration: REDUCED_FADE_MS, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never },
        finish,
      );
      return;
    }

    // Once the welcome wordmark is showing under this one: drop this one a
    // frame later, so there is never a frame with neither, and fade what
    // is left, the background.
    const onArrived = () => {
      markLaunch('handoff landed');
      revealHandoffTarget();
      requestAnimationFrame(() => {
        imageOpacity.value = 0;
        fadeOut();
      });
    };

    // The hold, then measure both wordmarks. The welcome page has been
    // mounted since `ready`, so its layout is in by now.
    setTimeout(() => {
      void (async () => {
        const [target, own] = await Promise.all([
          measureHandoffTarget(),
          measureViewInWindow(imageRef.current),
        ]);
        if (!target || !own) {
          revealHandoffTarget();
          fadeOut();
          return;
        }
        markLaunch('handoff start');
        const move = { duration: HANDOFF.ms, easing: Easing.inOut(Easing.cubic) };
        moveX.value = withTiming(target.x + target.width / 2 - (own.x + own.width / 2), move);
        moveY.value = withTiming(target.y + target.height / 2 - (own.y + own.height / 2), move);
        moveScale.value = withTiming(target.width / own.width, move, (finished) => {
          'worklet';
          if (finished) runOnJS(onArrived)();
        });
      })();
    }, REP.fade.delayMs);
  }, [landed, ready, reduceMotion, opacity, moveX, moveY, moveScale, imageOpacity]);

  useEffect(() => {
    if (landed) markLaunch('rep landed');
  }, [landed]);
  useEffect(() => {
    if (!done) return;
    markLaunch('overlay gone');
    // Whatever path the overlay took, the welcome wordmark may show now.
    revealHandoffTarget();
  }, [done]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const handoffStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
    transform: [{ translateX: moveX.value }, { translateY: moveY.value }, { scale: moveScale.value }],
  }));
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { scaleX: scaleX.value }, { scaleY: scaleY.value }],
  }));

  if (done) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: BACKGROUND[scheme] }, overlayStyle]}>
      <Animated.View style={handoffStyle}>
        <Animated.View style={[styles.anchor, logoStyle]}>
          <Image
            ref={imageRef}
            source={IMAGES[scheme]}
            style={{ width: IMAGE_WIDTH, height: IMAGE_HEIGHT }}
            resizeMode="contain"
            fadeDuration={0}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(true)}
            accessibilityIgnoresInvertColors
          />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', zIndex: 1000, elevation: 1000 },
  // Scale about the bottom edge, so a squash flattens onto the floor.
  anchor: { transformOrigin: 'bottom' },
});
