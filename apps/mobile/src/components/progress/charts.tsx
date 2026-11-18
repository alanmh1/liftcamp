import {
  chartDomain,
  dateFraction,
  formatLoad,
  indexAtOrBefore,
  newBestFlags,
  roundedStepPath,
  shortDay,
  stepVertices,
  type WeightUnit,
} from '@liftcamp/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Polyline, Stop } from 'react-native-svg';

import { Text } from '@/components/text';
import { tick } from '@/lib/haptics';
import { useColors } from '@/theme/theme-provider';
import { tabular } from '@/theme/tokens';

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

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

const PAD = { top: 11, bottom: 4, left: 3, right: 11 };
/** Room at the right for the gridline values. */
const GUTTER = 26;
const CORNER = 4;
const TOOLTIP_W = 76;

/**
 * The running-max step chart on a Trends card. Sessions sit at their date
 * across the range, so a step lands where the new best happened. The y
 * domain is rounded to 5 lb or 2.5 kg past the data (chartDomain in
 * shared) with at most two gridlines labelled at the right, and the range's dates sit under it.
 * The line draws in on first appear (not under Reduce Motion), then the
 * fill and dots fade in. Pan scrubs: a hairline and the session in effect,
 * with a selection tick as it passes each session.
 *
 * `holding` (no gain) draws the line and dots in text3 with no fill.
 */
