import {
  chartDomain,
  chartValueLabel,
  dateFraction,
  formatDateLabel,
  formatLoad,
  nearestIndex,
  shortDay,
  type DatedValue,
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
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { Text } from '@/components/text';
import { tick } from '@/lib/haptics';
import { useColors } from '@/theme/theme-provider';
import { tabular } from '@/theme/tokens';

let gradientSeq = 0;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

const PAD = { top: 12, bottom: 6, left: 6, right: 12 };
/** Room at the right for the gridline values, "1000" at most. */
const GUTTER = 34;
const TOOLTIP_W = 128;

/** Two decimals, no trailing zeros, for SVG path data. */
function num(v: number): string {
  return String(Math.round(v * 100) / 100);
}

/**
 * The exercise progress line: one point per session at its date across
 * the range, so a gap in training reads as a gap. The y domain and its
 * gridlines come from chartDomain in shared, as on the Trends step charts,
 * and so do the range's dates under the plot. The line draws in on first
 * appear (not under Reduce Motion), then the fill and dots fade in.
 *
 * `scrub`: press and drag to show the nearest session's date (with the
 * year when it is not this year) and value, with a selection tick as it
 * moves from one session to the next. Off on the History card, which is
 * one tap target that opens the fullscreen chart.
 */
export function ExerciseLineChart({
  points,
  range,
  unit,
  unitLabel,
  height,
  scrub = false,
}: {
  /** Oldest first, inside the range. */
  points: readonly DatedValue[];
  range: { start: string; end: string };
  unit: WeightUnit;
  unitLabel: string;
  height: number;
  scrub?: boolean;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const [gradientId] = useState(() => `exline${(gradientSeq += 1)}`);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const draw = useSharedValue(reduceMotion ? 1 : 0);
  const fade = useSharedValue(reduceMotion ? 1 : 0);
  const started = useRef(false);

  const plotW = Math.max(0, width - GUTTER);
  const base = height - PAD.bottom;

  const geo = useMemo(() => {
    if (plotW <= 0 || points.length === 0) return null;
    const domain = chartDomain(points.map((p) => p.value), unit);
    const innerW = plotW - PAD.left - PAD.right;
    const y = (v: number) => PAD.top + (1 - (v - domain.min) / (domain.max - domain.min)) * (base - PAD.top);
    const xy = points.map((p) => ({ x: PAD.left + dateFraction(p.date, range) * innerW, y: y(p.value) }));
    let d = '';
    let length = 0;
    xy.forEach((p, i) => {
      d += `${i === 0 ? 'M' : 'L'}${num(p.x)},${num(p.y)}`;
      if (i > 0) length += Math.hypot(p.x - xy[i - 1].x, p.y - xy[i - 1].y);
    });
    const first = xy[0];
    const last = xy[xy.length - 1];
    const area = xy.length > 1 ? `${d}L${num(last.x)},${base}L${num(first.x)},${base}Z` : '';
    return { domain, y, xy, d, length, area, last };
  }, [plotW, points, range, base, unit]);

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

  const length = geo?.length ?? 0;
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - draw.value) }), [length]);
  const fadeProps = useAnimatedProps(() => ({ opacity: fade.value }));

  const xs = geo?.xy.map((p) => p.x) ?? [];
  const lastIndex = useRef(-1);
  const scrubAt = (x: number) => {
    const i = nearestIndex(xs, x);
    if (i < 0) return;
    if (lastIndex.current !== -1 && i !== lastIndex.current) tick();
    lastIndex.current = i;
    setScrubIndex(i);
  };
  const endScrub = () => {
    lastIndex.current = -1;
    setScrubIndex(null);
  };
  const pan = Gesture.Pan()
    .runOnJS(true)
    .enabled(scrub && geo != null)
    .minDistance(0)
    .onBegin((e) => scrubAt(e.x))
    .onUpdate((e) => scrubAt(e.x))
    .onFinalize(endScrub);

  const active = scrubIndex != null && geo && scrubIndex < geo.xy.length ? scrubIndex : null;
  const activeXY = active != null && geo ? geo.xy[active] : null;
  const activePoint = active != null ? points[active] : null;
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
                {geo.area ? <AnimatedPath d={geo.area} fill={`url(#${gradientId})`} animatedProps={fadeProps} /> : null}
                {geo.xy.length > 1 ? (
                  <AnimatedPath
                    d={geo.d}
                    fill="none"
                    stroke={c.accent}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray={[length, length]}
                    animatedProps={lineProps}
                  />
                ) : null}
                <AnimatedG animatedProps={fadeProps}>
                  {geo.xy.map((p, i) =>
                    i < geo.xy.length - 1 ? <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={c.accent} /> : null,
                  )}
                  <Circle cx={geo.last.x} cy={geo.last.y} r={10} fill={c.accent} fillOpacity={0.15} />
                  <Circle cx={geo.last.x} cy={geo.last.y} r={4.5} fill={c.accent} />
                </AnimatedG>
                {activeXY ? (
                  <>
                    <Line x1={activeXY.x} x2={activeXY.x} y1={0} y2={base} stroke={c.text2} strokeWidth={StyleSheet.hairlineWidth} />
                    <Circle cx={activeXY.x} cy={activeXY.y} r={5} fill={c.surface} stroke={c.accent} strokeWidth={2.5} />
                  </>
                ) : null}
              </Svg>
              {geo.domain.ticks.map((t) => (
                <Text key={t} style={[styles.tick, { top: geo.y(t) - 7, color: c.text3 }]} maxFontSizeMultiplier={1}>
                  {formatLoad(t)}
                </Text>
              ))}
              {activeXY && activePoint ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.tooltip,
                    {
                      left: Math.min(plotW - TOOLTIP_W, Math.max(0, activeXY.x - TOOLTIP_W / 2)),
                      backgroundColor: c.surface,
                      borderColor: c.border,
                    },
                  ]}>
                  <Text style={[styles.tooltipDate, { color: c.text2 }]} maxFontSizeMultiplier={1.2}>
                    {formatDateLabel(activePoint.date, { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.tooltipValue, { color: c.text }]} maxFontSizeMultiplier={1.2}>
                    {chartValueLabel(activePoint.value, unitLabel)}
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
    paddingVertical: 4,
    alignItems: 'center',
    shadowColor: '#221F1B',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tooltipDate: { fontSize: 11, lineHeight: 14 },
  tooltipValue: { fontSize: 14, lineHeight: 18, fontWeight: '600', ...tabular },
});
