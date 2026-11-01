import { createFileRoute } from "@tanstack/react-router";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StrengthCalculator } from "@/components/strength/StrengthCalculator";
import {
  FaqSection,
  LevelMeanings,
  StrengthCta,
  SummaryTable,
} from "@/components/strength/StrengthParts";
import { unitOf, validateStrengthSearch, withUnit, type StrengthSearch } from "@/lib/strength-calc";
import { strengthHead } from "@/lib/strength-head";
import { HUB } from "@/lib/strength-pages";

export const Route = createFileRoute("/strength-standards")({
  validateSearch: (search: Record<string, unknown>): StrengthSearch =>
    validateStrengthSearch(search),
  head: () =>
    strengthHead({
      path: "/strength-standards",
      title: HUB.title,
      description: HUB.description,
      ogExerciseSlug: "barbell-squat",
      crumbs: [{ name: "Strength standards", path: "/strength-standards" }],
      faq: HUB.faq,
    }),
  component: StrengthStandardsHub,
});

function StrengthStandardsHub() {
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
        <div className="pointer-events-none absolute -right-40 -top-48 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto w-full max-w-[1080px] px-4 pt-6 sm:px-5 sm:pt-10">
          <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">{HUB.h1}</h1>
          {HUB.intro.map((p) => (
            <p
              key={p}
              className="mt-3 max-w-[72ch] text-[16px] leading-relaxed text-muted-foreground lg:text-[17px]"
            >
              {p}
            </p>
          ))}
        </div>
      </header>

      <main className="flex-1 px-4 pb-16 sm:px-5">
        <div className="mx-auto w-full max-w-[1080px]">
          <div className="mt-6 max-w-[760px]">
            <StrengthCalculator search={search} onSearchChange={update} />
          </div>

          <SummaryTable unit={unit} onUnitChange={(u) => update(withUnit(search, u))} />

          <div className="max-w-[760px]">
            <LevelMeanings />
            <FaqSection items={HUB.faq} />
          </div>

          <StrengthCta />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
