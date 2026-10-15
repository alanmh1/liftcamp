import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import type { Region } from "@/lib/muscle-regions";

export type BrowseRegion = {
  slug: Region;
  label: string;
  count: number;
  /** Empty for single-muscle regions: a lone chip repeating the heading is noise. */
  muscles: { label: string; anchor: string; count: number }[];
};

export type BrowseEquipment = { slug: string; label: string; count: number };

/**
 * One browse system for the hub. Every chip is a server-rendered link with a
 * count: the six region pages, each region's muscles (anchored sections on
 * the region page) and the eight equipment pages. On phones each group
 * collapses to a tappable heading; the links stay in the DOM when collapsed,
 * so crawlers still reach them. On desktop every group is open.
 */
export function BrowseSection({
  regions,
  equipment,
}: {
  regions: BrowseRegion[];
  equipment: BrowseEquipment[];
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <section
      id="browse"
      aria-labelledby="browse-heading"
      className="border-y border-border bg-muted/60 py-ds-2xl"
    >
      <div className="mx-auto max-w-7xl px-ds-lg">
        <p className="font-label text-label uppercase tracking-widest text-primary">Browse</p>
        <h2
          id="browse-heading"
          className="mt-ds-xs font-heading text-3xl font-extrabold tracking-tight text-foreground md:text-4xl"
        >
          Find exercises by muscle or equipment
        </h2>

        <h3 className="mt-ds-xl font-label text-label uppercase tracking-wider text-muted-foreground">
          By muscle
        </h3>
        <div className="mt-ds-sm grid gap-ds-sm md:grid-cols-2 md:gap-ds-md lg:grid-cols-3">
          {regions.map((region) => (
            <div key={region.slug} className="rounded-lg border border-border bg-background">
              <h4>
                <button
                  type="button"
                  aria-expanded={!!open[region.slug]}
                  aria-controls={`browse-${region.slug}`}
                  onClick={() => toggle(region.slug)}
                  className="group flex w-full items-center justify-between gap-ds-sm px-ds-md py-ds-md text-left md:pointer-events-none md:pb-ds-sm"
                >
                  <span className="font-heading text-xl font-bold text-foreground">
                    {region.label}
                  </span>
                  <span className="flex items-center gap-ds-sm">
                    <span className="font-caption text-caption tabular-nums text-muted-foreground">
                      {region.count}
                    </span>
                    <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-aria-expanded:rotate-180 md:hidden" />
                  </span>
                </button>
              </h4>
              <ul
                id={`browse-${region.slug}`}
                data-open={!!open[region.slug]}
                className="hidden flex-wrap gap-ds-xs px-ds-md pb-ds-md data-[open=true]:flex md:flex"
              >
                <li>
                  <Link
                    to="/exercises/$slug"
                    params={{ slug: region.slug }}
                    className="inline-flex items-center gap-ds-xs rounded-full bg-primary px-ds-sm py-ds-xs font-label text-sm text-primary-foreground hover:bg-primary/90"
                  >
                    All {region.label.toLowerCase()}
                    <span className="font-caption text-caption tabular-nums text-primary-foreground/75">
                      {region.count}
                    </span>
                  </Link>
                </li>
                {region.muscles.map((muscle) => (
                  <li key={muscle.anchor}>
                    <Link
                      to="/exercises/$slug"
                      params={{ slug: region.slug }}
                      hash={muscle.anchor}
                      className="inline-flex items-center gap-ds-xs rounded-full border border-border bg-background px-ds-sm py-ds-xs font-label text-sm text-foreground hover:border-primary hover:text-primary"
                    >
                      {muscle.label}
                      <span className="font-caption text-caption tabular-nums text-muted-foreground">
                        {muscle.count}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-ds-lg rounded-lg border border-border bg-background md:mt-ds-xl md:border-0 md:bg-transparent">
          <h3>
            <button
              type="button"
              aria-expanded={!!open.equipment}
              aria-controls="browse-equipment"
              onClick={() => toggle("equipment")}
              className="group flex w-full items-center justify-between px-ds-md py-ds-md text-left md:pointer-events-none md:px-0 md:py-0"
            >
              <span className="font-heading text-xl font-bold text-foreground md:font-label md:text-label md:font-semibold md:uppercase md:tracking-wider md:text-muted-foreground">
                By equipment
              </span>
              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-aria-expanded:rotate-180 md:hidden" />
            </button>
          </h3>
          <ul
            id="browse-equipment"
            data-open={!!open.equipment}
            className="hidden flex-wrap gap-ds-xs px-ds-md pb-ds-md data-[open=true]:flex md:mt-ds-sm md:flex md:gap-ds-sm md:px-0 md:pb-0"
          >
            {equipment.map((item) => (
              <li key={item.slug}>
                <Link
                  to="/exercises/$slug"
                  params={{ slug: item.slug }}
                  className="inline-flex items-center gap-ds-xs rounded-full border border-border bg-background px-ds-md py-ds-sm font-label text-label text-foreground hover:border-primary hover:text-primary"
                >
                  {item.label}
                  <span className="font-caption text-caption tabular-nums text-muted-foreground">
                    {item.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
