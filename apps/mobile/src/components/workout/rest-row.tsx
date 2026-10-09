import { Platform } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useColors } from '@/theme/theme-provider';

// The rest timer's ring and time format, shared by the rest tray
// (rest-tray.tsx) and the rest sheet. The inline rest row that used to live
// here gave way to the tray.

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The rest ring: a track at 15% text and an accentText arc showing the
 * fraction remaining, so it starts full and empties clockwise from 12
 * o'clock. The rest tray and the rest sheet draw the same ring at two
 * sizes; the tray's track is accentSoft.
 */
export function RestRing({
  size,
  stroke,
  fraction,
  trackColor,
}: {
  size: number;
  stroke: number;
  /** Remaining over total, 0 to 1. */
  fraction: number;
  /** A solid track color in place of the default 15% text. */
  trackColor?: string;
}) {
  const c = useColors();
  // The ring's outer edge is the Svg's edge exactly. Android lays the Svg
  // out on whole device pixels, which at a fractional density (22 pt is
  // 57.75 px at 2.625) can come out a fraction of a pixel short, and the
  // stroke is cut there. One point of inset keeps the ring inside.
  const r = (size - stroke) / 2 - (Platform.OS === 'android' ? 1 : 0);
  const circumference = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={trackColor ?? c.text}
        strokeOpacity={trackColor ? 1 : 0.15}
        strokeWidth={stroke}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={c.accentText}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

/** Remaining over total for the ring, clamped to 0 to 1. */
export function restFraction(remaining: number, total: number): number {
  return total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
}
