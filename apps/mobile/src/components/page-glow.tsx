import { useId } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { useColors } from '@/theme/theme-provider';
import { GLOW_HUES, type GlowHue } from '@/theme/tokens';

/** How far down the screen the glow reaches; below it the page is plain `bg`. */
const REACH = 0.45;
/** The web's glows: plate blue at 10%, the second hue at 25% (bg-primary/10, bg-pr/25). */
const ACCENT_OPACITY = 0.1;
const SECOND_OPACITY = 0.25;

/**
 * The brand glow behind a page's title area, after the web's PageGlow
 * (apps/web/src/components/PageGlow.tsx): plate blue top right, and a
 * second soft circle top left in `hue`. Drawn with react-native-svg radial
 * gradients, which fade each circle to nothing at its edge in place of the
 * web's blur, so no new native module is needed.
 *
 * Absolutely positioned and ignoring touches. Render it as the first child
 * of the page so the content draws over it. Both circles end inside the
 * top 45% of the screen, so the lower half, and the text over it, sit on
 * plain `bg`.
 */
export function PageGlow({ hue }: { hue: GlowHue }) {
  const c = useColors();
  const { width, height: screen } = useWindowDimensions();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const height = Math.round(screen * REACH);

  // Each circle is sized so its faded edge falls inside `height`.
  const accentR = Math.min(width * 0.75, height);
  const secondR = Math.min(width * 0.5, height * 0.55);
  const secondCy = Math.min(height * 0.35, height - secondR);

  return (
    <View pointerEvents="none" style={[styles.layer, { height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id={`a${id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={c.accent} stopOpacity={ACCENT_OPACITY} />
            <Stop offset="0.55" stopColor={c.accent} stopOpacity={ACCENT_OPACITY * 0.55} />
            <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`b${id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={GLOW_HUES[hue]} stopOpacity={SECOND_OPACITY} />
            <Stop offset="0.55" stopColor={GLOW_HUES[hue]} stopOpacity={SECOND_OPACITY * 0.55} />
            <Stop offset="1" stopColor={GLOW_HUES[hue]} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={width * 0.95} cy={0} r={accentR} fill={`url(#a${id})`} />
        <Circle cx={width * 0.08} cy={secondCy} r={secondR} fill={`url(#b${id})`} />
      </Svg>
    </View>
  );
}

/** The onboarding pages' second hue, by page index: butter, peach, mint, lavender, sky, then again. */
export const GLOW_ROTATION: readonly GlowHue[] = ['butter', 'peach', 'mint', 'lavender', 'sky'];

export function glowForPage(index: number): GlowHue {
  return GLOW_ROTATION[((index % GLOW_ROTATION.length) + GLOW_ROTATION.length) % GLOW_ROTATION.length]!;
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0 },
});
