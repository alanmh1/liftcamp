import { ExerciseCard, type CardExercise } from "./ExerciseCard";

export type FeaturedItem = CardExercise;

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
          {items.map((exercise) => (
            <li key={exercise.slug}>
              <ExerciseCard exercise={exercise} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
