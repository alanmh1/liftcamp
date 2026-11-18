import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Polyline, Stop } from 'react-native-svg';

import { useColors } from '@/theme/theme-provider';

/**
 * Small charts for the progress sections, drawn with react-native-svg at
 * their real size (no preserveAspectRatio="none", so strokes and dots keep
 * their shape).
 */

/** A per-session line, 72 × 28 by default, accent, with a dot on the last point. */
export function Sparkline({ values, width = 72, height = 28 }: { values: readonly number[]; width?: number; height?: number }) {
  const c = useColors();
  if (values.length === 0) return <View style={{ width, height }} />;
  const pad = 4;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const x = (i: number) => (values.length === 1 ? width / 2 : pad + (i / (values.length - 1)) * (width - pad * 2));
  const y = (v: number) => (hi === lo ? height / 2 : pad + (1 - (v - lo) / (hi - lo)) * (height - pad * 2));
  const last = values.length - 1;
  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {values.length > 1 ? (
        <Polyline
          points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          fill="none"
          stroke={c.accent}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
      <Circle cx={x(last)} cy={y(values[last])} r={3} fill={c.accent} />
    </Svg>
  );
}

let gradientSeq = 0;

/**
 * The running-max step chart on a Trends card: a 2.5 pt rounded line that
 * steps up at each new best, a vertical gradient under it fading to
 * nothing, a faint baseline and one ringed dot at the end. Points are
 * placed by date, so a long gap reads as a long flat run.
 */
export function StepChart({ points, height = 64 }: { points: readonly { date: string; value: number }[]; height?: number }) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const [gradientId] = useState(() => `step${(gradientSeq += 1)}`);

  const pad = { top: 6, bottom: 4, side: 5 };
  let body = null;
  if (width > 0 && points.length > 0) {
    const t = points.map((p) => new Date(`${p.date}T00:00:00`).getTime());
    const t0 = t[0];
    const t1 = t[t.length - 1];
    const values = points.map((p) => p.value);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const innerW = width - pad.side * 2;
    const base = height - pad.bottom;
    const x = (i: number) => pad.side + (t1 === t0 ? (points.length === 1 ? innerW : (i / (points.length - 1)) * innerW) : ((t[i] - t0) / (t1 - t0)) * innerW);
    // A flat series sits at two thirds height rather than on the baseline.
    // The lowest point sits a little above the baseline so the fill shows.
    const plotH = (base - pad.top) * 0.85;
    const y = (v: number) => (hi === lo ? pad.top + (base - pad.top) / 3 : pad.top + (1 - (v - lo) / (hi - lo)) * plotH);
    const startX = points.length === 1 ? pad.side : x(0);
    let d = `M${startX},${y(values[0])}`;
    for (let i = 1; i < points.length; i += 1) d += `H${x(i)}V${y(values[i])}`;
    const endX = x(points.length - 1);
    const endY = y(values[values.length - 1]);
    const area = `${d}V${base}H${startX}Z`;
    body = (
      <>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.accent} stopOpacity={0.22} />
            <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Line x1={pad.side} x2={width - pad.side} y1={base} y2={base} stroke={c.border} strokeWidth={1} />
        <Path d={area} fill={`url(#${gradientId})`} />
        <Path d={d} fill="none" stroke={c.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={endX} cy={endY} r={4} fill={c.surface} stroke={c.accent} strokeWidth={2.5} />
      </>
    );
  }
  return (
    <View
      style={[styles.fill, { height }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {width > 0 ? (
        <Svg width={width} height={height}>
          {body}
        </Svg>
      ) : null}
    </View>
  );
}

/** Two short rising lines, the Trends row's glyph. */
export function TrendsGlyph({ size = 36 }: { size?: number }) {
  const c = useColors();
  return (
    <View style={[styles.glyph, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.accentSoft }]}>
      <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
        <Polyline points="2,18 8,13 13,15 22,5" fill="none" stroke={c.accentText} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points="2,21 9,19 15,20 22,14" fill="none" stroke={c.accentText} strokeOpacity={0.45} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { alignSelf: 'stretch' },
  glyph: { alignItems: 'center', justifyContent: 'center' },
});
