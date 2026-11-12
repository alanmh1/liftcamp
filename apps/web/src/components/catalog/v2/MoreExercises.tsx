import { Link } from "@tanstack/react-router";
import { ExerciseCard, type CardExercise } from "./ExerciseCard";

/** A card in the "More X exercises" row: the fields the library card reads. */
export type RelatedExercise = CardExercise;

/** `slug` is the page the "See all" link goes to: the sub-muscle page when the
 *  exercise's primary muscle has one, else the region hub. `h1` is that page's
 *  H1 ("Lat Exercises"), lowercased into the heading and the link. */
export function MoreExercises({
  items,
  slug,
  h1,
  fallbackMuscle,
}: {
  items: RelatedExercise[];
  slug: string;
  h1: string;
  /** Chip label for a card whose row has no canonical muscle. */
  fallbackMuscle: string;
}) {
  if (items.length === 0) return null;
  const noun = h1.toLowerCase();

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
            More {noun}
          </h2>
          <Link
            to="/exercises/$slug"
            params={{ slug }}
            className="font-label text-label text-primary hover:underline"
          >
            See all {noun}
          </Link>
        </div>

        {/* The grid stretches each li to the tallest card in its row and the
            card fills it (h-full), so art and diagram cards mixed in one row
            are the same height, as in the library. */}
        <ul className="mt-ds-lg grid gap-ds-md p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {items.map((exercise) => (
            <li key={exercise.slug}>
              <ExerciseCard exercise={exercise} fallbackMuscle={fallbackMuscle} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
