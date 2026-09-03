import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { muscleColors } from "@/lib/exercise-visuals";
import { routineCopy } from "@/lib/routine-copy";
import { getGuide } from "@/content/guides";
import {
  getPublicRoutineBySlug,
  getPublicRoutines,
  type PublicRoutineDetail,
  type PublicRoutineSummary,
} from "@/lib/public-catalog.functions";

const SITE = "https://liftcamp.app";

/** Truncate on a word boundary at 155 chars, then ellipsise. A raw slice cut
 *  descriptions mid-word ("how to add weig…"), which is what showed in the
 *  search result when Google used ours. */
function metaDescription(text: string): string {
  if (text.length <= 155) return text;
  const cut = text.slice(0, 155);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

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
    const copy = routineCopy(
      params.slug,
      loaderData.program,
      loaderData.days.length,
      loaderData.blurb,
    );
    // The program name alone is not what anyone types. The suffix carries the
    // shape of the plan and "Free" carries the objection.
    const title = `${loaderData.program} Workout Routine ${copy.titleSuffix} — Free | LiftCamp`;
    const description = metaDescription(copy.answer);
    const url = `${SITE}/routines/${params.slug}`;
    const image = loaderData.coverImageUrl
      ? `${SITE}${loaderData.coverImageUrl.startsWith("/") ? "" : "/"}${loaderData.coverImageUrl}`
      : null;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
              { name: "twitter:card", content: "summary_large_image" },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: SITE },
              { "@type": "ListItem", position: 2, name: "Routines", item: `${SITE}/routines` },
              { "@type": "ListItem", position: 3, name: loaderData.program, item: url },
            ],
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: copy.faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        },
      ],
    };
  },
  component: RoutineDetailPage,
});

/** A slim bar that appears once the hero has scrolled away on phones. The
 *  signup ask is otherwise a single block near the top of a long page. */
function StickyCta({ program }: { program: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    function onScroll() {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setShow(max > 400 && window.scrollY / max > 0.3);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur transition-transform sm:hidden ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-[13px] leading-tight text-muted-foreground">
          Keep {program} and your weights, free
        </p>
        <Link
          to="/login"
          search={{ mode: "signup" }}
          className="inline-flex h-10 shrink-0 items-center rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
        >
          Start free
        </Link>
      </div>
    </div>
  );
}

function RoutineDetailPage() {
  const { session } = useAuth();
  const routine = Route.useLoaderData();
  const totalExercises = routine.days.reduce((n, d) => n + d.exercises.length, 0);
  const copy = routineCopy(
    routine.programSlug,
    routine.program,
    routine.days.length,
    routine.blurb,
  );
  const guides = copy.guides.map((s) => getGuide(s)?.meta).filter((m) => !!m);


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
            <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
              {routine.program} Workout Routine
            </h1>
            {/* Answer first: the opening paragraph has to stand on its own if
                it is lifted out of the page and quoted back to someone. */}
            <p className="mt-3 max-w-[62ch] text-[16px] leading-relaxed lg:text-base">
              {copy.answer}
            </p>
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

            {!session && routine.days.length > 0 && (
              <Link
                to="/routines/build"
                search={{ from: routine.programSlug, day: 0 }}
                className="mt-5 inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground"
              >
                Try {routine.days[0].name} free
              </Link>
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

      <main className={`flex-1 px-5 pt-6 ${session ? "pb-28" : "pb-24 sm:pb-12"}`}>
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

          {/* Questions people actually type, answered in plain sentences. The
              same list is emitted as FAQPage above, so an answer engine and a
              reader see the same text. */}
          <section className="mt-12" id="faq">
            <h2 className="text-lg font-bold tracking-tight">
              {routine.program} questions, answered
            </h2>
            <dl className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {copy.faqs.map((f) => (
                <div key={f.q} className="rounded-lg border border-border bg-secondary px-4 py-4">
                  <dt className="text-sm font-semibold tracking-tight">{f.q}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          {guides.length > 0 && (
            <section className="mt-12">
              <h2 className="text-lg font-bold tracking-tight">Read next</h2>
              <ul className="mt-4 flex flex-col gap-3">
                {guides.map((g) => (
                  <li key={g.slug}>
                    <Link
                      to="/guides/$slug"
                      params={{ slug: g.slug }}
                      className="block rounded-lg border border-border bg-secondary px-4 py-3 transition-colors hover:border-primary/40"
                    >
                      <p className="text-sm font-semibold tracking-tight">{g.title}</p>
                      <p className="mt-1 text-[13px] text-muted-foreground">{g.dek}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}



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
      {!session && <StickyCta program={routine.program} />}
      {session && <BottomNav />}
    </div>

  );
}
