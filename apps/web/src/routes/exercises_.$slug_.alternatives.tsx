import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { appStoreUrl } from "@liftcamp/shared";
import { getCatalogIndex, type CatalogRow } from "@/lib/public-catalog.functions";
import { alternativesPageFor, alternativesPath } from "@/lib/exercise-alternatives";
import { ExerciseCard, type CardExercise } from "@/components/catalog/v2/ExerciseCard";
import { Breadcrumb, HubHero, HubShell } from "@/components/catalog/v2/HubParts";
import { Faq } from "@/components/guides/Faq";

// /exercises/<base>/alternatives for the six bases in
// lib/exercise-alternatives.ts. Every other slug 404s before a database call.
// The trailing underscore on $slug_ keeps this out of the /exercises/$slug
// route's tree, so the hubs, redirects and detail page there never see it,
// and /exercises/all/alternatives is a plain 404 ("all" is not a base).
//
// The copy is the JSON's, verbatim. The catalog read supplies names,
// equipment and imagery, the same cached index the library hub uses.

const SITE = "https://liftcamp.app";

function card(r: CatalogRow): CardExercise {
  return {
    slug: r.slug,
    name: r.name,
    equipment: r.equipment,
    level: r.level,
    image_url: r.image_url,
    primary_muscle: r.primary_muscle,
    all_primary_muscles: r.all_primary_muscles,
    secondary_muscles: r.secondary_muscles,
  };
}

export const Route = createFileRoute("/exercises_/$slug_/alternatives")({
  loader: async ({ params }) => {
    const page = alternativesPageFor(params.slug);
    if (!page) throw notFound();
    const rows = await getCatalogIndex();
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    const base = bySlug.get(page.base);
    if (!base) throw notFound();
    // A swap missing from the catalog drops out rather than breaking the
    // page; scripts/check-exercise-alternatives.ts is what catches it.
    const swaps: Record<string, CardExercise> = {};
    for (const g of page.groups) {
      for (const it of g.items) {
        const row = bySlug.get(it.slug);
        if (row) swaps[it.slug] = card(row);
      }
    }
    return { base: page.base, baseName: base.name, swaps };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const page = alternativesPageFor(loaderData.base)!;
    const title = `${page.title} | LiftCamp`;
    const url = `${SITE}${alternativesPath(page.base)}`;
    return {
      meta: [
        { title },
        { name: "description", content: page.description },
        { property: "og:title", content: title },
        { property: "og:description", content: page.description },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Exercises", item: `${SITE}/exercises` },
              {
                "@type": "ListItem",
                position: 2,
                name: loaderData.baseName,
                item: `${SITE}/exercises/${page.base}`,
              },
              { "@type": "ListItem", position: 3, name: "Alternatives" },
            ],
          }),
        },
        // The same two questions the FAQ section renders.
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: page.faq.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-[660px] px-5 py-16">
      <p className="text-[15px] text-muted-foreground">That page doesn’t exist.</p>
    </div>
  ),
  component: AlternativesPage,
});

function AlternativesPage() {
  const { base, baseName, swaps } = Route.useLoaderData();
  const page = alternativesPageFor(base)!;

  return (
    <HubShell>
      <HubHero
        breadcrumb={<Breadcrumb items={[{ label: baseName, slug: base }]} current="Alternatives" />}
        h1={page.h1}
        intro={[page.lead]}
      >
        <p className="mt-ds-md">
          <Link
            to="/exercises/$slug"
            params={{ slug: base }}
            activeOptions={{ exact: true }}
            className="font-label text-label font-semibold text-primary underline-offset-4 hover:underline"
          >
            How to do the {baseName.toLowerCase()}
          </Link>
        </p>
      </HubHero>

      {page.groups.map((g, i) => (
        <section
          key={g.heading}
          aria-labelledby={`group-${i}`}
          className="mx-auto max-w-7xl px-ds-lg pb-ds-2xl"
        >
          <h2
            id={`group-${i}`}
            className="font-heading text-3xl font-extrabold tracking-tight text-foreground md:text-4xl"
          >
            {g.heading}
          </h2>
          <ul className="mt-ds-lg grid gap-ds-md p-0 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((it) => {
              const ex = swaps[it.slug];
              if (!ex) return null;
              return (
                <li key={it.slug}>
                  <ExerciseCard exercise={ex} note={it.why} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section aria-labelledby="how-to-pick" className="mx-auto max-w-4xl px-ds-lg pb-ds-2xl">
        <h2
          id="how-to-pick"
          className="font-heading text-3xl font-extrabold tracking-tight text-foreground md:text-4xl"
        >
          How to pick
        </h2>
        <p className="mt-ds-md font-body text-body text-muted-foreground">{page.how_to_pick}</p>
      </section>

      <section aria-labelledby="faq" className="mx-auto max-w-4xl px-ds-lg pb-ds-2xl">
        <h2
          id="faq"
          className="font-heading text-3xl font-extrabold tracking-tight text-foreground md:text-4xl"
        >
          {page.h1} FAQ
        </h2>
        <Faq items={page.faq} />
      </section>

      {/* Same ask as the routine page's hero button, its own campaign token. */}
      <section className="mx-auto max-w-4xl px-ds-lg pb-ds-2xl">
        <a
          href={appStoreUrl("alternatives_cta")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-[15px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Try these swaps in LiftCamp
          <ArrowRight className="h-4 w-4" aria-hidden />
        </a>
      </section>
    </HubShell>
  );
}