export function StepChart({
  points,
  range,
  unit,
  unitLabel,
  start,
  holding = false,
  height = 72,
}: {
  points: readonly { date: string; value: number }[];
  /** The best before the range, so a first session that beat it gets a dot. */
  start?: number;
  range: { start: string; end: string };
  unit: WeightUnit;
  unitLabel: string;
  holding?: boolean;
  height?: number;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const [gradientId] = useState(() => `step${(gradientSeq += 1)}`);
  const [scrubX, setScrubX] = useState<number | null>(null);
  const lastIndex = useRef(-1);
  const reduceMotion = useReducedMotion();
  const draw = useSharedValue(reduceMotion ? 1 : 0);
  const fade = useSharedValue(reduceMotion ? 1 : 0);
  const started = useRef(false);

  const stroke = holding ? c.text3 : c.accent;
  const plotW = Math.max(0, width - GUTTER);
  const base = height - PAD.bottom;

  const geo = useMemo(() => {
    if (plotW <= 0 || points.length === 0) return null;
    const domain = chartDomain(points.map((p) => p.value), unit);
    const innerW = plotW - PAD.left - PAD.right;
    const y = (v: number) => PAD.top + (1 - (v - domain.min) / (domain.max - domain.min)) * (base - PAD.top);
    const xy = points.map((p) => ({ x: PAD.left + dateFraction(p.date, range) * innerW, y: y(p.value) }));
    const line = roundedStepPath(stepVertices(xy), CORNER);
    const first = xy[0];
    const last = xy[xy.length - 1];
    const area = xy.length > 1 ? `${line.d}L${last.x},${base}L${first.x},${base}Z` : '';
    const bests = newBestFlags({ points, start: start ?? points[0].value });
    return { domain, y, xy, line, area, bests, last };
  }, [plotW, points, range, base, start, unit]);

  useEffect(() => {
    if (!geo || started.current) return;
    started.current = true;
    if (reduceMotion) {
      draw.value = 1;
      fade.value = 1;
      return;
    }
    draw.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    fade.value = withDelay(450, withTiming(1, { duration: 300 }));
  }, [geo, reduceMotion, draw, fade]);

  const length = geo?.line.length ?? 0;
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - draw.value) }), [length]);
  const fadeProps = useAnimatedProps(() => ({ opacity: fade.value }));

  const xs = geo?.xy.map((p) => p.x) ?? [];
  const scrubAt = (x: number) => {
    const clamped = Math.min(plotW - PAD.right, Math.max(PAD.left, x));
    const i = indexAtOrBefore(xs, clamped);
    if (lastIndex.current !== -1 && i !== lastIndex.current) tick();
    lastIndex.current = i;
    setScrubX(clamped);
  };
  const endScrub = () => {
    lastIndex.current = -1;
    setScrubX(null);
  };
  const pan = Gesture.Pan()
    .runOnJS(true)
    .enabled(geo != null)
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onStart((e) => scrubAt(e.x))
    .onUpdate((e) => scrubAt(e.x))
    .onFinalize(endScrub);

  const scrubIndex = scrubX != null ? indexAtOrBefore(xs, scrubX) : -1;
  const scrubPoint = scrubIndex >= 0 ? points[scrubIndex] : null;
  const thisYear = new Date().getFullYear();

  return (
    <View style={styles.fill}>
      <GestureDetector gesture={pan}>
        <View
          style={[styles.fill, { height }]}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          {geo ? (
            <>
              <Svg width={width} height={height}>
                <Defs>
                  <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={c.accent} stopOpacity={0.12} />
                    <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                {geo.domain.ticks.map((t) => (
                  <Line key={t} x1={0} x2={plotW} y1={geo.y(t)} y2={geo.y(t)} stroke={c.border} strokeWidth={StyleSheet.hairlineWidth} />
                ))}
                {!holding && geo.area ? <AnimatedPath d={geo.area} fill={`url(#${gradientId})`} animatedProps={fadeProps} /> : null}
                {geo.xy.length > 1 ? (
                  <AnimatedPath
                    d={geo.line.d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray={[length, length]}
                    animatedProps={lineProps}
                  />
                ) : null}
                <AnimatedG animatedProps={fadeProps}>
                  {geo.xy.map((p, i) =>
                    geo.bests[i] && i < geo.xy.length - 1 ? <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={stroke} /> : null,
                  )}
                  <Circle cx={geo.last.x} cy={geo.last.y} r={10} fill={stroke} fillOpacity={0.15} />
                  <Circle cx={geo.last.x} cy={geo.last.y} r={4.5} fill={stroke} />
                </AnimatedG>
                {scrubX != null ? (
                  <Line x1={scrubX} x2={scrubX} y1={0} y2={base} stroke={c.text2} strokeWidth={StyleSheet.hairlineWidth} />
                ) : null}
              </Svg>
              {geo.domain.ticks.map((t) => (
                <Text key={t} style={[styles.tick, { top: geo.y(t) - 7, color: c.text3 }]}>
                  {formatLoad(t)}
                </Text>
              ))}
              {scrubX != null && scrubPoint ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.tooltip,
                    {
                      left: Math.min(plotW - TOOLTIP_W, Math.max(0, scrubX - TOOLTIP_W / 2)),
                      backgroundColor: c.surface,
                      borderColor: c.border,
                    },
                  ]}>
                  <Text style={[styles.tooltipDate, { color: c.text2 }]}>{shortDay(scrubPoint.date, thisYear)}</Text>
                  <Text style={[styles.tooltipValue, { color: c.text }]}>
                    {formatLoad(Math.round(scrubPoint.value))} {unitLabel}
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      </GestureDetector>
      <View style={[styles.dates, { marginRight: GUTTER }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={[styles.date, { color: c.text3 }]}>{shortDay(range.start, thisYear)}</Text>
        <Text style={[styles.date, { color: c.text3 }]}>{shortDay(range.end, thisYear)}</Text>
      </View>
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
  tick: { position: 'absolute', right: 0, width: GUTTER - 4, textAlign: 'right', fontSize: 10, lineHeight: 14, ...tabular },
  dates: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  date: { fontSize: 10, lineHeight: 13 },
  tooltip: {
    position: 'absolute',
    top: 0,
    width: TOOLTIP_W,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignItems: 'center',
    shadowColor: '#221F1B',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tooltipDate: { fontSize: 10, lineHeight: 13 },
  tooltipValue: { fontSize: 12, lineHeight: 15, fontWeight: '600', ...tabular },
  glyph: { alignItems: 'center', justifyContent: 'center' },
});
