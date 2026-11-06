import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme/theme-provider';

/** The down chevron that closes a full-screen workout view. */
export function CollapseChevron() {
  const { colors: c } = useTheme();
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M6 9l6 6 6-6"
        stroke={c.text2}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
