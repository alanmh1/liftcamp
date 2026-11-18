import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useColors } from '@/theme/theme-provider';
import { GLOW_HUES, TINT_SLOTS } from '@/theme/tokens';

/** How far the far corner blends from the tint toward its saturated hue. */
const BLEND = 0.2;

/** `a` moved `t` of the way toward `b`, both #RRGGBB. */
function mixHex(a: string, b: string, t: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * A soft two-stop pastel wash behind a tile's clay art: the slot's tint
 * (light or dark per theme) at the top left, that tint blended 20% toward
 * its hue (GLOW_HUES) at the bottom right. Drawn with react-native-svg, so
 * no new native module. Fills its parent absolutely; render it first in
 * the art area and the art draws over it.
 */
export function TintWash({ slot }: { slot: number }) {
  const c = useColors();
  const id = `w${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { tint, hue } = TINT_SLOTS[((slot % TINT_SLOTS.length) + TINT_SLOTS.length) % TINT_SLOTS.length]!;
  const from = c[tint];
  const to = mixHex(from, GLOW_HUES[hue], BLEND);
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
