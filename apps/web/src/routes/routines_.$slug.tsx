import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { RoutineArtBand } from "@/components/RoutineArtBand";
import { SiteFooter } from "@/components/SiteFooter";
import { muscleColors, equipmentIcon } from "@/lib/exercise-visuals";
import { formatEquipmentLabel } from "@liftcamp/shared";
import { routineCopy } from "@/lib/routine-copy";
import {
  prescribeWithTarget,
  estimateMinutes,
  difficultyClass,
} from "@/lib/routine-prescription";
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
      loaderData.daysPerWeek,
      loaderData.blurb,
    );
    // The program name alone is not what anyone types. The suffix carries the
    // shape of the plan and "Free" carries the objection.
    const title = `${loaderData.program} Workout Routine ${copy.titleSuffix} | Free | LiftCamp`;
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
    routine.daysPerWeek,
    routine.blurb,
  );
  const guides = copy.guides.map((s) => getGuide(s)?.meta).filter((m) => !!m);
  const level = routine.level;
  const dayAnchor = (id: string) => `day-${id}`;




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

        {/* Two columns from lg: the writing on the left, the equipment
            illustration on the right, the same tinted treatment as the index
            card and the app, at 4:3 so it holds its own beside the copy. */}
        <div className="mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:gap-12">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-semibold ${difficultyClass(level)}`}
              >
                {level}
              </span>
              {routine.programSlug === "full-body-3-day" && (
                <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-1 text-[13px] font-semibold text-primary-foreground">
                  Best first routine
                </span>
              )}
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">
              {routine.program} Workout Routine
            </h1>

            {/* Answer first: the opening paragraph has to stand on its own if
                it is lifted out of the page and quoted back to someone. */}
            <p className="mt-3 max-w-[62ch] text-[16px] leading-relaxed lg:text-base">
              {copy.answer}
            </p>
            <p className="mt-3 text-[15px] text-muted-foreground">
              {routine.daysPerWeek} day{routine.daysPerWeek === 1 ? "" : "s"} a week ·{" "}
              {totalExercises} exercises{routine.equipment ? ` · ${routine.equipment}` : ""} · free,
              no account needed to read
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

          {/* The largest image above the fold, so it goes out with the page
              rather than waiting for layout. */}
          <RoutineArtBand
            artKey={routine.art}
            className="mt-6 aspect-[4/3] rounded-lg border border-border lg:mt-0"
            loading="eager"
            priority
          />
        </div>
      </header>

      <main className={`flex-1 px-5 pt-6 ${session ? "pb-28" : "pb-24 sm:pb-12"}`}>
        <div className="mx-auto w-full max-w-[1080px]">
          {/* Jump nav. Four to six day cards is more than fits on a phone
              screen, so the days get an index that stays put while you read. */}
          {routine.days.length > 2 && (
            <nav
              aria-label="Jump to a day"
              className="sticky top-0 z-30 -mx-5 mb-4 overflow-x-auto border-b border-border bg-background/95 px-5 py-2 backdrop-blur"
            >
              <ul className="flex items-center gap-1.5">
                {routine.days.map((day) => (
                  <li key={`jump-${day.id}`}>
                    <a
                      href={`#${dayAnchor(day.id)}`}
                      className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full border border-border bg-secondary px-3 text-[13px] font-semibold text-foreground hover:border-primary/50"
                    >
                      {day.name}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {routine.days.map((day, dayIndex) => {
              const plan = day.exercises.map((e) =>
                prescribeWithTarget(e.name, { sets: e.targetSets, reps: e.targetReps }),
              );
              const minutes = estimateMinutes(plan);
              return (
                <section
                  key={day.id}
                  id={dayAnchor(day.id)}
                  className="scroll-mt-16 rounded-lg border border-border bg-secondary px-4 py-4"
                >
                  <div>
                    <h2 className="text-base font-semibold tracking-tight">{day.name}</h2>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      {day.exercises.length} exercise{day.exercises.length === 1 ? "" : "s"} · ~
                      {minutes} min
                    </p>
                  </div>

                  <ol className="mt-3 flex flex-col gap-2">
                    {day.exercises.map((ex, i) => {
                      const p = plan[i]!;
                      const Icon = equipmentIcon(ex.equipment);
                      return (
                        <li
                          key={`${day.id}-${ex.slug}-${i}`}
                          className="flex items-start gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0"
                        >
                          <span className="w-5 shrink-0 pt-0.5 text-[13px] tabular-nums text-muted-foreground">
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <Link
                              to="/exercises/$slug"
                              params={{ slug: ex.slug }}
                              className="text-sm font-medium underline-offset-4 hover:underline"
                            >
                              {ex.name}
                            </Link>
                            {ex.equipment && (
                              <span className="mt-0.5 flex items-center gap-1 text-[13px] text-muted-foreground">
                                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                {formatEquipmentLabel(ex.equipment)}
                              </span>
                            )}
                          </div>
                          {/* Numbers, not just names: a routine without sets and
                              reps is a list, and the page promises a plan. The
                              stored target where there is one, the name
                              heuristic where a template left it null. */}
                          <span className="shrink-0 whitespace-nowrap rounded-md bg-background px-2 py-1 text-[13px] font-semibold tabular-nums">
                            {p.sets} × {p.reps}
                          </span>
                        </li>
                      );
                    })}
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
              );
            })}
          </div>

          <p className="mt-3 text-[15px] text-muted-foreground">
            Sets and reps are the beginner defaults: heavy compound lifts at 3 × 5-8 with two to
            three minutes of rest, everything else at 3 × 8-15 with about a minute. Change them to
            suit you.
          </p>


          {/* Questions people actually type, answered in plain sentences. The
              same list is emitted as FAQPage above, so an answer engine and a
              reader see the same text. */}
          <section className="mt-12" id="faq">
            <h2 className="text-lg font-bold tracking-tight">
              {routine.program} questions, answered
            </h2>
            {/* Collapsed by default: four open answers is a wall of text on a
                phone. The text still ships in the HTML, and the FAQPage block
                above carries the same questions and answers verbatim. */}
            <div className="mt-4 grid grid-cols-1 gap-3">
              {copy.faqs.map((f, i) => (
                <details
                  key={f.q}
                  open={i === 0}
                  className="group h-fit rounded-lg border border-border bg-secondary px-4 py-3 [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold tracking-tight">{f.q}</h3>
                    <span
                      aria-hidden
                      className="mt-0.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    >
                      ⌄
                    </span>
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>

          </section>

          {guides.length > 0 && (
            <section className="mt-12">
              <h2 className="text-lg font-bold tracking-tight">Read next</h2>
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {guides.map((g) => (
                  <li key={g.slug} className="h-full">
                    <Link
                      to="/guides/$slug"
                      params={{ slug: g.slug }}
                      className="flex h-full flex-col rounded-lg border border-border bg-secondary px-4 py-3 transition-colors hover:border-primary/40"
                    >
                      <p className="text-sm font-semibold tracking-tight">{g.title}</p>
                      <p className="mt-1 text-[15px] text-muted-foreground">{g.dek}</p>
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
                <p className="mt-2 text-[13px] text-muted-foreground">
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
                      <RoutineArtBand artKey={o.art} className="h-[104px]" />
                      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
                        <p className="text-[15px] font-bold leading-tight tracking-tight">
                          {o.program}
                        </p>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                          {o.daysPerWeek} day{o.daysPerWeek === 1 ? "" : "s"} · {o.exerciseCount}{" "}
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
