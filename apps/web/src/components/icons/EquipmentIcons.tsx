import { forwardRef } from "react";
import type { SVGProps } from "react";

/**
 * Equipment icons Lucide does not ship.
 *
 * Lucide has a Dumbbell (drawn diagonally) but no barbell and no EZ bar, so
 * `equipmentIcon` previously returned Dumbbell for both "dumbbell" and
 * "barbell" -- two different pieces of kit with one glyph -- and fell through
 * to a bare Circle for "e-z curl bar", making it identical to "Other".
 *
 * These match Lucide's geometry exactly (24x24 viewBox, stroke-width 2, round
 * caps and joins, currentColor) so they sit correctly beside real Lucide icons
 * and inherit sizing from the same `h-4 w-4` classes.
 *
 * The plates are OPEN shapes, not solid strokes, so they carry interior white
 * space the way Lucide's Dumbbell heads do. That matters at 16px: a filled or
 * hairline-thin plate turns into an indistinct blob.
 *
 * An earlier attempt literally rotated the Lucide Dumbbell to horizontal. It
 * does not survive: rotated, the glyph is ~27 units wide against a 24 viewBox,
 * and scaling it to fit drops the head arc radius to ~1.16 against a 2px
 * stroke, which closes the openings completely. A single open plate per side
 * is both more barbell-like than the Dumbbell's stacked double head and leaves
 * room to keep the holes.
 *
 * Barbell and EZBar share identical plates and differ only in the middle
 * section -- straight versus the EZ bar's signature bend. That reads as a
 * family at display size while staying distinguishable at 16px, which is the
 * size used in the exercise list chips.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

const base = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export const Barbell = forwardRef<SVGSVGElement, IconProps>(function Barbell(
  { size = 24, ...props },
  ref,
) {
  return (
    <svg ref={ref} width={size} height={size} {...base} {...props}>
      <path d="M6 12h12" />
      <rect x="1.5" y="6" width="4.5" height="12" rx="2" />
      <rect x="18" y="6" width="4.5" height="12" rx="2" />
    </svg>
  );
});

export const EZBar = forwardRef<SVGSVGElement, IconProps>(function EZBar(
  { size = 24, ...props },
  ref,
) {
  return (
    <svg ref={ref} width={size} height={size} {...base} {...props}>
      <path d="M6 12l3-2.2 3 4.4 3-4.4 3 2.2" />
      <rect x="1.5" y="6" width="4.5" height="12" rx="2" />
      <rect x="18" y="6" width="4.5" height="12" rx="2" />
    </svg>
  );
});
