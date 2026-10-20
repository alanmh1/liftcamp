import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { RoutineArtBand } from "@/components/RoutineArtBand";
import type { PublicRoutineSummary } from "@/lib/public-catalog.functions";
import { HERO_TINT_SLOT, ROUTINE_TINTS } from "@/lib/routine-tints";
import { LevelPill, routineCounts } from "./RoutineMeta";
import { MusclePills } from "./MusclePills";

/** The best first routine as a large card above the grid. The filters do
 *  not touch it. Its art is the largest image above the fold, so it loads
 *  with the page at high priority. */
export function FeaturedRoutine({ routine }: { routine: PublicRoutineSummary }) {
  return (
    <section aria-labelledby="featured-routine" className="mx-auto max-w-[1080px] px-5 pt-10">
      <article className="group relative grid overflow-hidden rounded-lg border border-border bg-background shadow-sm shadow-foreground/5 transition-[box-shadow,border-color] hover:border-primary/40 hover:shadow-lg hover:shadow-foreground/10 md:grid-cols-[1.15fr_1fr]">
        <RoutineArtBand
          artKey={routine.art}
          tint={ROUTINE_TINTS[HERO_TINT_SLOT]}
          className="h-[240px] sm:h-[300px] md:h-full md:min-h-[400px]"
          loading="eager"
          priority
        />
        <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
          <p>
            <span className="rounded-full bg-primary px-3 py-1 text-[13px] font-semibold text-primary-foreground">
              Best first routine
            </span>
          </p>
          <h2
            id="featured-routine"
            className="mt-5 text-[34px] font-bold leading-[1.1] tracking-[-0.02em] text-foreground lg:text-[44px]"
          >
            {/* The whole card is the link; the stretched ::after covers it. */}
            <Link
              to="/routines/$slug"
              params={{ slug: routine.programSlug }}
              className="after:absolute after:inset-0 focus-visible:outline-none"
            >
              {routine.program}
            </Link>
          </h2>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-muted-foreground">
            <LevelPill level={routine.level} />
            <span>{routineCounts(routine)}</span>
          </p>
          {routine.blurb && (
            <p className="mt-4 max-w-md text-base leading-relaxed text-foreground/75">{routine.blurb}</p>
          )}
          <MusclePills muscles={routine.muscles} className="mt-4" />
          <div className="mt-7">
            <span className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-[15px] font-semibold text-primary-foreground shadow-sm transition-colors group-hover:bg-primary/90 group-has-[a:focus-visible]:ring-2 group-has-[a:focus-visible]:ring-ring group-has-[a:focus-visible]:ring-offset-2">
              View routine
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </div>
        </div>
      </article>
    </section>
  );
}
