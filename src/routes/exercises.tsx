import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";
import { BackLink } from "@/components/BackLink";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RegionNav } from "@/components/catalog/RegionNav";
import { CatalogSearch } from "@/components/catalog/CatalogSearch";
import { getCatalogIndex } from "@/lib/public-catalog.functions";
import { EQUIPMENT_PAGES } from "@/lib/equipment-pages";
import {
  regionCounts,
  equipmentFacets,
  muscleFacets,
  featuredRows,
  commonRows,
} from "@/lib/catalog-grouping";
import { formatEquipmentLabel } from "@/lib/exercise-visuals";
import { muscleLabel } from "@/lib/muscle-vocab";

// Public hub. The loader runs a public server fn so the region rail, every
// muscle link on it, the equipment facet and the authored strip are all in the
// server-rendered HTML — no session, no client fetch. The 886-row index itself
// is not shipped; the search component pulls it on first interaction.
export const Route = createFileRoute("/exercises")({
  loader: async () => {
    const rows = await getCatalogIndex();
    // Authored rows lead when they exist — they are the indexable pages, so a
    // link from the hub is worth the slot. Until then the strip falls back to
    // the lifts a beginner already has a name for, so the right-hand column is
    // never an empty rectangle.
    const authored = featuredRows(rows);
    const strip = authored.length > 0 ? authored : commonRows(rows);
    return {
      featuredKind: (authored.length > 0 ? "authored" : "common") as "authored" | "common",
      counts: regionCounts(rows),
      total: rows.length,
      // "other" is a bucket, not a piece of equipment — a chip for it filters
      // to 128 unrelated rows and answers nobody's question.
      equipment: equipmentFacets(rows)
        .filter((f) => f.value !== "other")
        .map((f) => ({ ...f, label: formatEquipmentLabel(f.value) })),
      muscles: muscleFacets(rows).map((f) => ({ ...f, label: muscleLabel(f.value) })),
      featured: strip.map((r) => ({
        slug: r.slug,
        name: r.name,
        equipment: r.equipment,
        level: r.level,
        image_url: r.image_url,
      })),
    };
  },
  head: ({ loaderData }) => {
    // The count comes from the live catalog, not a constant — the hardcoded
    // 883 went stale within weeks of shipping.
    const total = loaderData?.total ?? 886;
    const title = `Exercise Library — ${total} Exercises by Muscle | LiftCamp`;
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
  const { counts, total, equipment, muscles, featured, featuredKind } = Route.useLoaderData();
  const { session } = useAuth();

  return (
    <div
      className="min-h-dvh bg-background flex flex-col pb-28"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <CatalogHeader />

      <header className="mx-auto w-full max-w-[1080px] px-5 pt-6 pb-2 sm:pt-10">
        {session && <BackLink to="/" label="Home" />}
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-4xl">Exercise Library</h1>
        <p className="mt-2 text-[16px] text-muted-foreground lg:text-base">
          {total} exercises, photographed and explained.
        </p>
      </header>

      {/* Two columns on desktop: a persistent region rail and a working column.
          One column on mobile, search first — the rail is a card list below. */}
      <main className="mx-auto grid w-full max-w-[1080px] flex-1 gap-8 px-5 pb-10 pt-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
        <aside className="order-2 lg:order-1">
          <div className="lg:sticky lg:top-6">
            <RegionNav counts={counts} />
          </div>
        </aside>

        <div className="order-1 lg:order-2">
          <CatalogSearch
            equipment={equipment}
            muscles={muscles}
            featured={featured}
            featuredKind={featuredKind}
            total={total}
          />
        </div>
      </main>

      {!session && <SiteFooter />}

      {session && <BottomNav />}
    </div>
  );
}
