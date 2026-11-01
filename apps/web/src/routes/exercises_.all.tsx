import { createFileRoute } from "@tanstack/react-router";
import { getCatalogIndex, type CatalogRow } from "@/lib/public-catalog.functions";
import { indexableRows, regionCounts } from "@/lib/catalog-grouping";
import { EQUIPMENT_PAGES } from "@/lib/equipment-pages";
import { REGIONS } from "@/lib/muscle-regions";
import {
  Breadcrumb,
  HubHero,
  HubShell,
  LinkBand,
  RowList,
  regionLabel,
} from "@/components/catalog/v2/HubParts";

// /exercises/all: every indexable exercise, A to Z, as plain server-rendered
// links. The library's own list loads client-side on a click, so without this
// page a crawler reaches the authored detail pages only through hubs and
// guides. Indexable means the same as on the detail route and in the
// sitemap: a beginner_notes row and a canonical pointing at itself.
//
// A static route, so it wins over /exercises/$slug. No exercise has the slug
// "all" (checked 1 Nov 2026).

const SITE = "https://liftcamp.app";

type Letter = { letter: string; rows: CatalogRow[] };

function byLetter(rows: CatalogRow[]): Letter[] {
  const groups = new Map<string, CatalogRow[]>();
  for (const row of [...rows].sort((a, b) => a.name.localeCompare(b.name))) {
    const first = row.name.charAt(0).toUpperCase();
    const letter = /[A-Z]/.test(first) ? first : "#";
    groups.set(letter, [...(groups.get(letter) ?? []), row]);
  }
  return [...groups].map(([letter, rows]) => ({ letter, rows }));
}

export const Route = createFileRoute("/exercises_/all")({
  loader: async () => {
    const all = await getCatalogIndex();
    const rows = indexableRows(all);
    return { letters: byLetter(rows), total: rows.length, counts: regionCounts(all) };
  },
  head: ({ loaderData }) => {
    const total = loaderData?.total ?? 0;
    const title = `Exercises A to Z | ${total} Beginner Exercise Guides | LiftCamp`;
    const description = `All ${total} LiftCamp exercises with a beginner starting weight, form notes and swaps, listed A to Z.`;
    const url = `${SITE}/exercises/all`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
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
              { "@type": "ListItem", position: 2, name: "A to Z" },
            ],
          }),
        },
      ],
    };
  },
  component: ExercisesAToZ,
});

function ExercisesAToZ() {
  const { letters, total, counts } = Route.useLoaderData();
  return (
    <HubShell>
      <HubHero
        breadcrumb={<Breadcrumb items={[]} current="A to Z" />}
        h1="Exercises A to Z"
        intro={[
          "Every exercise in the library with a beginner starting weight, form notes and a swap for when the equipment is taken. Pick one to see how to set it up and what to load first.",
        ]}
        count={`${total} exercises.`}
      >
        <nav aria-label="Jump to a letter" className="mt-ds-lg">
          <ul className="flex flex-wrap gap-ds-xs p-0">
            {letters.map((l) => (
              <li key={l.letter}>
                <a
                  href={`#letter-${l.letter}`}
                  className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-border bg-background px-ds-sm font-label text-label text-foreground hover:border-primary/50 hover:text-primary"
                >
                  {l.letter}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </HubHero>

      <div className="mx-auto max-w-4xl space-y-ds-xl px-ds-lg pb-ds-2xl">
        {letters.map((l) => (
          <section key={l.letter} id={`letter-${l.letter}`} className="scroll-mt-24">
            <h2 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">
              {l.letter}
            </h2>
            <RowList rows={l.rows} />
          </section>
        ))}
      </div>

      <LinkBand
        groups={[
          {
            id: "by-muscle",
            title: "By muscle",
            links: REGIONS.map((r) => ({ label: regionLabel(r), slug: r, count: counts[r] })),
          },
          {
            id: "by-equipment",
            title: "By equipment",
            links: Object.values(EQUIPMENT_PAGES).map((p) => ({ label: p.label, slug: p.slug })),
          },
        ]}
      />
    </HubShell>
  );
}
