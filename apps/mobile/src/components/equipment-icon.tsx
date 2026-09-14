import { equipmentIconKind, type EquipmentIconKind } from '@liftcamp/shared';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * The web's equipment icon set, redrawn for react-native-svg.
 *
 * Which glyph an equipment value gets is decided in @liftcamp/shared, so the
 * picker on web and the info sheet here always agree. The geometry is the
 * web's too: the seven Lucide icons it uses (24x24, stroke 2, round caps and
 * joins) and the two hand-drawn glyphs Lucide lacks, Barbell and EZBar, which
 * share plates and differ only in the bar. Copying the paths rather than
 * adding lucide-react-native keeps native code out of the build.
 */
export function EquipmentIcon({
  equipment,
  size = 18,
  color,
}: {
  equipment: string | null | undefined;
  size?: number;
  color: string;
}) {
  const kind = equipmentIconKind(equipment);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round">
      {GLYPHS[kind]}
    </Svg>
  );
}

// Open plates, so they keep interior white space at small sizes the way the
// Lucide Dumbbell heads do; a filled plate turns into a blob at 16px.
const plates = (
  <>
    <Rect x={1.5} y={6} width={4.5} height={12} rx={2} />
    <Rect x={18} y={6} width={4.5} height={12} rx={2} />
  </>
);

const GLYPHS: Record<EquipmentIconKind, React.ReactNode> = {
  barbell: (
    <>
      <Path d="M6 12h12" />
      {plates}
    </>
  ),
  ezbar: (
    <>
      <Path d="M6 12l3-2.2 3 4.4 3-4.4 3 2.2" />
      {plates}
    </>
  ),
  // Lucide "dumbbell"
  dumbbell: (
    <>
      <Path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z" />
      <Path d="m2.5 21.5 1.4-1.4" />
      <Path d="m20.1 3.9 1.4-1.4" />
      <Path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z" />
      <Path d="m9.6 14.4 4.8-4.8" />
    </>
  ),
  // Lucide "weight"
  kettlebell: (
    <>
      <Circle cx={12} cy={5} r={3} />
      <Path d="M6.5 8a2 2 0 0 0-1.905 1.46L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.925-2.54L19.4 9.5A2 2 0 0 0 17.48 8Z" />
    </>
  ),
  // Lucide "cable"
  cable: (
    <>
      <Path d="M17 19a1 1 0 0 1-1-1v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a1 1 0 0 1-1 1z" />
      <Path d="M17 21v-2" />
      <Path d="M19 14V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V10" />
      <Path d="M21 21v-2" />
      <Path d="M3 5V3" />
      <Path d="M4 10a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2z" />
      <Path d="M7 5V3" />
    </>
  ),
  // Lucide "cog", used for both machines and the Smith machine on web.
  machine: cog(),
  smith: cog(),
  // Lucide "user"
  body: (
    <>
      <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <Circle cx={12} cy={7} r={4} />
    </>
  ),
  // Lucide "circle-dot"
  band: (
    <>
      <Circle cx={12} cy={12} r={10} />
      <Circle cx={12} cy={12} r={1} />
    </>
  ),
  // Lucide "circle"
  other: <Circle cx={12} cy={12} r={10} />,
};

function cog() {
  return (
    <>
      <Path d="M11 10.27 7 3.34" />
      <Path d="m11 13.73-4 6.93" />
      <Path d="M12 22v-2" />
      <Path d="M12 2v2" />
      <Path d="M14 12h8" />
      <Path d="m17 20.66-1-1.73" />
      <Path d="m17 3.34-1 1.73" />
      <Path d="M2 12h2" />
      <Path d="m20.66 17-1.73-1" />
      <Path d="m20.66 7-1.73 1" />
      <Path d="m3.34 17 1.73-1" />
      <Path d="m3.34 7 1.73 1" />
      <Circle cx={12} cy={12} r={2} />
      <Circle cx={12} cy={12} r={8} />
    </>
  );
}
