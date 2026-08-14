import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ExercisePicker } from "@/components/ExercisePicker";
import { BottomNav } from "@/components/BottomNav";
import { BackLink } from "@/components/BackLink";
import { HubTiles } from "@/components/catalog/HubTiles";
import { getCatalogIndex } from "@/lib/public-catalog.functions";
import { regionCounts } from "@/lib/catalog-grouping";

// Public hub. The loader runs a public server fn so the six region tiles and
// the muscle names on them are in the server-rendered HTML — no session, no
// client fetch. Signed-in users get the search picker and the app chrome on
// top of the same document.
export const Route = createFileRoute("/exercises")({
  loader: async () => {
    const rows = await getCatalogIndex();
    return { counts: regionCounts(rows), total: rows.length };
  },
  head: () => {
    const title = "Exercise Library — 883 Exercises by Muscle | LiftCamp";
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
  const { counts, total } = Route.useLoaderData();
  const { session } = useAuth();
  const [searching, setSearching] = useState(false);

  return (
    <div className="min-h-dvh bg-background flex flex-col pb-24">
      <header className="mx-auto w-full max-w-[1080px] px-5 pt-4 pb-2">
        {session && <BackLink to="/" label="Home" />}
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Exercise Library</h1>
      </header>

      <main className="mx-auto w-full max-w-[1080px] flex-1 px-5 pb-6">
        <button
          type="button"
          onClick={() => setSearching((v) => !v)}
          className="mb-6 h-10 w-full rounded-lg border border-border px-4 text-left text-sm text-muted-foreground"
        >
          Search exercises
        </button>

        {searching ? <ExercisePicker mode="browse" /> : <HubTiles counts={counts} total={total} />}
      </main>

      {session && <BottomNav />}
    </div>
  );
}
