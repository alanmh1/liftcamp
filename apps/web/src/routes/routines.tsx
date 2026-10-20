import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { FeaturedRoutine } from "@/components/routines/FeaturedRoutine";
import { RoutineFilters } from "@/components/routines/RoutineFilters";
import { RoutineGrid } from "@/components/routines/RoutineGrid";
import { RoutinesCta } from "@/components/routines/RoutinesCta";
import { RoutinesHeader } from "@/components/routines/RoutinesHeader";
import { DIFFICULTY_ORDER, EQUIPMENT_FILTER_ORDER } from "@/lib/routine-prescription";
import { getPublicRoutines, type PublicRoutineSummary } from "@/lib/public-catalog.functions";
import { routineTints } from "@/lib/routine-tints";

/** Pulled out of the grid as the featured hero; the filters apply to the grid only. */
const BEST_FIRST_SLUG = "full-body-3-day";

const SITE = "https://liftcamp.app";

const TITLE = "Free Beginner Workout Routines and Plans | LiftCamp";
const DESCRIPTION =
  "Free beginner workout routines with every exercise, set, and rep listed. Full body, upper lower, and push pull legs plans you can start this week.";

export const Route = createFileRoute("/routines")({
  loader: async (): Promise<PublicRoutineSummary[]> => getPublicRoutines(),
  head: ({ loaderData }) => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE}/routines` },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: `${SITE}/routines` }],
    // An ItemList is the machine-readable version of what the page already
    // shows: an ordered set of named routines, each at its own URL.
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Free workout routines",
          numberOfItems: loaderData?.length ?? 0,
          itemListElement: (loaderData ?? []).map((r, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: `${r.program} workout routine`,
            url: `${SITE}/routines/${r.programSlug}`,
          })),
        }),
      },
    ],
  }),

  component: RoutinesPage,
});

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function RoutinesPage() {
  const routines = Route.useLoaderData();
  const [days, setDays] = useState<number[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);

  const featured = useMemo(
    () => routines.find((r) => r.programSlug === BEST_FIRST_SLUG) ?? null,
    [routines],
  );
  const grid = useMemo(
    () => (featured ? routines.filter((r) => r !== featured) : routines),
    [routines, featured],
  );

  // Over the whole grid in loader order, so a card keeps its colour when the
  // filters hide its neighbours.
  const tints = useMemo(() => routineTints(grid, featured?.art ?? null), [grid, featured]);

  const dayOptions = useMemo(
    () => [...new Set(grid.map((r) => r.daysPerWeek))].sort((a, b) => a - b),
    [grid],
  );
  const equipmentOptions = useMemo(() => {
    const available = new Set(grid.flatMap((r) => r.equipment ?? []));
    return EQUIPMENT_FILTER_ORDER.filter((e) => available.has(e));
  }, [grid]);
  const levelOptions = useMemo(() => {
    const available = new Set(grid.map((r) => r.level));
    return DIFFICULTY_ORDER.filter((l) => available.has(l));
  }, [grid]);

  const filtered = useMemo(
    () =>
      grid.filter((r) => {
        if (days.length > 0 && !days.includes(r.daysPerWeek)) return false;
        if (equipment.length > 0 && !(r.equipment ?? []).some((e) => equipment.includes(e)))
          return false;
        if (levels.length > 0 && !levels.includes(r.level)) return false;
        return true;
      }),
    [grid, days, equipment, levels],
  );

  const clear = () => {
    setDays([]);
    setEquipment([]);
    setLevels([]);
  };

  const subtitle =
    dayOptions.length > 1
      ? `From ${dayOptions[0]} days a week to ${dayOptions[dayOptions.length - 1]}, at home or in the gym.`
      : null;

  return (
    // The app shell caps every route at 480px, which is right for the logging
    // screens and wrong for a page strangers land on from search.
    <div
      className="min-h-dvh bg-background flex flex-col"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <CatalogHeader />

      <main className="flex-1">
        <RoutinesHeader />

        {routines.length === 0 ? (
          <p className="mx-auto max-w-[1080px] px-5 pb-12 text-sm text-muted-foreground">
            No built-in routines yet.
          </p>
        ) : (
          <>
            <RoutineFilters
              dayOptions={dayOptions}
              equipmentOptions={equipmentOptions}
              levelOptions={levelOptions}
              days={days}
              equipment={equipment}
              levels={levels}
              onDay={(d) => setDays((cur) => toggle(cur, d))}
              onEquipment={(e) => setEquipment((cur) => toggle(cur, e))}
              onLevel={(l) => setLevels((cur) => toggle(cur, l))}
              onClear={clear}
              shown={filtered.length}
              total={grid.length}
            />
            {featured && <FeaturedRoutine routine={featured} />}
            <RoutineGrid routines={filtered} tints={tints} subtitle={subtitle} onClear={clear} />
          </>
        )}

        <RoutinesCta />
      </main>

      <SiteFooter />
    </div>
  );
}
