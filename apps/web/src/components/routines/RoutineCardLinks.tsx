import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { RoutineArtBand } from "@/components/RoutineArtBand";
import type { PublicRoutineSummary } from "@/lib/public-catalog.functions";

/** A grid of routine cards, each its illustration on the routine's pastel
 *  over the name, days and exercise count. "Other routines" on a routine page
 *  and "Routines that use this exercise" on an exercise page both render it.
 *  Every card is a plain link, so crawlers follow it without JavaScript. */
export function RoutineCardLinks({
  routines,
}: {
  routines: (PublicRoutineSummary & { tint: string })[];
}) {
  return (
    <ul className="mt-6 grid grid-cols-1 gap-4 p-0 sm:grid-cols-3">
      {routines.map((o) => (
        <li key={o.programSlug} className="flex">
          <Link
            to="/routines/$slug"
            params={{ slug: o.programSlug }}
            className="group flex w-full flex-col overflow-hidden rounded-lg border border-border bg-background shadow-sm shadow-foreground/5 transition-[box-shadow,border-color] hover:border-primary/40 hover:shadow-lg hover:shadow-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {/* Each routine on its own pastel, the one its index card shows. */}
            <RoutineArtBand artKey={o.art} tint={o.tint} className="h-32" />
            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-lg font-bold leading-snug text-foreground">{o.program}</p>
                <ArrowUpRight
                  aria-hidden
                  className="mt-1 h-4 w-4 shrink-0 text-foreground/50 group-hover:text-primary"
                />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {o.daysPerWeek} day{o.daysPerWeek === 1 ? "" : "s"} · {o.exerciseCount} exercises
              </p>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-primary">
                View routine
                <ArrowRight
                  aria-hidden
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
