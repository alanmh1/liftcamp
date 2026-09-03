import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { muscleColors } from "@/lib/exercise-visuals";
import {
  getPublicRoutineBySlug,
  getPublicRoutines,
  type PublicRoutineDetail,
  type PublicRoutineSummary,
} from "@/lib/public-catalog.functions";

const SITE = "https://liftcamp.app";

type DetailLoaderData = PublicRoutineDetail & { others: PublicRoutineSummary[] };

export const Route = createFileRoute("/routines_/$slug")({
  loader: async ({ params }): Promise<DetailLoaderData> => {
    const [data, all] = await Promise.all([
      getPublicRoutineBySlug({ data: { slug: params.slug } }),
      getPublicRoutines(),
    ]);
    if (!data) throw notFound();
    return {
      ...data,
      others: all.filter((r) => r.programSlug !== params.slug).slice(0, 3),
    };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return {};
    const title = `${loaderData.program} Workout Routine — LiftCamp`;
    const description =
      loaderData.blurb ??
      `${loaderData.program}: a free ${loaderData.days.length} day routine with every exercise listed.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: `${SITE}/routines/${params.slug}` },
        { property: "og:type", content: "article" },
      ],
      links: [{ rel: "canonical", href: `${SITE}/routines/${params.slug}` }],
    };
  },
  component: RoutineDetailPage,
});

function RoutineDetailPage() {
  const { session } = useAuth();
  const routine = Route.useLoaderData();
  const totalExercises = routine.days.reduce((n, d) => n + d.exercises.length, 0);

  return (
    <div
      className="min-h-dvh bg-background flex flex-col"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <CatalogHeader />

      <header className="mx-auto w-full max-w-[1080px] px-5 pt-6 sm:pt-10">
        <nav aria-label="Breadcrumb" className="text-[15px] text-muted-foreground">
          <Link to="/routines" className="hover:underline">
            Routines
          </Link>
          <span aria-hidden className="px-1.5">
            ›
          </span>
          <span aria-current="page">{routine.program}</span>
        </nav>

        {/* Two columns from lg: the writing on the left, the artwork on the
            right at its native 2.12:1. A full-bleed hero cropped the figure to
            a pair of legs, because bg-cover at 1080x180 is a 6:1 window onto a
            2.12:1 image. */}
        <div className="mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:gap-12">
          <div>
            <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">{routine.program}</h1>
            {routine.blurb && (
              <p className="mt-3 max-w-[62ch] text-[16px] leading-relaxed text-muted-foreground lg:text-base">
                {routine.blurb}
              </p>
            )}
            <p className="mt-3 text-[15px] text-muted-foreground">
              {routine.days.length} day{routine.days.length === 1 ? "" : "s"} · {totalExercises}{" "}
              exercises · free, no account needed to read
            </p>

            {routine.muscles.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-1.5">
                {routine.muscles.map((m) => {
                  const c = muscleColors(m);
                  return (
                    <li
                      key={m}
                      className="rounded-full px-2.5 py-1 text-[13px] font-semibold capitalize"
                      style={{ backgroundColor: c.bg, color: c.fg }}
                    >
                      {m}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {routine.coverImageUrl && (
            <div
              className="mt-6 w-full overflow-hidden rounded-lg border border-border bg-cover bg-center lg:mt-0"
              style={{
                aspectRatio: "1016 / 480",
                backgroundImage: `url(${routine.coverImageUrl})`,
                backgroundColor: "#FDFCFB",
              }}
              role="img"
              aria-label={`${routine.program} routine`}
            />
          )}
        </div>
      </header>

      <main className={`flex-1 px-5 pt-6 ${session ? "pb-28" : "pb-12"}`}>
        <div className="mx-auto w-full max-w-[1080px]">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {routine.days.map((day, dayIndex) => (
              <section
                key={day.id}
                className="rounded-lg border border-border bg-secondary px-4 py-4"
              >
                <div>
                  <h2 className="text-base font-semibold tracking-tight">{day.name}</h2>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {day.exercises.length} exercise{day.exercises.length === 1 ? "" : "s"}
                  </p>
                </div>

                <ol className="mt-3 flex flex-col gap-1.5">
                  {day.exercises.map((ex, i) => (
                    <li key={`${day.id}-${ex.slug}-${i}`} className="flex items-baseline gap-2">
                      <span className="w-5 shrink-0 text-[13px] tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      <Link
                        to="/exercises/$slug"
                        params={{ slug: ex.slug }}
                        className="text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {ex.name}
                      </Link>
                      {ex.equipment && (
                        <span className="text-[13px] capitalize text-muted-foreground">
                          {ex.equipment}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>

                {/* An entry point into the builder that starts from a real day
                    rather than an empty page: the strongest version of "make
                    this yours" is one click from the plan they are reading. */}
                <Link
                  to="/routines/build"
                  search={{ from: routine.programSlug, day: dayIndex }}
                  className="mt-3 inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-[13px] font-semibold text-primary"
                >
                  Customize this day
                </Link>
              </section>
            ))}
          </div>

          {!session && (
            <div className="mt-10 flex flex-col gap-4 rounded-lg border border-border bg-secondary px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-8">
              <div className="max-w-[46ch]">
                <p className="text-base font-semibold tracking-tight">
                  Start {routine.program} today
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  A free account loads this routine into the app and keeps your weights between
                  sessions, so next week it tells you what you lifted last time.
                </p>
              </div>
              <div className="shrink-0">
                <Link
                  to="/login"
                  search={{ mode: "signup" }}
                  className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Create a free account
                </Link>
                <p className="mt-2 text-xs text-muted-foreground">
                  No card, no app store. Works in your browser.
                </p>
              </div>
            </div>
          )}

          {/* A way onward that is not the back button: three sibling routines,
              which also gives search engines internal links between them. */}
          {routine.others.length > 0 && (
            <section className="mt-12">
              <h2 className="text-lg font-bold tracking-tight">Other routines</h2>
              <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {routine.others.map((o) => (
                  <li key={o.programSlug} className="h-full">
                    <Link
                      to="/routines/$slug"
                      params={{ slug: o.programSlug }}
                      className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-secondary transition-colors hover:border-primary/40"
                    >
                      <div
                        className="h-[104px] shrink-0 bg-contain bg-center bg-no-repeat"
                        style={{
                          backgroundColor: "#FDFCFB",
                          ...(o.coverImageUrl
                            ? { backgroundImage: `url(${o.coverImageUrl})` }
                            : undefined),
                        }}
                        aria-hidden
                      />
                      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
                        <p className="text-[15px] font-bold leading-tight tracking-tight">
                          {o.program}
                        </p>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                          {o.dayCount} day{o.dayCount === 1 ? "" : "s"} · {o.exerciseCount}{" "}
                          exercises
                        </p>
                        <span className="mt-auto pt-3 text-[13px] font-semibold text-primary underline-offset-4 group-hover:underline">
                          View routine
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                to="/routines"
                className="mt-4 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                See all routines
              </Link>
            </section>
          )}
        </div>
      </main>

      {!session && <SiteFooter />}
      {session && <BottomNav />}
    </div>
  );
}
