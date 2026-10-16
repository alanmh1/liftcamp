import { createFileRoute, notFound, redirect, Link } from "@tanstack/react-router";
import { canonMuscleList, muscleLabel, parseSteps, splitStepParts } from "@liftcamp/shared";
import { Lightbulb } from "lucide-react";
import { formatEquipmentLabel } from "@liftcamp/shared";
import { beginnerNotesDescription, exerciseFaq } from "@/lib/exercise-meta";
import {
  getPublicExerciseBySlug,
  getPublicExerciseSlugById,
  getCatalogIndex,
  getBeginnerNotes,
  type BeginnerNotes,
  type PublicExercise,
} from "@/lib/public-catalog.functions";
import {
  CANONICAL_SLUG_OVERRIDES,
  LEGACY_SLUG_REDIRECTS,
  MUSCLE_SLUG_REDIRECTS,
  REGIONS,
  REGION_META,
  REGION_MUSCLES,
  isRegion,
  muscleAnchor,
  type Region,
} from "@/lib/muscle-regions";
import {
  COMMON_SLUGS,
  primaryRegion,
  rowMuscles,
  regionCounts,
  regionSections,
  regionTotal,
  type MuscleSection,
} from "@/lib/catalog-grouping";
import {
  EQUIPMENT_PAGES,
  equipmentDescription,
  equipmentTitle,
  isEquipmentPageSlug,
  type EquipmentPage,
} from "@/lib/equipment-pages";
import type { CatalogRow } from "@/lib/public-catalog.functions";
import { RegionPage } from "@/components/catalog/RegionPage";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { ExerciseThumb } from "@/components/catalog/ExerciseThumb";
import { SiteFooter } from "@/components/SiteFooter";
import { ExerciseAnimation } from "@/components/ExerciseAnimation";
import { DetailHeader } from "@/components/catalog/v2/DetailHeader";
import { exerciseArtUrl } from "@/lib/exercise-art";
import { NewToThisCard } from "@/components/catalog/v2/NewToThisCard";
import { TrackInAppCard } from "@/components/catalog/v2/TrackInAppCard";
import { MoreExercises, type RelatedExercise } from "@/components/catalog/v2/MoreExercises";

// One dynamic segment under /exercises, five things it can be:
//
//   region slug    -> the region index page (six of them)
//   equipment slug -> the equipment index page (eight of them)
//   muscle name    -> 301 onto /exercises/[region]#[muscle], 17 of them
//   legacy UUID    -> 301 onto the row's slug
//   exercise slug  -> the detail page
//
// Regions and muscles resolve before any database call. A CHECK constraint on
// exercises.slug guarantees no exercise can ever claim one of the six region
// words, so the branch order can never shadow a real exercise.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SITE = "https://liftcamp.app";

type LoaderData =
  | { kind: "region"; region: Region; sections: MuscleSection[]; total: number; counts: Record<Region, number> }
  | { kind: "equipment"; page: EquipmentPage; rows: CatalogRow[]; counts: Record<Region, number> }
  | {
      kind: "exercise";
      exercise: PublicExercise;
      region: Region | null;
      muscle: string | null;
      notes: BeginnerNotes | null;
      related: RelatedExercise[];
    };

