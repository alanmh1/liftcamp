import { Link } from "@tanstack/react-router";
import { RoutineCardLinks } from "@/components/routines/RoutineCardLinks";
import { GuideCardLinks } from "@/components/guides/GuideCardLinks";
import type { PublicRoutineSummary } from "@/lib/public-catalog.functions";
import type { GuideMeta } from "@/content/guides/types";

/** Routine pages linked from the homepage, in display order. Slugs checked
 *  against templates.program_slug on 1 Nov 2026; one that stops existing is
 *  dropped by the loader rather than rendered as a dead card. */
export const FEATURED_ROUTINE_SLUGS = [
  "full-body-3-day",
  "push-pull-legs",
  "upper-lower-split",
  "torso-limbs",
  "arnold-split",
] as const;

export const FEATURED_GUIDE_SLUGS = [
  "picking-your-starting-weight",
  "gym-etiquette-for-beginners",
  "leg-press-setup",
] as const;

/** Server-rendered links from the homepage to the routine and guide pages a
 *  beginner should see first. The Routines band above shows one routine at a
 *  time behind buttons, so its other routines are not links in the HTML. */
export function FeaturedLinks({
  routines,
  guides,
}: {
  routines: (PublicRoutineSummary & { tint: string })[];
  guides: Pick<GuideMeta, "slug" | "title" | "dek">[];
}) {
  if (routines.length === 0 && guides.length === 0) return null;
  return (
    <section
      id="start-here"
      data-reveal-section
      aria-labelledby="start-here-heading"
      className="mx-auto max-w-7xl px-ds-lg py-ds-3xl"
    >
      <p
        data-reveal="text"
        className="font-label text-label uppercase tracking-widest text-primary"
      >
        Start here
      </p>
      <h2
        id="start-here-heading"
        data-reveal="text"
        className="mt-ds-sm font-heading text-5xl font-extrabold leading-tight tracking-tight text-foreground"
      >
        Popular routines and guides
      </h2>

      {routines.length > 0 && (
        <div data-reveal="item" className="mt-ds-xl [--i:0]">
          <div className="flex flex-wrap items-end justify-between gap-ds-md">
            <h3 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">
              Routines
            </h3>
            <Link to="/routines" className="font-label text-label text-primary hover:underline">
              See all routines
            </Link>
          </div>
          <RoutineCardLinks routines={routines} />
        </div>
      )}

      {guides.length > 0 && (
        <div data-reveal="item" className="mt-ds-2xl [--i:1]">
          <div className="flex flex-wrap items-end justify-between gap-ds-md">
            <h3 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">
              Guides
            </h3>
            <Link to="/guides" className="font-label text-label text-primary hover:underline">
              See all guides
            </Link>
          </div>
          <GuideCardLinks guides={guides} />
        </div>
      )}
    </section>
  );
}
