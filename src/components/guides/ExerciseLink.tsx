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

export function ExerciseLink({ slug, children }: { slug: AuthoredSlug; children: string }) {
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