export const Route = createFileRoute("/exercises_/$slug")({
  beforeLoad: async ({ params }) => {
    const seg = params.slug.toLowerCase();

    // "chest" and "shoulders" are both a muscle name AND a region slug. The
    // region page wins, otherwise /exercises/chest 301s to itself forever.
    const muscle = isRegion(seg) ? undefined : MUSCLE_SLUG_REDIRECTS[seg];
    if (muscle) {
      throw redirect({
        to: "/exercises/$slug",
        params: { slug: muscle.region },
        hash: muscle.hash,
        statusCode: 301,
      });
    }

    // Renamed rows. Checked before the database call, so the old URL never
    // reaches a lookup that would now miss.
    const moved = isRegion(seg) ? undefined : LEGACY_SLUG_REDIRECTS[seg];
    if (moved) {
      throw redirect({ to: "/exercises/$slug", params: { slug: moved }, statusCode: 301 });
    }



    if (UUID_RE.test(seg)) {
      const slug = await getPublicExerciseSlugById({ data: { id: seg } });
      if (!slug) throw notFound();
      throw redirect({ to: "/exercises/$slug", params: { slug }, statusCode: 301 });
    }
  },
  loader: async ({ params }): Promise<LoaderData> => {
    if (isRegion(params.slug)) {
      const rows = await getCatalogIndex();
      const sections = regionSections(rows, params.slug);
      return {
        kind: "region",
        region: params.slug,
        sections,
        total: regionTotal(sections),
        counts: regionCounts(rows),
      };
    }

    if (isEquipmentPageSlug(params.slug)) {
      const page = EQUIPMENT_PAGES[params.slug]!;
      const all = await getCatalogIndex();
      const rows = all.filter((r) => r.equipment?.toLowerCase() === page.value);
      return { kind: "equipment", page, rows, counts: regionCounts(all) };
    }

    const exercise = await getPublicExerciseBySlug({ data: { slug: params.slug } });
    if (!exercise) throw notFound();
    const first = canonMuscleList(exercise.all_primary_muscles || exercise.primary_muscle)[0] ?? null;
    const pr = primaryRegion({
      primary_muscle: exercise.primary_muscle,
      all_primary_muscles: exercise.all_primary_muscles,
    });
    const [notes, related] = await Promise.all([
      getBeginnerNotes({ data: { exerciseId: exercise.id } }),
      pr ? relatedInRegion(pr.region, exercise.slug) : Promise.resolve([]),
    ]);
    return {
      kind: "exercise",
      exercise,
      region: pr?.region ?? null,
      muscle: pr?.muscle ?? first,
      notes,
      related,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};

    if (loaderData.kind === "region") {
      const meta = REGION_META[loaderData.region];
      const url = `${SITE}/exercises/${loaderData.region}`;
      return {
        meta: [
          { title: meta.title },
          { name: "description", content: meta.description },
          { property: "og:title", content: meta.title },
          { property: "og:description", content: meta.description },
          { property: "og:url", content: url },
        ],
        links: [{ rel: "canonical", href: url }],
        scripts: [
          {
            type: "application/ld+json",
            children: JSON.stringify(
              breadcrumbLd([{ name: "Exercises", url: `${SITE}/exercises` }], meta.h1),
            ),
          },
        ],
      };
    }

    if (loaderData.kind === "equipment") {
      const page = loaderData.page;
      const n = loaderData.rows.length;
      const title = equipmentTitle(page, n);
      const description = equipmentDescription(page, n);
      const url = `${SITE}/exercises/${page.slug}`;
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
            children: JSON.stringify(
              breadcrumbLd([{ name: "Exercises", url: `${SITE}/exercises` }], page.h1),
            ),
          },
        ],
      };
    }

    const ex = loaderData.exercise;
    // No brand on this one template: long names like "Standing Cable Chest
    // Press" already run past 60 characters, and a truncated title costs
    // "Muscles Worked", the part people search for. Google appends the site
    // name on mobile regardless.
    const title = `${ex.name}: How to and Muscles Worked`;
    // Differs row to row on three query-matching terms, so 886 pages no longer
    // share one boilerplate string. Falls back to the plain version when a row
    // is missing any of the three.
    const level = ex.level?.toLowerCase();
    const prime = canonMuscleList(ex.all_primary_muscles || ex.primary_muscle)[0];
    const eq = ex.equipment ? formatEquipmentLabel(ex.equipment).toLowerCase() : null;
    // The 76 rows with notes get their own copy: a starting weight and a form
    // symptom, both taken from the authored prose already on the page. The
    // other 810 keep the three-term template.
    const authored = loaderData.notes
      ? beginnerNotesDescription(ex.name, loaderData.notes)
      : null;
    const description =
      authored ??
      (level && prime && eq
        ? `How to do the ${ex.name}, a ${level} ${muscleLabel(prime).toLowerCase()} exercise using ${eq}. Muscles worked, setup and step by step instructions.`
        : `How to do the ${ex.name}: muscles worked, equipment needed and step-by-step instructions.`);
    // Two live rows describe one movement; the outlier points at the row whose
    // name follows the catalog convention so the pages stop splitting the query.
    const canonicalSlug = CANONICAL_SLUG_OVERRIDES[ex.slug] ?? ex.slug;
    const url = `${SITE}/exercises/${canonicalSlug}`;

    const region = loaderData.region;
    const crumbs = [{ name: "Exercises", url: `${SITE}/exercises` }];
    if (region) {
      crumbs.push({
        name: region.charAt(0).toUpperCase() + region.slice(1),
        // Fragment intentionally omitted from the trail item URL below; the
        // visible crumb still links to the anchor.
        url: `${SITE}/exercises/${region}`,
      });
    }

    const steps = parseSteps(ex.description);
    const scripts = [
      {
        type: "application/ld+json",
        children: JSON.stringify(breadcrumbLd(crumbs, ex.name)),
      },
    ];
    if (steps.length > 0) {
      scripts.push({
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: `How to do the ${ex.name}`,
          description,
          url,
          ...(ex.image_url ? { image: ex.image_url } : {}),
          ...(ex.equipment
            ? { tool: [{ "@type": "HowToTool", name: formatEquipmentLabel(ex.equipment) }] }
            : {}),
          step: steps.map((text, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: `Step ${i + 1}`,
            text,
          })),
        }),
      });
    }

    // Only the rows with authored notes. The questions here are the same
    // strings rendered as headings in NewToThisCard, so the markup matches
    // what a reader sees.
    if (loaderData.notes) {
      const faq = exerciseFaq(ex.name, loaderData.notes);
      scripts.push({
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      });
    }

    const meta = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
    ];

    // Frame 0 is a real photo of the movement and an absolute https URL, so it
    // is a far better share preview than the site-wide default. Meta entries
    // dedupe by property, so this replaces the root og:image rather than
    // stacking with it. 11 catalog rows have no imagery and fall back.
    if (ex.image_url) {
      meta.push(
        { property: "og:image", content: ex.image_url },
        { name: "twitter:image", content: ex.image_url },
      );
    }

    // Indexability follows the beginner block. Without one the page is the
    // free-exercise-db description verbatim, which is on dozens of other
    // sites; `follow` keeps the substitute links live so the authored pages
    // still collect the internal signal.
    //
    // The override case is excluded on purpose: a page already pointing its
    // canonical at a different URL must not also carry noindex, because Google
    // can apply the noindex to the canonical target.
    const isCanonicalSelf = canonicalSlug === ex.slug;
    if (isCanonicalSelf && !loaderData.notes) {
      meta.push({ name: "robots", content: "noindex,follow" });
    }

    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts,
    };
  },
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-[660px] px-5 py-16" role="alert">
      <p className="text-[15px] text-muted-foreground">
        {error instanceof Error ? error.message : String(error)}
      </p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-[660px] px-5 py-16">
      <p className="text-[15px] text-muted-foreground">That exercise doesn’t exist.</p>
    </div>
  ),
  component: CatalogSlugPage,
});

