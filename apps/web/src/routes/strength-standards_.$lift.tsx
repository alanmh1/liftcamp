import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AnswerBlock } from "@/components/guides/AnswerBlock";
import { StrengthCalculator } from "@/components/strength/StrengthCalculator";
import {
  FaqSection,
  LevelMeanings,
  LiftLinkCards,
  OtherLifts,
  StandardsTables,
  StrengthCta,
} from "@/components/strength/StrengthParts";
import {
  sexOf,
  unitOf,
  validateStrengthSearch,
  withUnit,
  type StrengthSearch,
} from "@/lib/strength-calc";
import { strengthHead } from "@/lib/strength-head";
import {
  AGE_NOTE,
  liftAnswer,
  liftDescription,
  liftFaq,
  liftIntro1,
  loadNoteFor,
  STRENGTH_PAGES,
} from "@/lib/strength-pages";

export const Route = createFileRoute("/strength-standards_/$lift")({
  validateSearch: (search: Record<string, unknown>): StrengthSearch => {
    // `lift` belongs to the hub; a lift page's lift is its slug.
    const { lift: _hubOnly, ...rest } = validateStrengthSearch(search);
    return rest;
  },
  loader: ({ params }) => {
    if (!STRENGTH_PAGES[params.lift]) throw notFound();
    return { slug: params.lift };
  },
  head: ({ loaderData }) => {
    const page = loaderData ? STRENGTH_PAGES[loaderData.slug] : undefined;
    if (!page) return {};
    return strengthHead({
      path: `/strength-standards/${page.slug}`,
      title: page.title,
      description: liftDescription(page),
      ogExerciseSlug: page.exerciseSlug,
      crumbs: [
        { name: "Strength standards", path: "/strength-standards" },
        { name: page.name, path: `/strength-standards/${page.slug}` },
      ],
      faq: liftFaq(page),
    });
  },
  component: LiftStandardsPage,
});

function LiftStandardsPage() {
  const { slug } = Route.useLoaderData();
  const page = STRENGTH_PAGES[slug]!;
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const update = (next: StrengthSearch) =>
    navigate({ search: next, replace: true, resetScroll: false });
  const unit = unitOf(search);

  return (
    <div
      className="flex min-h-dvh flex-col bg-background"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <CatalogHeader />

      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 -top-24 h-[420px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 -top-10 h-[460px] w-[560px] rounded-full bg-primary/5 blur-3xl" />
        <div className="relative mx-auto w-full max-w-[1080px] px-4 pb-10 pt-12 sm:px-5 sm:pt-16 lg:pb-12 lg:pt-20">
          <nav aria-label="Breadcrumb" className="text-[15px] text-muted-foreground">
            <Link to="/strength-standards" className="hover:underline">
              Strength standards
            </Link>
            <span aria-hidden className="px-1.5">
              ›
            </span>
            <span aria-current="page">{page.name}</span>
          </nav>
          <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">{page.h1}</h1>
          <p className="mt-3 max-w-[72ch] text-[16px] leading-relaxed text-muted-foreground lg:text-[17px]">
            {liftIntro1(page)}
          </p>
          <p className="mt-3 max-w-[72ch] text-[16px] leading-relaxed text-muted-foreground lg:text-[17px]">
            {page.intro2}
          </p>
        </div>
      </header>

      <main className="flex-1 px-4 pb-16 sm:px-5">
        <div className="mx-auto w-full max-w-[1080px]">
          <div className="max-w-[760px]">
            <AnswerBlock>
              <p className="tabular-nums">{liftAnswer(page)}</p>
            </AnswerBlock>
            <div className="mt-6">
              <StrengthCalculator search={search} onSearchChange={update} liftSlug={page.slug} />
            </div>
          </div>

          <StandardsTables
            page={page}
            unit={unit}
            onUnitChange={(u) => update(withUnit(search, u))}
            bodyweight={search.bw ?? null}
            sex={sexOf(search)}
            footnote={`${loadNoteFor(page)} ${AGE_NOTE}`}
          />

          <div className="max-w-[760px]">
            <LevelMeanings />
          </div>

          <LiftLinkCards page={page} />

          <div className="max-w-[760px]">
            <FaqSection items={liftFaq(page)} />
          </div>

          <StrengthCta />

          <div className="max-w-[760px]">
            <OtherLifts current={page.slug} />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
