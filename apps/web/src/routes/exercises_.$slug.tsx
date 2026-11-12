import { createFileRoute, notFound, redirect, Link } from "@tanstack/react-router";
import { canonMuscleList, muscleLabel, parseSteps, splitStepParts } from "@liftcamp/shared";
import { Lightbulb } from "lucide-react";
import { formatEquipmentLabel } from "@liftcamp/shared";
import { beginnerNotesDescription, exerciseFaq, howToStepName } from "@/lib/exercise-meta";
import { strengthPageForExercise } from "@/lib/strength-pages";
import { formatDay, latestDay } from "@/lib/dates";
import { metadataUrl } from "@/lib/metadata-base";
import { exerciseOgPath, OG_HEIGHT, OG_WIDTH } from "@/lib/og-images";
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
  REGION_META,
  REGION_MUSCLES,
  isRegion,
  type Region,
} from "@/lib/muscle-regions";
import {
  COMMON_SLUGS,
  equipmentGroups,
  muscleRows,
  primaryRegion,
  rowMuscles,
  regionCounts,
  regionSections,
  regionTotal,
  type EquipmentGroup,
  type MuscleSection,
} from "@/lib/catalog-grouping";
import {
  EQUIPMENT_PAGES,
  equipmentDescription,
  equipmentTitle,
  isEquipmentPageSlug,
  type EquipmentPage,
} from "@/lib/equipment-pages";
import {
  SUBMUSCLE_PAGES,
  isSubmusclePageSlug,
  submusclePageFor,
  submusclePages,
  type SubmusclePage,
} from "@/lib/submuscle-pages";
import { firstSentence } from "@/lib/exercise-meta";
import { FALLBACK_TINT, routineTints } from "@/lib/routine-tints";
import {
  getPublicRoutines,
  getRoutinesForExercise,
  getSeoCatalog,
  type CatalogRow,
  type PublicRoutineSummary,
} from "@/lib/public-catalog.functions";
import { RegionPage } from "@/components/catalog/v2/RegionPage";
import { EquipmentPage as EquipmentLanding } from "@/components/catalog/v2/EquipmentPage";
import {
  SubmusclePage as SubmuscleLanding,
  type StartWith,
} from "@/components/catalog/v2/SubmusclePage";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ExerciseAnimation } from "@/components/ExerciseAnimation";
import { DetailHeader } from "@/components/catalog/v2/DetailHeader";
import { EXERCISE_ART_HEIGHT, EXERCISE_ART_WIDTH, exerciseArtUrl } from "@/lib/exercise-art";
import { NewToThisCard } from "@/components/catalog/v2/NewToThisCard";
import { TrackInAppCard } from "@/components/catalog/v2/TrackInAppCard";
import { MoreExercises, type RelatedExercise } from "@/components/catalog/v2/MoreExercises";
import { ExerciseRoutinesGuides } from "@/components/catalog/v2/ExerciseRoutinesGuides";
import { guidesForExercise } from "@/lib/guide-exercises";
import { getGuide, guideMetas } from "@/content/guides";
import { alternativesPageFor } from "@/lib/exercise-alternatives";

// One dynamic segment under /exercises, six things it can be:
//
//   region slug     -> the region index page (six of them)
//   sub-muscle slug -> the sub-muscle page (14, submuscle-pages.ts)
//   equipment slug  -> the equipment index page (eight of them)
//   "neck"          -> 301 onto /exercises/shoulders#neck
//   legacy UUID     -> 301 onto the row's slug
//   exercise slug   -> the detail page
//
// Everything but the last two resolves before any database call. A CHECK
// constraint on exercises.slug guarantees no exercise can ever claim one of
// the six region words; the sub-muscle and equipment slugs were checked
// against the table when added, so the branch order shadows no real row.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SITE = "https://liftcamp.app";

