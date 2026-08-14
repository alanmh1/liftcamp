import { Link } from "@tanstack/react-router";
import { muscleLabel } from "@/lib/muscle-vocab";
import { REGIONS, REGION_MUSCLES, type Region } from "@/lib/muscle-regions";

/** Hub per 4b: six region tiles, the muscles named as visible text on each tile
 *  rather than hidden behind the region word — that is where "lats", "traps"
 *  and the rest earn their keyword presence.
 *
 *  Tiles are equal-height grid items (content-start + h-full) so the grid reads
 *  as a symmetric six-up on desktop instead of a ragged two-column stack. */
export function HubTiles({
  counts,
  total,
}: {
  counts: Record<Region, number>;
  total: number;
}) {
  return (
    <div>
      <p className="text-[15px] text-muted-foreground lg:text-base">
        {total} exercises, photographed and explained.
      </p>
      <ul className="mt-5 grid auto-rows-fr gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
        {REGIONS.map((region) => (
          <li key={region} className="h-full">
            <Link
              to="/exercises/$slug"
              params={{ slug: region }}
              className="flex h-full flex-col rounded-xl border border-border p-4 transition-colors hover:border-primary hover:bg-muted/40 lg:p-5"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[17px] font-semibold lg:text-lg">
                  {region.charAt(0).toUpperCase() + region.slice(1)}
                </span>
                <span className="font-mono text-[13px] text-muted-foreground lg:text-sm">{counts[region]}</span>
              </span>
              <span className="mt-1.5 block text-[13px] leading-relaxed text-muted-foreground lg:text-sm">
                {REGION_MUSCLES[region].map((m) => muscleLabel(m)).join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
