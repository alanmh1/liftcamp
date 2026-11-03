import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { FeaturedExercises } from "@/components/catalog/v2/FeaturedExercises";
import { BrowseSection } from "@/components/catalog/v2/BrowseSection";
import { ExerciseList, ExerciseSearch } from "@/components/catalog/v2/ExerciseList";
import { getCatalogIndex } from "@/lib/public-catalog.functions";
import { ALTERNATIVES_PAGES } from "@/lib/exercise-alternatives";
import { EQUIPMENT_PAGES } from "@/lib/equipment-pages";
import { submusclePageFor } from "@/lib/submuscle-pages";
import {
  regionCounts,
  indexableRows,
  equipmentFacets,
  muscleFacets,
  difficultyFacets,
  featuredRows,
  commonRows,
  rowMuscles,
} from "@/lib/catalog-grouping";
import { REGIONS, REGION_MUSCLES, muscleAnchor } from "@/lib/muscle-regions";
import { formatEquipmentLabel, normalizeSearch } from "@liftcamp/shared";
import { muscleLabel } from "@liftcamp/shared";
import { PageGlow } from "@/components/PageGlow";

// Public hub. The loader runs a public server fn so the region rail, every
// muscle link on it, the equipment facet and the authored strip are all in the
// server-rendered HTML: no session, no client fetch. The 886-row index itself
// is not shipped; the search component pulls it on first interaction.
export const Route = createFileRoute("/exercises")({
  loader: async () => {
    const rows = await getCatalogIndex();
    // Authored rows lead when they exist; they are the indexable pages, so a
    // link from the hub is worth the slot. Until then the strip falls back to
    // the lifts a beginner already has a name for, so the right-hand column is
    // never an empty rectangle.
    const authored = featuredRows(rows);
    const strip = authored.length > 0 ? authored : commonRows(rows);
    const counts = regionCounts(rows);
    // Per-muscle counts for the browse chips, counted the same way the region
    // page builds its anchored sections (regionSections).
    const muscleCounts = new Map<string, number>();
    for (const row of rows) {
      for (const m of rowMuscles(row)) muscleCounts.set(m, (muscleCounts.get(m) ?? 0) + 1);
    }
    return {
      featuredKind: (authored.length > 0 ? "authored" : "common") as "authored" | "common",
      counts,
      total: rows.length,
      indexableTotal: indexableRows(rows).length,
      // The strip only shows 12 tiles, but the heading should report the real
      // count of authored beginner blocks so it stays accurate as notes grow.
      authoredTotal: authored.length,
      // "other" is a bucket, not a piece of equipment; a chip for it filters
      // to 128 unrelated rows and answers nobody's question.
      equipment: equipmentFacets(rows)
        .filter((f) => f.value !== "other")
        .map((f) => ({ ...f, label: formatEquipmentLabel(f.value) })),
      muscles: muscleFacets(rows).map((f) => ({ ...f, label: muscleLabel(f.value) })),
      difficulties: difficultyFacets(rows).map((f) => ({
        ...f,
        label: f.value.charAt(0).toUpperCase() + f.value.slice(1),
      })),
      featured: strip.map((r) => ({
        slug: r.slug,
        name: r.name,
        equipment: r.equipment,
        level: r.level,
        image_url: r.image_url,
        primary_muscle: r.primary_muscle,
        all_primary_muscles: r.all_primary_muscles,
        secondary_muscles: r.secondary_muscles,
      })),
      // The browse section: every region, its muscles and every equipment
      // page, as server-rendered links with counts. Equipment counts match the
      // equipment landing page's own filter.
      browseRegions: REGIONS.map((region) => ({
        slug: region,
        label: region.charAt(0).toUpperCase() + region.slice(1),
        count: counts[region],
        muscles:
          REGION_MUSCLES[region].length > 1
            ? REGION_MUSCLES[region].map((m) => {
                const page = submusclePageFor(m);
                return {
                  label: muscleLabel(m),
                  slug: page?.slug ?? region,
                  anchor: page ? undefined : muscleAnchor(m),
                  count: muscleCounts.get(m) ?? 0,
                };
              })
            : [],
      })),
      browseEquipment: Object.values(EQUIPMENT_PAGES).map((p) => ({
        slug: p.slug,
        label: p.label,
        count: rows.filter((r) => r.equipment?.toLowerCase() === p.value).length,
      })),
    };
  },
  head: ({ loaderData }) => {
    // The count comes from the live catalog, not a constant; the hardcoded
    // 883 went stale within weeks of shipping.
    const total = loaderData?.total ?? 886;
    const title = `Exercise Library | ${total} Exercises by Muscle | LiftCamp`;
    const description =
      "Browse every exercise by muscle group: chest, back, shoulders, arms, legs and core, each with equipment, difficulty and step-by-step instructions.";
    const url = "https://liftcamp.app/exercises";
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
              { "@type": "ListItem", position: 1, name: "LiftCamp", item: "https://liftcamp.app" },
              { "@type": "ListItem", position: 2, name: "Exercises" },
            ],
          }),
        },
      ],
    };
  },
  component: ExercisesHub,
});

function ExercisesHub() {
  const {
    total,
    indexableTotal,
    difficulties,
    featured,
    featuredKind,
    authoredTotal,
    browseRegions,
    browseEquipment,
  } = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const needle = normalizeSearch(query);
  const searching = needle.length > 0;
  const shownFeatured = searching
    ? featured.filter((r) => normalizeSearch(r.name).includes(needle))
    : featured;

  return (
    <div
      className="min-h-dvh bg-background flex flex-col pb-28"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <CatalogHeader />

      <header className="relative overflow-hidden">
        <PageGlow />
        <div className="relative mx-auto max-w-7xl px-ds-lg pb-ds-xl pt-ds-xl md:pt-ds-2xl">
          <h1 className="font-display text-5xl font-extrabold leading-none tracking-tight text-foreground md:text-display">
            Exercise Library
          </h1>
          <p className="mt-ds-md max-w-xl font-body text-xl leading-relaxed text-muted-foreground">
            {total} exercises, photographed and explained.
          </p>
          <ExerciseSearch value={query} onChange={setQuery} total={total} />
        </div>
      </header>

      <main className="flex-1">
        <FeaturedExercises
          items={shownFeatured}
          kind={featuredKind}
          authoredTotal={authoredTotal}
          filtered={searching}
        />
        {/* Server-rendered with no query, so crawlers always get it. Hidden
            while searching so the results sit right under the strip. */}
        {!searching && <PopularSwaps />}
        {!searching && <BrowseSection regions={browseRegions} equipment={browseEquipment} />}
        <ExerciseList query={query} indexableTotal={indexableTotal} difficulties={difficulties} />
      </main>

      <SiteFooter />
    </div>
  );
}

/** The six /exercises/<base>/alternatives pages, as a row of chips between
 *  the authored strip and Browse. Labels are each page's H1. */
function PopularSwaps() {
  return (
    <section aria-labelledby="swaps-heading" className="mx-auto max-w-7xl px-ds-lg pb-ds-2xl">
      <h2
        id="swaps-heading"
        className="font-label text-label uppercase tracking-widest text-primary"
      >
        Popular swaps
      </h2>
      <ul className="mt-ds-sm flex flex-wrap gap-ds-sm p-0">
        {ALTERNATIVES_PAGES.map((p) => (
          <li key={p.base}>
            <Link
              to="/exercises/$slug/alternatives"
              params={{ slug: p.base }}
              className="inline-flex items-center rounded-full border border-border bg-background px-ds-md py-ds-sm font-label text-label text-foreground hover:border-primary hover:text-primary"
            >
              {p.h1}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
