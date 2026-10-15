import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { formatEquipmentLabel } from "@liftcamp/shared";
import type { Region } from "@/lib/muscle-regions";
import { LevelChip } from "./LevelChip";

export type RelatedExercise = {
  slug: string;
  name: string;
  equipment: string | null;
  level: string | null;
  image_url: string | null;
  /** Display label of the first primary muscle, through muscleLabel(). */
  muscle: string | null;
};

export function MoreExercises({ items, region }: { items: RelatedExercise[]; region: Region }) {
  if (items.length === 0) return null;
  const label = region.charAt(0).toUpperCase() + region.slice(1);

  return (
    <section
      aria-labelledby="more-heading"
      className="border-t border-border bg-muted/60 py-ds-2xl"
    >
      <div className="mx-auto max-w-7xl px-ds-lg">
        <div className="flex flex-wrap items-end justify-between gap-ds-md">
          <h2
            id="more-heading"
            className="font-heading text-3xl font-extrabold tracking-tight text-foreground md:text-4xl"
          >
            More {region} exercises
          </h2>
          <Link
            to="/exercises/$slug"
            params={{ slug: region }}
            className="font-label text-label text-primary hover:underline"
          >
            See all {region} exercises
          </Link>
        </div>

        <ul className="mt-ds-lg grid gap-ds-md p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {items.map((exercise) => (
            <li key={exercise.slug}>
              <Link
                to="/exercises/$slug"
                params={{ slug: exercise.slug }}
                className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background shadow-sm transition-shadow hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="relative aspect-[3/2] bg-muted">
                  {exercise.image_url && (
                    <img
                      src={exercise.image_url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width={850}
                      height={567}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <span className="absolute left-ds-sm top-ds-sm rounded-full bg-popover/90 px-ds-sm py-ds-xs font-caption text-caption text-muted-foreground shadow-sm">
                    {exercise.muscle ?? label}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-ds-md">
                  <h3 className="flex items-start justify-between gap-ds-sm font-heading text-xl font-bold text-foreground group-hover:text-primary">
                    {exercise.name}
                    <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                  </h3>
                  <div className="mt-auto flex flex-wrap gap-ds-xs pt-ds-md">
                    {exercise.equipment && (
                      <span className="rounded-full bg-accent px-ds-sm py-ds-xs font-caption text-caption text-accent-foreground">
                        {formatEquipmentLabel(exercise.equipment)}
                      </span>
                    )}
                    <LevelChip level={exercise.level} />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