type LoaderData =
  | { kind: "region"; region: Region; sections: MuscleSection[]; total: number; counts: Record<Region, number> }
  | { kind: "equipment"; page: EquipmentPage; rows: CatalogRow[]; counts: Record<Region, number> }
  | {
      kind: "submuscle";
      /** A slug, not the page: loader data is serialized, and the page holds a
       *  function. */
      slug: string;
      total: number;
      start: StartWith[];
      groups: EquipmentGroup[];
      routine: { summary: PublicRoutineSummary; tint: string } | null;
      /** Exercise counts for the sibling and parent links, keyed by slug. */
      counts: Record<string, number>;
    }
  | {
      kind: "exercise";
      exercise: PublicExercise;
      region: Region | null;
      muscle: string | null;
      /** Slug of the primary muscle's own page, when it has one. */
      submuscle: string | null;
      notes: BeginnerNotes | null;
      related: RelatedExercise[];
      /** System routines that include it, program order, at most six. */
      routines: (PublicRoutineSummary & { tint: string })[];
      /** Guide slugs that cover it, from lib/guide-exercises.ts. */
      guides: string[];
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

    if (isSubmusclePageSlug(params.slug)) {
      return submuscleLoader(SUBMUSCLE_PAGES[params.slug]!);
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
    const submuscle = submusclePageFor(pr?.muscle) ?? null;
    const [notes, related, routines] = await Promise.all([
      getBeginnerNotes({ data: { exerciseId: exercise.id } }),
      pr
        ? relatedExercises(
            submuscle ? [submuscle.muscle] : REGION_MUSCLES[pr.region],
            exercise.slug,
          )
        : Promise.resolve([]),
      getRoutinesForExercise({ data: { exerciseId: exercise.id, limit: 6 } }),
    ]);
    // Indexable means the same thing the head() noindex rule checks: notes,
    // and a canonical pointing at itself.
    const indexed = !!notes && !CANONICAL_SLUG_OVERRIDES[exercise.slug];
    return {
      kind: "exercise",
      exercise,
      region: pr?.region ?? null,
      muscle: pr?.muscle ?? first,
      submuscle: submuscle?.slug ?? null,
      notes,
      related,
      routines,
      guides: guidesForExercise(
        { slug: exercise.slug, equipment: exercise.equipment, indexed },
        guideMetas().map((m) => m.slug),
      ),
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

    if (loaderData.kind === "submuscle") {
      const page = SUBMUSCLE_PAGES[loaderData.slug]!;
      const description = page.description(loaderData.total);
      const url = `${SITE}/exercises/${page.slug}`;
      return {
        // No og:image here: the parent hub sets none either, so both share
        // the site default from __root.
        meta: [
          { title: page.title },
          { name: "description", content: description },
          { property: "og:title", content: page.title },
          { property: "og:description", content: description },
          { property: "og:url", content: url },
        ],
        links: [{ rel: "canonical", href: url }],
        scripts: [
          {
            type: "application/ld+json",
            children: JSON.stringify(
              breadcrumbLd(
                [
                  { name: "Exercises", url: `${SITE}/exercises` },
                  { name: regionName(page.parent), url: `${SITE}/exercises/${page.parent}` },
                ],
                page.label,
              ),
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
    // Past 60 characters, drop "How to and" so "Muscles Worked" survives.
    const fullTitle = `${ex.name}: How to and Muscles Worked`;
    const title = fullTitle.length <= 60 ? fullTitle : `${ex.name}: Muscles Worked`;
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

    const submuscle = loaderData.submuscle ? SUBMUSCLE_PAGES[loaderData.submuscle]! : null;
    const crumbs = exerciseCrumbs(loaderData.region, submuscle).map((c) => ({
      name: c.name,
      url: `${SITE}${c.path}`,
    }));

    // Share and HowTo image, best first: the 1200x630 card made from the clay
    // hero, the clay hero itself, then the catalog photo. Site paths resolve
    // against the deploy for og:image (metadata-base.ts) and against the
    // canonical origin for JSON-LD.
    const ogPath = exerciseOgPath(ex.slug);
    const artPath = exerciseArtUrl(ex.slug);
    const image: { path: string | null; url: string; width?: number; height?: number } | null =
      ogPath
        ? { path: ogPath, url: metadataUrl(ogPath), width: OG_WIDTH, height: OG_HEIGHT }
        : artPath
          ? {
              path: artPath,
              url: metadataUrl(artPath),
              width: EXERCISE_ART_WIDTH,
              height: EXERCISE_ART_HEIGHT,
            }
          : ex.image_url
            ? { path: null, url: ex.image_url }
            : null;
    const ldImage = image ? (image.path ? `${SITE}${image.path}` : image.url) : null;
    // The exercise row or its beginner block, whichever changed last. The
    // sitemap dates the page the same way.
    const dateModified = latestDay(ex.updated_at, loaderData.notes?.updated_at);

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
          ...(ldImage ? { image: ldImage } : {}),
          datePublished: latestDay(ex.created_at),
          dateModified,
          ...(ex.equipment
            ? { tool: [{ "@type": "HowToTool", name: formatEquipmentLabel(ex.equipment) }] }
            : {}),
          step: steps.map((text, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: howToStepName(text, i + 1),
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

    // Meta entries dedupe by property, so these replace the root og:image
    // rather than stacking with it. 11 catalog rows have no imagery and keep
    // the site default.
    if (image) {
      meta.push(
        { property: "og:image", content: image.url },
        { name: "twitter:image", content: image.url },
      );
      if (image.width && image.height) {
        meta.push(
          { property: "og:image:width", content: String(image.width) },
          { property: "og:image:height", content: String(image.height) },
        );
      }
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

function regionName(region: Region): string {
  return region.charAt(0).toUpperCase() + region.slice(1);
}

/** Breadcrumb items above an exercise: Exercises, its region, and its
 *  sub-muscle page when the primary muscle has one. The visible breadcrumb
 *  and the BreadcrumbList both read this. */
function exerciseCrumbs(
  region: Region | null,
  submuscle: SubmusclePage | null,
): { name: string; path: string }[] {
  const crumbs = [{ name: "Exercises", path: "/exercises" }];
  if (region) crumbs.push({ name: regionName(region), path: `/exercises/${region}` });
  if (region && submuscle) {
    crumbs.push({ name: submuscle.label, path: `/exercises/${submuscle.slug}` });
  }
  return crumbs;
}

async function submuscleLoader(page: SubmusclePage): Promise<LoaderData> {
  const [all, seo, routines] = await Promise.all([
    getCatalogIndex(),
    getSeoCatalog(),
    page.routine ? getPublicRoutines() : Promise.resolve([]),
  ]);
  const rows = muscleRows(all, page.muscle);
  const bySlug = new Map(all.map((r) => [r.slug, r]));
  const startingWeight = new Map(seo.exercises.map((e) => [e.slug, e.starting_weight_md]));
  const start = page.start
    .map((slug) => bySlug.get(slug))
    .filter((r): r is CatalogRow => !!r)
    .map((r) => {
      const md = startingWeight.get(r.slug);
      return { exercise: r, note: md ? firstSentence(md) : null };
    });

  const summary = page.routine ? routines.find((r) => r.programSlug === page.routine) : undefined;
  const routine = summary
    ? { summary, tint: routineTints(routines).get(summary.programSlug) ?? FALLBACK_TINT }
    : null;

  const counts: Record<string, number> = { ...regionCounts(all) };
  for (const p of submusclePages()) counts[p.slug] = muscleRows(all, p.muscle).length;

  return {
    kind: "submuscle",
    slug: page.slug,
    total: rows.length,
    start,
    groups: equipmentGroups(rows),
    routine,
    counts,
  };
}

/** Five more exercises for the foot of a detail page, from the sub-muscle when
 *  the primary muscle has a page, else the region: authored rows first, then
 *  the common lifts in COMMON_SLUGS order, then the catalog's name order.
 *  Membership is counted the way the hub builds its sections. */
async function relatedExercises(
  muscles: readonly string[],
  exclude: string,
): Promise<RelatedExercise[]> {
  const rows = await getCatalogIndex();
  const common = new Map(COMMON_SLUGS.map((s, i) => [s, i]));
  const rank = (slug: string) => common.get(slug) ?? Number.MAX_SAFE_INTEGER;
  return rows
    .filter(
      (r) => r.slug !== exclude && muscles.some((m) => (rowMuscles(r) as string[]).includes(m)),
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

/** Linked items plus the current page. Only real URLs are items: a hub anchor
 *  is never one, since Google treats a fragment as the same URL. */
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
  if (data.kind === "submuscle") {
    return (
      <SubmuscleLanding
        page={SUBMUSCLE_PAGES[data.slug]!}
        total={data.total}
        start={data.start}
        groups={data.groups}
        routine={data.routine}
        counts={data.counts}
      />
    );
  }
  return (
    <ExerciseDetail
      exercise={data.exercise}
      region={data.region}
      submuscle={data.submuscle ? SUBMUSCLE_PAGES[data.submuscle]! : null}
      notes={data.notes}
      related={data.related}
      routines={data.routines}
      guides={data.guides}
    />
  );
}

/** The alternatives page link for the bases that have one. */
function alternativesLink(slug: string): { slug: string; label: string } | null {
  const page = alternativesPageFor(slug);
  return page ? { slug, label: page.h1 } : null;
}

function ExerciseDetail({
  exercise: ex,
  region,
  submuscle,
  notes,
  related,
  routines,
  guides,
}: {
  exercise: PublicExercise;
  region: Region | null;
  submuscle: SubmusclePage | null;
  notes: BeginnerNotes | null;
  related: RelatedExercise[];
  routines: (PublicRoutineSummary & { tint: string })[];
  guides: string[];
}) {
  const primary = canonMuscleList(ex.all_primary_muscles || ex.primary_muscle).map(muscleLabel);
  const secondary = canonMuscleList(ex.secondary_muscles).map(muscleLabel);
  const steps = parseSteps(ex.description);
  const updated = latestDay(ex.updated_at, notes?.updated_at);
  const strength = strengthPageForExercise(ex.id);

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
              {/* The same items the BreadcrumbList JSON-LD names. */}
              {exerciseCrumbs(region, submuscle)
                .slice(1)
                .map((c) => (
                  <span key={c.path}>
                    <span aria-hidden> › </span>
                    <Link
                      to="/exercises/$slug"
                      params={{ slug: c.path.slice("/exercises/".length) }}
                      className="underline-offset-4 hover:underline"
                    >
                      {c.name}
                    </Link>
                  </span>
                ))}
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

        {notes && (
          <>
            <NewToThisCard notes={notes} name={ex.name} alternatives={alternativesLink(ex.slug)} />
            {/* Same date as the HowTo dateModified and the sitemap lastmod,
                in the guide byline's type. */}
            <div className="mx-auto -mt-ds-xl max-w-7xl px-ds-lg pb-ds-2xl text-[15px] text-muted-foreground">
              <p>
                Updated{" "}
                <time dateTime={updated}>{formatDay(updated)}</time>
              </p>
              {/* Only the 7 lifts with a strength standards page. */}
              {strength && (
                <p className="mt-ds-xs">
                  <Link
                    to="/strength-standards/$lift"
                    params={{ lift: strength.slug }}
                    className="font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    See the {strength.name.toLowerCase()} strength standards
                  </Link>
                </p>
              )}
            </div>
          </>
        )}

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

      <ExerciseRoutinesGuides
        routines={routines}
        guides={guides.map((g) => getGuide(g)?.meta).filter((m) => !!m)}
      />

      {region && (
        <MoreExercises
          items={related}
          slug={submuscle?.slug ?? region}
          h1={submuscle?.h1 ?? REGION_META[region].h1}
          fallbackMuscle={submuscle?.label ?? regionName(region)}
        />
      )}

      <SiteFooter />
    </div>
  );
}