/** Five more exercises from the same region for the foot of a detail page:
 *  authored rows first, then the common lifts in COMMON_SLUGS order, then
 *  the catalog's name order. Region membership is counted the way the
 *  region page builds its sections (REGION_MUSCLES). */
async function relatedInRegion(region: Region, exclude: string): Promise<RelatedExercise[]> {
  const rows = await getCatalogIndex();
  const common = new Map(COMMON_SLUGS.map((s, i) => [s, i]));
  const rank = (slug: string) => common.get(slug) ?? Number.MAX_SAFE_INTEGER;
  return rows
    .filter(
      (r) =>
        r.slug !== exclude && REGION_MUSCLES[region].some((m) => rowMuscles(r).includes(m)),
    )
    .sort((a, b) => Number(b.has_notes) - Number(a.has_notes) || rank(a.slug) - rank(b.slug))
    .slice(0, 5)
    .map((r) => {
      const m = rowMuscles(r)[0];
      return {
        slug: r.slug,
        name: r.name,
        equipment: r.equipment,
        level: r.level,
        image_url: r.image_url,
        muscle: m ? muscleLabel(m) : null,
      };
    });
}

/** Exactly two items plus the current page. The muscle anchor is never a third
 *  level: Google treats a fragment as the same URL, so it buys nothing. */
