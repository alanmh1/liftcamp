import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { RoutineArtBand } from "@/components/RoutineArtBand";
import { SiteFooter } from "@/components/SiteFooter";
import { AppStoreBadge } from "@/components/AppStoreBadge";
import { AndroidNotify } from "@/components/AndroidNotify";
import { muscleColors } from "@/lib/exercise-visuals";
import {
  DIFFICULTY_ORDER,
  EQUIPMENT_FILTER_ORDER,
  difficultyClass,
} from "@/lib/routine-prescription";
import { getPublicRoutines, type PublicRoutineSummary } from "@/lib/public-catalog.functions";

const BEST_FIRST_SLUG = "full-body-3-day";
/** Cards above the fold on a phone fetch their art with the page; the rest wait. */
const EAGER_CARDS = 3;

const SITE = "https://liftcamp.app";
const MAX_PILLS = 5;

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

function RoutinesPage() {
  const routines = Route.useLoaderData();
  const [days, setDays] = useState<number | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);

  const dayOptions = useMemo(
    () => [...new Set(routines.map((r) => r.daysPerWeek))].sort((a, b) => a - b),
    [routines],
  );
  const availableEquipment = useMemo(
    () => new Set(routines.flatMap((r) => r.equipment ?? [])),
    [routines],
  );
  const filtered = useMemo(
    () =>
      routines.filter((r) => {
        if (days !== null && r.daysPerWeek !== days) return false;
        if (equipment && !(r.equipment ?? []).includes(equipment)) return false;
        if (level && r.level !== level) return false;
        return true;
      }),
    [routines, days, equipment, level],
  );

  return (
    // The app shell caps every route at 480px, which is right for the logging
    // screens and wrong for a page strangers land on from search.
    <div
      className="min-h-dvh bg-background flex flex-col"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <CatalogHeader />

      <main className="flex-1 px-5 pt-6 pb-12">
        <div className="mx-auto w-full max-w-[1080px]">
          <h1 className="text-2xl font-bold tracking-tight">Free workout routines for beginners</h1>
          <p className="mt-1.5 max-w-[70ch] text-sm text-muted-foreground">
            Free workout plans for your first six months of lifting. Each routine lists every
            exercise with sets and reps, so you know what you're doing before you walk in. Use one
            as written or copy it and change whatever you want.
          </p>

          {routines.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">No built-in routines yet.</p>
          ) : (
            <>
            {/* Three axes, because those are the three things people decide by:
                how many days they can train, what they can train with, and how
                far along they are. Filtering happens in the client on a list of
                eleven, so no URL state and no refetch. */}
            <div className="mt-6 flex flex-col gap-2">
              <FilterRow label="Days a week">
                {dayOptions.map((d) => (
                  <Chip
                    key={d}
                    active={days === d}
                    onClick={() => setDays(days === d ? null : d)}
                  >
                    {d} day{d === 1 ? "" : "s"}
                  </Chip>
                ))}
              </FilterRow>
              <FilterRow label="Equipment">
                {EQUIPMENT_FILTER_ORDER.filter((e) => availableEquipment.has(e)).map((e) => (
                  <Chip
                    key={e}
                    active={equipment === e}
                    onClick={() => setEquipment(equipment === e ? null : e)}
                  >
                    {e}
                  </Chip>
                ))}
              </FilterRow>
              <FilterRow label="Difficulty">
                {DIFFICULTY_ORDER.map((d) => (
                  <Chip
                    key={d}
                    active={level === d}
                    onClick={() => setLevel(level === d ? null : d)}
                  >
                    {d}
                  </Chip>
                ))}
              </FilterRow>
              {(days || equipment || level) && (
                <div className="flex items-center gap-3 pt-0.5">
                  <p className="text-[13px] text-muted-foreground">
                    {filtered.length} routine{filtered.length === 1 ? "" : "s"}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setDays(null);
                      setEquipment(null);
                      setLevel(null);
                    }}
                    className="text-[13px] font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>

            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((r, i) => (
                <li key={r.programSlug} className="h-full">
                  <RoutineCard routine={r} eager={i < EAGER_CARDS} />
                </li>
              ))}
              {/* An action, not a routine: dashed and artwork-free so it reads
                  as the odd one out at the end of the set. */}
              <li className="h-full">
                <Link
                  to="/routines/build"
                  className="flex h-full flex-col rounded-lg border border-dashed border-border bg-background px-4 py-5 transition-colors hover:border-primary/60"
                >
                  <div className="flex-1">
                    <h2 className="text-lg font-bold leading-tight tracking-tight">
                      Build your own
                    </h2>
                    <p className="mt-2 text-[15px] text-muted-foreground">
                      None of these quite right? Pick your own exercises from the library and put
                      them in whatever order you want.
                    </p>
                  </div>
                  <span className="mt-4 text-sm font-semibold text-primary">
                    Open the builder
                  </span>
                </Link>
              </li>
            </ul>
            </>
          )}

          <div className="mt-10 rounded-xl bg-secondary px-5 py-6">
            <h2 className="text-lg font-bold tracking-tight">Start one of these today</h2>
            <p className="mt-1.5 max-w-[60ch] text-sm text-muted-foreground">
              The app keeps your weights between sessions, so next week it tells you what you lifted
              last time.
            </p>
            <AppStoreBadge tone="black" height={48} campaign="routines" className="mt-4" />
            <AndroidNotify source="routines" />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

/** One program. The whole card is the link. The band is the same tinted
 *  equipment illustration the app's routine card shows, picked by the same
 *  walk, so a program looks the same on the web and in the app. */
function RoutineCard({ routine, eager }: { routine: PublicRoutineSummary; eager: boolean }) {
  const shown = routine.muscles.slice(0, MAX_PILLS);
  const hidden = routine.muscles.length - shown.length;

  return (
    <Link
      to="/routines/$slug"
      params={{ slug: routine.programSlug }}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-secondary transition-colors hover:border-primary/40"
    >
      <div className="relative">
        <RoutineArtBand artKey={routine.art} className="h-[160px]" loading={eager ? "eager" : "lazy"} />
        {routine.programSlug === BEST_FIRST_SLUG && (
          <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[13px] font-semibold text-primary-foreground">
            Best first routine
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <h2 className="text-lg font-bold leading-tight tracking-tight">{routine.program}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-muted-foreground">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${difficultyClass(routine.level)}`}>
            {routine.level}
          </span>
          <span>
            {routine.daysPerWeek} day{routine.daysPerWeek === 1 ? "" : "s"} · {routine.exerciseCount}{" "}
            exercises
          </span>
        </p>

        {shown.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {shown.map((m) => {
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
            {hidden > 0 && (
              <li className="rounded-full bg-muted px-2.5 py-1 text-[13px] font-semibold text-muted-foreground">
                +{hidden}
              </li>
            )}
          </ul>
        )}

        <span className="mt-auto pt-4 text-sm font-semibold text-primary underline-offset-4 group-hover:underline">
          View routine
        </span>
      </div>
    </Link>
  );
}


/** A labelled row of filter chips. Horizontally scrollable on phones so a long
 *  row never wraps into three lines of noise. */
function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[86px] shrink-0 text-[13px] font-semibold text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-1 items-center gap-1.5 overflow-x-auto pb-0.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-secondary text-foreground hover:border-primary/50"
      }`}
    >
      {children}
    </button>
  );
}
