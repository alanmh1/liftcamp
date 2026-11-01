import { Link } from "@tanstack/react-router";
import { RoutineCardLinks } from "@/components/routines/RoutineCardLinks";
import { GuideCardLinks } from "@/components/guides/GuideCardLinks";
import type { PublicRoutineSummary } from "@/lib/public-catalog.functions";
import type { GuideMeta } from "@/content/guides/types";

/** The routines that program an exercise and the guides that cover it, below
 *  the steps on its detail page. Each half hides when it has nothing. */
export function ExerciseRoutinesGuides({
  routines,
  guides,
}: {
  routines: (PublicRoutineSummary & { tint: string })[];
  guides: GuideMeta[];
}) {
  if (routines.length === 0 && guides.length === 0) return null;
  return (
    <div className="mx-auto max-w-7xl space-y-ds-2xl px-ds-lg pb-ds-2xl">
      {routines.length > 0 && (
        <section aria-labelledby="routines-heading">
          <div className="flex flex-wrap items-end justify-between gap-ds-md">
            <h2
              id="routines-heading"
              className="font-heading text-3xl font-extrabold tracking-tight text-foreground md:text-4xl"
            >
              Routines that use this exercise
            </h2>
            <Link to="/routines" className="font-label text-label text-primary hover:underline">
              See all routines
            </Link>
          </div>
          <RoutineCardLinks routines={routines} />
        </section>
      )}

      {guides.length > 0 && (
        <section aria-labelledby="guides-heading">
          <h2
            id="guides-heading"
            className="font-heading text-3xl font-extrabold tracking-tight text-foreground md:text-4xl"
          >
            Guides
          </h2>
          <GuideCardLinks guides={guides} />
        </section>
      )}
    </div>
  );
}
