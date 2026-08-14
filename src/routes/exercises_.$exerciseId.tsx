import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { canonMuscleList, muscleLabel } from "@/lib/muscle-vocab";
import { formatEquipmentLabel } from "@/lib/exercise-visuals";
import { getPublicExerciseById } from "@/lib/public-catalog.functions";

// Phase 2 loader proof. Public route, SSR on, no auth gate and no session-gated
// query: the loader awaits a public server fn so the exercise name, muscle
// chips and instruction steps are in the server-rendered HTML before hydration.
//
// The trailing-underscore filename (`exercises_.$exerciseId`) opts this route
// out of nesting under `/exercises`, which has no <Outlet />.
// Slugs replace the id segment in Phase 3.
export const Route = createFileRoute("/exercises_/$exerciseId")({
  loader: async ({ params }) => {
    const exercise = await getPublicExerciseById({ data: { id: params.exerciseId } });
    if (!exercise) throw notFound();
    return { exercise };
  },
  head: ({ loaderData }) => {
    const ex = loaderData?.exercise;
    if (!ex) return {};
    const title = `${ex.name} — How to, Muscles Worked | LiftCamp`;
    const description = `How to do the ${ex.name}: muscles worked, equipment needed and step-by-step instructions.`;
    const url = `https://liftcamp.app/exercises/${ex.id}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-[660px] px-5 py-16" role="alert">
      <p className="text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-[660px] px-5 py-16">
      <p className="text-sm text-muted-foreground">That exercise doesn’t exist.</p>
    </div>
  ),
  component: ExerciseDetailPage,
});

function ExerciseDetailPage() {
  const { exercise: ex } = Route.useLoaderData();

  const primary = canonMuscleList(ex.all_primary_muscles || ex.primary_muscle).map(muscleLabel);
  const secondary = canonMuscleList(ex.secondary_muscles).map(muscleLabel);
  const steps = (ex.description ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="min-h-dvh bg-background">
      <article className="mx-auto max-w-[660px] px-5 py-10">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link to="/exercises" className="underline-offset-4 hover:underline">
            Exercises
          </Link>
          <span aria-hidden> / </span>
          <span>{ex.name}</span>
        </nav>

        <h1 className="mt-2 text-3xl font-bold tracking-tight">{ex.name}</h1>

        {(primary.length > 0 || secondary.length > 0) && (
          <ul className="mt-4 flex flex-wrap gap-2 p-0">
            {primary.map((m) => (
              <li
                key={`p-${m}`}
                className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground"
              >
                {m}
              </li>
            ))}
            {secondary.map((m) => (
              <li
                key={`s-${m}`}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
              >
                {m}
              </li>
            ))}
          </ul>
        )}

        {ex.equipment && (
          <p className="mt-4 text-sm text-muted-foreground">
            Equipment: {formatEquipmentLabel(ex.equipment)}
          </p>
        )}

        {steps.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold tracking-tight">How to do it</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
              {steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </section>
        )}
      </article>
    </div>
  );
}
