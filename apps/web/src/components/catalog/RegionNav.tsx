import { Link } from "@tanstack/react-router";
import { muscleLabel } from "@/lib/muscle-vocab";
import {
  REGIONS,
  REGION_MUSCLES,
  muscleAnchor,
  type Region,
} from "@/lib/muscle-regions";

/** Region navigation for the hub.
 *
 *  Replaces the old six-tile grid. Two things changed and both are the point:
 *
 *  1. Every muscle name is now its own link to the anchored section
 *     (/exercises/back#lats), not inert grey text. Six links become
 *     twenty-three, and the words people actually search are the anchors.
 *  2. It renders once and adapts: a stacked card list on mobile, a dense
 *     persistent rail in the hub's left column on desktop. No duplicated DOM,
 *     so no duplicated links for a crawler to reconcile.
 */
export function RegionNav({ counts }: { counts: Record<Region, number> }) {
  return (
    <nav aria-label="Browse by muscle group">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
        Browse by muscle group
      </p>
      <ul className="mt-3 grid gap-3 p-0 sm:grid-cols-2 lg:grid-cols-1 lg:gap-0 lg:divide-y lg:divide-border">
        {REGIONS.map((region) => (
          <li
            key={region}
            className="rounded-xl border border-border p-4 lg:rounded-none lg:border-0 lg:px-0 lg:py-3.5"
          >
            <Link
              to="/exercises/$slug"
              params={{ slug: region }}
              className="flex items-baseline justify-between gap-2 hover:underline"
            >
              <span className="text-[18px] font-semibold lg:text-base">
                {region.charAt(0).toUpperCase() + region.slice(1)}
              </span>
              <span className="font-mono text-[15px] text-muted-foreground">{counts[region]}</span>
            </Link>
            {/* Chest's only muscle is "chest" — a lone chip repeating the
                heading above it is noise, so single-muscle regions show none. */}
            <ul
              className={
                REGION_MUSCLES[region].length > 1
                  ? "mt-2 flex flex-wrap gap-x-2 gap-y-1.5 p-0"
                  : "hidden"
              }
            >
              {REGION_MUSCLES[region].map((m) => (
                <li key={m}>
                  <Link
                    to="/exercises/$slug"
                    params={{ slug: region }}
                    hash={muscleAnchor(m)}
                    className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-[15px] font-medium text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                  >
                    {muscleLabel(m)}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
