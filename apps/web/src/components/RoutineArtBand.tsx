import type { RoutineImageKey } from "@liftcamp/shared";
import { ROUTINE_ART_SIZE, routineArtAlt, routineArtSrc } from "@/lib/routine-art";

/**
 * A routine's equipment illustration on its tinted band, the same treatment
 * mobile's routine card uses: the image centred and contained at 85% of the
 * band's height. The band fills whatever width it is given; the caller sets
 * the height (or an aspect ratio) and the corner radius. The band is
 * --art-tint unless the caller passes a tint class (the routines index
 * gives each card a pastel from lib/routine-tints.ts).
 */
export function RoutineArtBand({
  artKey,
  className = "",
  loading = "lazy",
  priority = false,
  tint = "bg-art-tint",
}: {
  artKey: RoutineImageKey;
  /** Height or aspect ratio, radius, margins. */
  className?: string;
  loading?: "eager" | "lazy";
  /** Only the largest image above the fold: the detail hero, the index's featured routine. */
  priority?: boolean;
  /** Background class for the band. */
  tint?: string;
}) {
  return (
    <div
      className={`flex w-full shrink-0 items-center justify-center overflow-hidden ${tint} ${className}`}
    >
      <img
        src={routineArtSrc(artKey)}
        alt={routineArtAlt(artKey)}
        width={ROUTINE_ART_SIZE}
        height={ROUTINE_ART_SIZE}
        loading={loading}
        decoding="async"
        fetchPriority={priority ? "high" : undefined}
        className="h-[85%] w-auto object-contain"
      />
    </div>
  );
}
