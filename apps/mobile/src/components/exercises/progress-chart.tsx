import { barAxis } from '@liftcamp/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { Text } from '@/components/text';
import { useColors } from '@/theme/theme-provider';
import { font, spacing, type } from '@/theme/tokens';

export type ChartPoint = { date: string; value: number; workoutId: string };
export type ChartKind = 'line' | 'bar';

const HEIGHT = 190;
const PAD = { top: 14, right: 14, bottom: 26 };
/** Space between the widest y-axis label and the plot. */
const LABEL_GAP = 8;
const LABEL_LINE = 14;

/** "Sep 9" for an axis, "September 9" for the readout. */
function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}
function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'long' });
}

/** A bar with its top corners rounded and its base square on the zero line. */
function barPath(left: number, top: number, w: number, bottom: number): string {
  const r = Math.min(3, w / 2, bottom - top);
  return (
    `M${left},${bottom}V${top + r}Q${left},${top} ${left + r},${top}` +
    `H${left + w - r}Q${left + w},${top} ${left + w},${top + r}V${bottom}Z`
  );
}

/**
 * One point per session, drawn with react-native-svg, either as a line or
 * as bars. Tapping a point or bar selects it; with nothing selected the
 * readout above the chart shows the latest. One point draws as a dot with
 * no line. The caller supplies the points already filtered to the range
 * and sorted by date, and the formatter for the unit.
 *
 * Lines get an axis fitted to the data, so a small gain is visible. Bars
 * encode magnitude by length, so their axis always starts at zero, with
 * round ticks so a label sits on its own gridline.
 */
