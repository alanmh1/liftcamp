import { plateColor, plateSize, type PlateColor, type PlateSize, type WeightUnit } from '@liftcamp/shared';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { useColors } from '@/theme/theme-provider';

/**
 * Plates follow the competition colours (`plateColor` in shared) in Chalk
 * tones. The yellow plate is a muted ochre, since flat in-app gold is for
 * PRs only. The plate sheet's circles use the same tones.
 */
export const PLATE_TONES: Record<PlateColor, { fill: string; text: string; border?: string }> = {
  blue: { fill: '#1B5FA8', text: '#FFFFFF' },
  yellow: { fill: '#C49A2C', text: '#221F1B' },
  green: { fill: '#2E8A57', text: '#FFFFFF' },
  white: { fill: '#FDFCFB', text: '#221F1B', border: '#DCD6CD' },
  red: { fill: '#B8402F', text: '#FFFFFF' },
  small: { fill: '#5A554C', text: '#FFFFFF' },
};

// The drawing's own units. The figure scales to the width it is given.
const VB_W = 342;
const VB_H = 120;
const CY = VB_H / 2;
const MID = VB_W / 2;

/** Half the grip, the bar between the collars. */
const GRIP_HALF = 38;
const GRIP_H = 6;
const COLLAR_W = 8;
const COLLAR_H = 26;
const SLEEVE_H = 14;
/** Where the sleeve stops short of the edge. */
const EDGE = 2;
const GAP = 2;

/** Heights by weight class, not in proportion to the weight. */
const PLATE_H: Record<PlateSize, number> = { big: 104, medium: 72, small: 44 };
const PLATE_W: Record<PlateSize, number> = { big: 18, medium: 16, small: 8 };

/** The collar's outer edge on the left; the right side mirrors it. */
const COLLAR_OUT = MID - GRIP_HALF - COLLAR_W;
/** Room on one sleeve for plates and their gaps. */
const SLEEVE_ROOM = COLLAR_OUT - GAP - EDGE;

/**
 * Pro: a side view of the loaded bar. A grey bar through the middle, a
 * collar either side, thicker sleeves outside them, and one rect per plate
 * standing on each sleeve, loaded from the collar outward and mirrored. No
 * text: the plate sheet prints the plates under it and speaks them for
 * the whole group. With no plates it draws the bare bar.
 *
 * A load too wide for the sleeve (more plates than any real sleeve holds)
 * narrows every plate and gap by the same factor, so it still fits.
 */
export function BarbellFigure({ perSide, unit }: { perSide: readonly number[]; unit: WeightUnit }) {
  const c = useColors();
  const plates = perSide.map((p) => ({ size: plateSize(p, unit), tone: PLATE_TONES[plateColor(p, unit)] }));
  const stack = plates.reduce((sum, p) => sum + PLATE_W[p.size], 0) + GAP * Math.max(plates.length - 1, 0);
  const scale = stack > SLEEVE_ROOM ? SLEEVE_ROOM / stack : 1;

  // Left side, inner to outer: each plate's left x.
  const left: number[] = [];
  let cursor = COLLAR_OUT - GAP;
  for (const p of plates) {
    const w = PLATE_W[p.size] * scale;
    left.push(cursor - w);
    cursor -= w + GAP * scale;
  }

  return (
    <View style={styles.frame}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`}>
        {/* Sleeves, then the grip, then the collars over their ends. */}
        <Rect x={EDGE} y={CY - SLEEVE_H / 2} width={COLLAR_OUT - EDGE} height={SLEEVE_H} rx={3} fill={c.text3} />
        <Rect
          x={VB_W - COLLAR_OUT}
          y={CY - SLEEVE_H / 2}
          width={COLLAR_OUT - EDGE}
          height={SLEEVE_H}
          rx={3}
          fill={c.text3}
        />
        <Rect x={MID - GRIP_HALF} y={CY - GRIP_H / 2} width={GRIP_HALF * 2} height={GRIP_H} rx={2} fill={c.text3} />
        <Rect x={COLLAR_OUT} y={CY - COLLAR_H / 2} width={COLLAR_W} height={COLLAR_H} rx={2} fill={c.text2} />
        <Rect
          x={VB_W - COLLAR_OUT - COLLAR_W}
          y={CY - COLLAR_H / 2}
          width={COLLAR_W}
          height={COLLAR_H}
          rx={2}
          fill={c.text2}
        />

        {plates.map((p, i) => {
          const w = PLATE_W[p.size] * scale;
          const h = PLATE_H[p.size];
          const stroke = p.tone.border ? { stroke: p.tone.border, strokeWidth: 1 } : {};
          return [
            <Rect key={`l${i}`} x={left[i]} y={CY - h / 2} width={w} height={h} rx={4} fill={p.tone.fill} {...stroke} />,
            <Rect
              key={`r${i}`}
              x={VB_W - left[i] - w}
              y={CY - h / 2}
              width={w}
              height={h}
              rx={4}
              fill={p.tone.fill}
              {...stroke}
            />,
          ];
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'stretch', aspectRatio: VB_W / VB_H },
});
