import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import { RoutineArtBand } from "@/components/RoutineArtBand";
import type { PublicRoutineSummary } from "@/lib/public-catalog.functions";
import { LevelPill, routineCounts } from "./RoutineMeta";
import { MusclePills } from "./MusclePills";

/** Cards in the first row on a wide screen fetch their art with the page; the rest wait. */
const EAGER_CARDS = 3;

export function RoutineGrid({
  routines,
  tints,
  subtitle,
  onClear,
}: {
  routines: PublicRoutineSummary[];
  /** Tint class per program slug, from routineTints over the unfiltered grid. */
  tints: Map<string, string>;
  subtitle: string | null;
  onClear: () => void;
}) {
  return (
    <section aria-labelledby="all-routines" className="mx-auto max-w-[1080px] px-5 pb-20 pt-14">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <h2 id="all-routines" className="text-[28px] font-bold tracking-[-0.02em] text-foreground">
          All routines
        </h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      {routines.length === 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted px-5 py-4">
          <p className="text-sm text-foreground/80">
            No routine matches all of those filters. Try removing one.
          </p>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-10 items-center rounded-full border border-border bg-background px-4 text-sm font-semibold text-primary hover:bg-accent"
          >
            Clear filters
          </button>
        </div>
      )}

      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {routines.map((r, i) => (
          <li key={r.programSlug} className="flex">
            <RoutineCard routine={r} tint={tints.get(r.programSlug)} eager={i < EAGER_CARDS} />
          </li>
        ))}
        {/* An action, not a routine: dashed and artwork-free so it reads
            as the odd one out at the end of the set. */}
        <li className="flex">
          <Link
            to="/routines/build"
            className="group flex min-h-[300px] w-full flex-col rounded-lg border-2 border-dashed border-primary/30 bg-tint-sky/50 p-6 transition-colors hover:border-primary/60 hover:bg-tint-sky focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/25 bg-background text-primary">
              <Plus className="h-6 w-6" aria-hidden />
            </span>
            <h3 className="mt-6 text-xl font-bold text-foreground">Build your own</h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground/75">
              None of these quite right? Pick your own exercises from the library and put them in
              whatever order you want.
            </p>
            <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold text-primary">
              Open the builder
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        </li>
      </ul>
    </section>
  );
}

/** One program. The whole card is the link. The band is the same equipment
 *  illustration the app's routine card shows, picked by the same walk, on
 *  the card's pastel. */
function RoutineCard({
  routine,
  tint,
  eager,
}: {
  routine: PublicRoutineSummary;
  tint: string | undefined;
  eager: boolean;
}) {
  return (
    <Link
      to="/routines/$slug"
      params={{ slug: routine.programSlug }}
      className="group flex w-full flex-col overflow-hidden rounded-lg border border-border bg-background shadow-sm shadow-foreground/5 transition-[box-shadow,border-color] hover:border-primary/40 hover:shadow-lg hover:shadow-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="relative">
        <RoutineArtBand
          artKey={routine.art}
          tint={tint}
          className="h-40"
          loading={eager ? "eager" : "lazy"}
        />
        <LevelPill level={routine.level} className="absolute left-3 top-3" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold leading-snug text-foreground">{routine.program}</h3>
          <ArrowUpRight
            className="mt-1 h-4 w-4 shrink-0 text-foreground/50 group-hover:text-primary"
            aria-hidden
          />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{routineCounts(routine)}</p>
        <MusclePills muscles={routine.muscles} className="mt-3" />
        <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-primary">
          View routine
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