export function ProgressChart({
  points,
  format,
  kind = 'line',
  axisFormat = format,
  dateLabel = longDate,
  reference,
}: {
  points: ChartPoint[];
  /** The value with its unit, for the readout and, unless `axisFormat` is given, the y axis. */
  format: (value: number) => string;
  kind?: ChartKind;
  axisFormat?: (value: number) => string;
  /** The readout's date line. "September 9" by default. */
  dateLabel?: (iso: string) => string;
  /** A dashed horizontal line at this value, such as a weekly target. Bars only. */
  reference?: number;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  // Width of the widest y-axis label, measured from the labels themselves,
  // so "4,000 lbs" gets the room it needs and "12" does not waste any.
  const [labelW, setLabelW] = useState(0);

  const shown = selected != null && selected < points.length ? selected : points.length - 1;
  const current = points[shown];

  const padLeft = labelW + LABEL_GAP;
  const innerW = Math.max(0, width - padLeft - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const values = points.map((p) => p.value);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  let ticks: number[] | undefined;
  if (kind === 'bar') {
    // Descending, so the last tick is the zero line, drawn solid.
    const axis = barAxis(Math.max(hi, reference ?? 0), values.every(Number.isInteger));
    lo = 0;
    hi = axis.top;
    ticks = [...axis.ticks].reverse();
  } else if (lo === hi) {
    // A flat line still needs a band to sit in.
    lo = lo * 0.9;
    hi = hi * 1.1 || 1;
  } else {
    const pad = (hi - lo) * 0.12;
    lo -= pad;
    hi += pad;
  }
  // Bars sit in equal slots across the width; line points run edge to edge.
  const slot = points.length > 0 ? innerW / points.length : innerW;
  const x = (i: number) =>
    kind === 'bar'
      ? padLeft + (i + 0.5) * slot
      : padLeft + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const barW = Math.max(2, Math.min(28, slot * 0.6));
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * innerH;

  ticks ??= lo === hi ? [lo] : [hi, (hi + lo) / 2, lo];
  const labels = ticks.map(axisFormat);
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {current ? (
        <View style={styles.readout}>
          <Text style={[styles.value, { color: c.text }]}>{format(current.value)}</Text>
          <Text style={[type.meta, { color: c.text2 }]}>{dateLabel(current.date)}</Text>
        </View>
      ) : null}

      {/* Invisible copies of the y-axis labels; an absolute view sizes to its widest child. */}
      <View style={styles.measure} pointerEvents="none" onLayout={(e) => setLabelW(Math.ceil(e.nativeEvent.layout.width))}>
        {labels.map((l, i) => (
          <Text key={i} style={styles.axisLabel} numberOfLines={1} maxFontSizeMultiplier={1}>
            {l}
          </Text>
        ))}
      </View>

      {width > 0 && labelW > 0 ? (
        <View>
          <Svg width={width} height={HEIGHT}>
            {ticks.map((t, i) => (
              <Line
                key={i}
                x1={padLeft}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke={c.border}
                strokeWidth={1}
                strokeDasharray={i === ticks.length - 1 ? undefined : '3 4'}
              />
            ))}
            {first ? (
              <SvgText x={padLeft} y={HEIGHT - 8} fontSize={11} fontFamily={font.medium} fill={c.text3} textAnchor="start">
                {shortDate(first.date)}
              </SvgText>
            ) : null}
            {last && points.length > 1 ? (
              <SvgText x={width - PAD.right} y={HEIGHT - 8} fontSize={11} fontFamily={font.medium} fill={c.text3} textAnchor="end">
                {shortDate(last.date)}
              </SvgText>
            ) : null}

            {kind === 'bar'
              ? points.map((p, i) => (
                  <Path
                    key={p.workoutId + i}
                    d={barPath(x(i) - barW / 2, y(p.value), barW, y(0))}
                    fill={c.accent}
                    fillOpacity={i === shown ? 1 : 0.4}
                  />
                ))
              : null}
            {kind === 'bar' && reference != null ? (
              <Line
                x1={padLeft}
                x2={width - PAD.right}
                y1={y(reference)}
                y2={y(reference)}
                stroke={c.text2}
                strokeWidth={1.5}
                strokeDasharray="6 4"
              />
            ) : null}
            {kind === 'line' && points.length > 1 ? (
              <Polyline
                points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
                fill="none"
                stroke={c.accent}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {kind === 'line'
              ? points.map((p, i) => (
                  <Circle
                    key={p.workoutId + i}
                    cx={x(i)}
                    cy={y(p.value)}
                    r={i === shown ? 6 : 4}
                    fill={i === shown ? c.accent : c.surface}
                    stroke={c.accent}
                    strokeWidth={2}
                  />
                ))
              : null}
            {/* Generous invisible hit areas, one per point, so a dot or bar is tappable without precision. */}
            {points.map((p, i) => {
              const half = kind === 'bar' || points.length === 1 ? slot / 2 : innerW / (points.length - 1) / 2;
              return (
                <Rect
                  key={`h${i}`}
                  x={x(i) - half}
                  y={PAD.top}
                  width={half * 2}
                  height={innerH}
                  fill="transparent"
                  onPress={() => setSelected(i)}
                />
              );
            })}
          </Svg>
          {/* Y-axis labels, right-aligned in the measured column. */}
          {ticks.map((t, i) => (
            <Text
              key={`l${i}`}
              numberOfLines={1}
              // The chart's height is fixed, so the labels stay at 11.
              maxFontSizeMultiplier={1}
              style={[styles.axisLabel, styles.axisLabelPlaced, { width: labelW, top: y(t) - LABEL_LINE / 2, color: c.text3 }]}>
              {labels[i]}
            </Text>
          ))}
        </View>
      ) : (
        <View style={{ height: HEIGHT }} />
      )}
      {selected != null ? (
        <Pressable onPress={() => setSelected(null)} hitSlop={8} style={styles.latest}>
          <Text style={[type.meta, { color: c.accentText }]}>Show latest</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  readout: { gap: 2, paddingHorizontal: spacing.xs },
  value: { fontSize: 28, fontWeight: '600', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  measure: { position: 'absolute', left: 0, top: 0, opacity: 0 },
  axisLabel: {
    fontSize: 11,
    lineHeight: LABEL_LINE,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  // Taps on the axis column reach the first point's hit area underneath.
  axisLabelPlaced: { position: 'absolute', left: 0, textAlign: 'right', pointerEvents: 'none' },
  latest: { alignSelf: 'flex-end', paddingHorizontal: spacing.xs },
});
