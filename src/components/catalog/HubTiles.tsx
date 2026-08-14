import { Link } from "@tanstack/react-router";
import { muscleLabel } from "@/lib/muscle-vocab";
import { REGIONS, REGION_MUSCLES, type Region } from "@/lib/muscle-regions";

/** Hub per 4b: six region tiles, the muscles named as visible text on each tile
 *  rather than hidden behind the region word — that is where "lats", "traps"
 *  and the rest earn their keyword presence. */
export function HubTiles({
  counts,
  total,
}: {
  counts: Record<Region, number>;
  total: number;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        {total} exercises, photographed and explained.
      </p>
      <ul className="mt-5 grid gap-3 p-0 sm:grid-cols-2">
        {REGIONS.map((region) => (
          <li key={region}>
            <Link
              to="/exercises/$slug"
              params={{ slug: region }}
              className="block rounded-xl border border-border p-4 transition-colors hover:border-primary"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-base font-semibold">
                  {region.charAt(0).toUpperCase() + region.slice(1)}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{counts[region]}</span>
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {REGION_MUSCLES[region].map((m) => muscleLabel(m)).join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
