import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { formatEquipmentLabel, muscleLabel } from "@liftcamp/shared";
import type { CatalogRow } from "@/lib/public-catalog.functions";
import { rowMuscles } from "@/lib/catalog-grouping";
import { MuscleDiagram } from "./MuscleDiagram";
import { LevelChip } from "./LevelChip";

export type FeaturedItem = Pick<
  CatalogRow,
  | "slug"
  | "name"
  | "equipment"
  | "level"
  | "image_url"
  | "primary_muscle"
  | "all_primary_muscles"
  | "secondary_muscles"
>;

/** The authored strip: server-rendered, so every indexable detail page gets a
 *  link from the catalog root. Falls back to the common lifts when no notes
 *  exist yet (`kind="common"`). */
export function FeaturedExercises({
  items,
  kind,
  authoredTotal,
  filtered,
}: {
  items: FeaturedItem[];
  kind: "authored" | "common";
  authoredTotal: number;
  /** True while a search is narrowing the strip. */
  filtered: boolean;
}) {
  return (
    <section aria-labelledby="featured-heading" className="mx-auto max-w-7xl px-ds-lg pb-ds-2xl">
      <div className="flex flex-wrap items-end justify-between gap-ds-md">
        <div>
          <p className="font-label text-label uppercase tracking-widest text-primary">
            {kind === "authored" ? `${authoredTotal} explained in full` : "Start here"}
          </p>
          <h2
            id="featured-heading"
            className="mt-ds-xs font-heading text-3xl font-extrabold tracking-tight text-foreground md:text-4xl"
          >
            {kind === "authored" ? "Explained in full" : "Start here"}
          </h2>
        </div>
        <p className="max-w-md font-body text-body text-muted-foreground">
          {kind === "authored"
            ? "These have a hand-written beginner block: where to start, what the set should feel like, and what to do instead if the gym is busy."
            : "The lifts most routines are built from. If you are new, learning these twelve covers almost every session you will run."}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="mt-ds-lg rounded-lg border border-dashed border-border p-ds-lg font-body text-body text-muted-foreground">
          {filtered
            ? "None of these match that search. Try the full list below."
            : "Nothing here yet."}
        </p>
      ) : (
        <ul className="mt-ds-lg grid gap-ds-md p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((exercise) => {
            const target = rowMuscles(exercise)[0];
            return (
              <li key={exercise.slug}>
                <Link
                  to="/exercises/$slug"
                  params={{ slug: exercise.slug }}
                  className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="relative bg-[radial-gradient(circle_at_50%_40%,var(--background),var(--muted))] px-ds-xl pb-ds-sm pt-ds-xl">
                    <MuscleDiagram muscles={exercise} />
                    {target && (
                      <span className="absolute left-ds-sm top-ds-sm rounded-full bg-popover/90 px-ds-sm py-ds-xs font-caption text-caption text-muted-foreground shadow-sm">
                        {muscleLabel(target)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-ds-md">
                    <h3 className="flex items-start justify-between gap-ds-sm font-heading text-xl font-bold text-card-foreground group-hover:text-primary">
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
            );
          })}
        </ul>
      )}
    </section>
  );
}
