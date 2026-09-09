import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { palettes } from '@/theme/tokens';

/**
 * The PR mark: a rosette with two tails, 22x26, gold only.
 *
 * Gold is reserved for this. It appears nowhere else in the app, so a lifter
 * scanning the screen can find a personal record without reading anything.
 */
export function PrRibbon({ size = 22 }: { size?: number }) {
  const height = (size / 22) * 26;
  const gold = palettes.light.gold;
  const deep = palettes.light.goldDeep;

  return (
    <Svg width={size} height={height} viewBox="0 0 22 26" accessibilityLabel="Personal record">
      {/* Tails, drawn first so the medal sits on top of them. */}
      <Path d="M6.5 15.5 L3 25 L7.4 22.6 L9.6 25.6 L12 17.5 Z" fill={deep} />
      <Path d="M15.5 15.5 L19 25 L14.6 22.6 L12.4 25.6 L10 17.5 Z" fill={deep} />
      <Circle cx="11" cy="10" r="9" fill={gold} stroke={deep} strokeWidth="1" />
      <SvgText
        x="11"
        y="13.5"
        textAnchor="middle"
        fontSize="8"
        fontWeight="bold"
        fill="#221F1B">
        PR
      </SvgText>
    </Svg>
  );
}