function breadcrumbLd(items: { name: string; url: string }[], current: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      ...items.map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: it.name,
        item: it.url,
      })),
      { "@type": "ListItem", position: items.length + 1, name: current },
    ],
  };
}

function CatalogSlugPage() {
  const data = Route.useLoaderData();
  if (data.kind === "region") {
    return (
      <RegionPage
        region={data.region}
        sections={data.sections}
        total={data.total}
        counts={data.counts}
      />
    );
  }
  if (data.kind === "equipment") {
    return <EquipmentLanding page={data.page} rows={data.rows} counts={data.counts} />;
  }
  return (
    <ExerciseDetail
      exercise={data.exercise}
      region={data.region}
      muscle={data.muscle}
      notes={data.notes}
      related={data.related}
    />
  );
}

function ExerciseDetail({
  exercise: ex,
  region,
  muscle,
  notes,
  related,
}: {
  exercise: PublicExercise;
  region: Region | null;
  muscle: string | null;
  notes: BeginnerNotes | null;
  related: RelatedExercise[];
}) {
  const primary = canonMuscleList(ex.all_primary_muscles || ex.primary_muscle).map(muscleLabel);
  const secondary = canonMuscleList(ex.secondary_muscles).map(muscleLabel);
  const steps = parseSteps(ex.description);

  return (
    <div
      className="min-h-dvh bg-background"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <CatalogHeader />

      <article>
        <DetailHeader
          name={ex.name}
          primary={primary}
          secondary={secondary}
          equipment={ex.equipment ? formatEquipmentLabel(ex.equipment) : null}
          muscles={ex}
          art={exerciseArtUrl(ex.slug)}
          breadcrumb={
            <nav aria-label="Breadcrumb" className="text-[13px] text-muted-foreground">
              <Link to="/exercises" className="underline-offset-4 hover:underline">
                Exercises
              </Link>
              {region && (
                <>
                  <span aria-hidden> › </span>
                  {/* Lands on the region page scrolled to the muscle the reader
                      came for, while the crumb still reads as the region. */}
                  <Link
                    to="/exercises/$slug"
                    params={{ slug: region }}
                    hash={muscle ? muscleAnchor(muscle) : undefined}
                    className="underline-offset-4 hover:underline"
                  >
                    {region.charAt(0).toUpperCase() + region.slice(1)}
                  </Link>
                </>
              )}
              <span aria-hidden> › </span>
              <span aria-current="page">{ex.name}</span>
            </nav>
          }
          animation={
            /* Both frames, cross-faded. One exercise on screen, so the cost the
               list rows avoid is worth paying here: the two photos are the start
               and end of the rep. */
            <ExerciseAnimation
              imageUrl={ex.image_url}
              imageUrl2={ex.image_url_2}
              gifUrl={ex.gif_url}
              alt={ex.name}
              className="w-full"
            />
          }
        />

        {notes && <NewToThisCard notes={notes} name={ex.name} />}

        <section
          aria-labelledby={steps.length > 0 ? "steps-heading" : undefined}
          className="mx-auto grid max-w-7xl items-start gap-ds-xl px-ds-lg pb-ds-2xl lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]"
        >
          <div>
            {steps.length > 0 && (
              <>
                <h2
                  id="steps-heading"
                  className="font-heading text-3xl font-extrabold tracking-tight text-foreground md:text-4xl"
                >
                  How to do it
                </h2>
                <ol className="mt-ds-lg space-y-ds-md p-0">
                  {steps.map((step, i) => (
                    <li
                      key={i}
                      className="flex gap-ds-md rounded-lg border border-border p-ds-md shadow-sm"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent font-heading text-lg font-extrabold tabular-nums text-accent-foreground"
                      >
                        {i + 1}
                      </span>
                      <div className="self-center font-body text-body text-foreground">
                        {splitStepParts(step).map((part, j) => (
                          <p key={j} className={j > 0 ? "mt-ds-xs" : undefined}>
                            {part.label && (
                              <>
                                <Lightbulb
                                  className="mr-1 inline h-3.5 w-3.5 -translate-y-px text-tip"
                                  aria-hidden
                                />
                                <span className="font-semibold">{part.label}: </span>
                              </>
                            )}
                            {part.text}
                          </p>
                        ))}
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
          <div className="lg:sticky lg:top-28">
            <TrackInAppCard />
          </div>
        </section>
      </article>

      {region && <MoreExercises items={related} region={region} />}

      <SiteFooter />
    </div>
  );
}

/** Equipment index page: one flat, fully server-rendered list. Authored rows
 *  (has_notes) lead, matching the region pages and giving the indexable
 *  detail pages an internal link from an indexed page. */
function EquipmentLanding({
  page,
  rows,
  counts,
}: {
  page: EquipmentPage;
  rows: CatalogRow[];
  counts: Record<Region, number>;
}) {
  const sorted = [...rows].sort(
    (a, b) => Number(b.has_notes) - Number(a.has_notes) || (a.name < b.name ? -1 : 1),
  );
  const otherEquipment = Object.values(EQUIPMENT_PAGES).filter((p) => p.slug !== page.slug);

  return (
    <div
      className="min-h-dvh bg-background"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <CatalogHeader />

      <div className="mx-auto grid max-w-[1080px] gap-10 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_240px]">
        <main>
          <nav aria-label="Breadcrumb" className="text-[15px] text-muted-foreground">
            <Link to="/exercises" className="underline-offset-4 hover:underline">
              Exercises
            </Link>
            <span aria-hidden> › </span>
            <span aria-current="page">{page.label}</span>
          </nav>

          <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">{page.h1}</h1>
          <p className="mt-3 max-w-[62ch] text-[16px] leading-relaxed text-muted-foreground lg:text-base">
            {page.intro}
          </p>
          <p className="mt-2 text-[15px] text-muted-foreground">{rows.length} exercises.</p>

          <ul className="mt-6 p-0">
            {sorted.map((row) => (
              <li key={row.slug} className="border-b border-border">
                <Link
                  to="/exercises/$slug"
                  params={{ slug: row.slug }}
                  className="flex items-center gap-3 py-2.5 text-[16px] lg:py-3 lg:text-base"
                >
                  <ExerciseThumb imageUrl={row.image_url} className="w-[64px] lg:w-[72px]" />
                  <span className="min-w-0 flex-1 lg:flex lg:items-baseline lg:justify-between lg:gap-3">
                    <span className="block font-medium">{row.name}</span>
                    <span className="mt-0.5 block text-[15px] text-muted-foreground lg:mt-0 lg:shrink-0">
                      {[row.level && row.level.charAt(0).toUpperCase() + row.level.slice(1)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span aria-hidden className="text-muted-foreground">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-3">
            <div className="rounded-xl border border-border p-4">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                By equipment
              </p>
              <ul className="mt-2 divide-y divide-border p-0">
                {otherEquipment.map((p) => (
                  <li key={p.slug}>
                    <Link
                      to="/exercises/$slug"
                      params={{ slug: p.slug }}
                      className="block py-[9px] text-[16px] hover:underline"
                    >
                      {p.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                By muscle
              </p>
              <ul className="mt-2 divide-y divide-border p-0">
                {REGIONS.map((r) => (
                  <li key={r}>
                    <Link
                      to="/exercises/$slug"
                      params={{ slug: r }}
                      className="block py-[9px] text-[16px] hover:underline"
                    >
                      {r.charAt(0).toUpperCase() + r.slice(1)}{" "}
                      <span className="font-mono text-[15px] text-muted-foreground">
                        {counts[r]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      </div>

      <SiteFooter />
    </div>
  );
}
