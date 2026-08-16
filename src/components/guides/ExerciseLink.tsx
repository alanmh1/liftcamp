import { Link } from "@tanstack/react-router";

/** Inline link from guide prose to an exercise page.
 *
 *  Only ever point this at an exercise with an authored beginner block. The
 *  other 867 detail pages are noindex,follow and carry nothing but the
 *  free-exercise-db description, so sending a reader there from a guide is a
 *  dead end. The list below is checked against the catalog by hand; adding a
 *  slug that isn't authored is the mistake this comment exists to prevent. */
export const AUTHORED_SLUGS = [
  "barbell-squat",
  "goblet-squat",
  "leg-press",
  "romanian-deadlift",
  "barbell-deadlift",
  "barbell-bench-press",
  "dumbbell-bench-press",
  "pullups",
  "wide-grip-lat-pulldown",
  "one-arm-dumbbell-row",
  "seated-cable-rows",
  "barbell-shoulder-press",
  "side-lateral-raise",
  "barbell-curl",
  "triceps-pushdown",
  "plank",
] as const;

export type AuthoredSlug = (typeof AUTHORED_SLUGS)[number];

/** Catalog pages a guide may link to that do NOT have a beginner block yet.
 *
 *  These are noindex,follow, which is a search instruction, not a quality one:
 *  the page still carries both position photos, the equipment, and the full
 *  instructions, so it is a perfectly good destination for a reader. It just
 *  will not rank, and linking to it does not help it rank.
 *
 *  Prefer an AUTHORED_SLUGS target when both would work. Every slug here was
 *  checked against the catalog for images and instruction text, so none of them
 *  lands on an empty page. */
export const LINKABLE_SLUGS = [
  "hack-squat",
  "dumbbell-squat",
  "bodyweight-squat",
  "machine-bench-press",
  "smith-machine-bench-press",
  "trap-bar-deadlift",
  "leverage-deadlift",
  "stiff-legged-dumbbell-deadlift",
  "stiff-legged-barbell-deadlift",
  "bent-over-barbell-row",
  "bent-over-two-dumbbell-row",
  "leverage-high-row",
  "close-grip-front-lat-pulldown",
  "one-arm-lat-pulldown",
  "chin-up",
  "dumbbell-shoulder-press",
  "leverage-shoulder-press",
  "seated-cable-shoulder-press",
  "bench-dips",
  "dip-machine",
  "ez-bar-curl",
  "dumbbell-bicep-curl",
  "machine-bicep-curl",
  "triceps-pushdown-rope-attachment",
  "cable-seated-lateral-raise",
  "one-arm-incline-lateral-raise",
  "cable-crunch",
  "ab-crunch-machine",
  "flat-bench-lying-leg-raise",
] as const;

export type LinkableSlug = (typeof LINKABLE_SLUGS)[number];
export type GuideLinkSlug = AuthoredSlug | LinkableSlug;

export function ExerciseLink({ slug, children }: { slug: GuideLinkSlug; children: string }) {
  return (
    <Link
      to="/exercises/$slug"
      params={{ slug }}
      className="font-medium text-primary underline underline-offset-2"
    >
      {children}
    </Link>
  );
}
