import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AppStoreBadge } from "@/components/AppStoreBadge";
import { AndroidNotify } from "@/components/AndroidNotify";
import { TableOfContents } from "@/components/guides/TableOfContents";
import { getGuide, guideMetas } from "@/content/guides";
import { AUTHOR_ID, AUTHOR_NAME, ORGANIZATION_ID, ORGANIZATION_SAME_AS } from "@/lib/brand";
import { GUIDE_EXERCISES, exercisesForGuide } from "@/lib/guide-exercises";
import { getCatalogIndex } from "@/lib/public-catalog.functions";
import { formatEquipmentLabel } from "@liftcamp/shared";
import { PageGlow } from "@/components/PageGlow";

/** Rows shown in "Exercises in this guide" before an equipment rule hands
 *  the rest to its hub. */
const GUIDE_EXERCISE_CAP = 8;

const SITE = "https://liftcamp.app";

function fmt(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export const Route = createFileRoute("/guides_/$slug")({
  loader: async ({ params }) => {
    const guide = getGuide(params.slug);
    if (!guide) throw notFound();
    // The exercises the guide covers (lib/guide-exercises.ts), as plain rows.
    // Only mapped guides read the catalog, and that read is cached.
    const rule = GUIDE_EXERCISES[params.slug];
    const listed =
      rule && rule.kind !== "indexed" ? exercisesForGuide(params.slug, await getCatalogIndex()) : [];
    const exercises = listed.slice(0, GUIDE_EXERCISE_CAP).map((r) => ({
      slug: r.slug,
      name: r.name,
      equipment: r.equipment,
    }));
    // Only the meta crosses the loader boundary. Body is a component, resolved
    // from the same registry inside the render.
    return {
      meta: guide.meta,
      exercises,
      more:
        rule?.kind === "equipment" && listed.length > exercises.length
          ? {
              hub: rule.hub,
              total: listed.length,
              label: formatEquipmentLabel(rule.value).toLowerCase(),
            }
          : null,
      allIndexed: rule?.kind === "indexed",
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const m = loaderData.meta;
    const title = `${m.seoTitle ?? m.title} | LiftCamp`;
    const url = `${SITE}/guides/${m.slug}`;
    const hero = m.hero ? { url: `${SITE}/guides/${m.slug}-og.png`, alt: m.hero.alt } : null;
    const meta = [
      { title },
      { name: "description", content: m.description },
      { property: "og:title", content: title },
      { property: "og:description", content: m.description },
      { property: "og:url", content: url },
      { property: "og:type", content: "article" },
      ...(hero
        ? [
            { property: "og:image", content: hero.url },
            { property: "og:image:width", content: "1200" },
            { property: "og:image:height", content: "630" },
            { property: "og:image:alt", content: hero.alt },
            { name: "twitter:image", content: hero.url },
            { name: "twitter:card", content: "summary_large_image" },
          ]
        : []),
    ];
    // A draft renders at its URL so it can be previewed, but must never be
    // indexed. Published guides carry no robots tag at all.
    if (m.draft) meta.push({ name: "robots", content: "noindex,nofollow" });

    // FAQPage only when the guide authors one. Same list the body renders.
    const faqScripts = m.faq?.length
      ? [
          {
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: m.faq.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            }),
          },
        ]
      : [];

    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [
        ...faqScripts,
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: m.title,
            description: m.description,
            datePublished: m.published,
            dateModified: m.updated,
            mainEntityOfPage: url,
            ...(hero ? { image: hero.url } : {}),
            // The Person is defined in full on /about. Google does not
            // resolve @id across pages, so name and url ride along here.
            author: {
              "@type": "Person",
              "@id": AUTHOR_ID,
              name: AUTHOR_NAME,
              url: `${SITE}/about`,
            },
            publisher: {
              "@type": "Organization",
              "@id": ORGANIZATION_ID,
              name: "LiftCamp",
              url: SITE,
              sameAs: ORGANIZATION_SAME_AS,
            },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "LiftCamp", item: SITE },
              { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE}/guides` },
              { "@type": "ListItem", position: 3, name: m.title },
            ],
          }),
        },
      ],
    };
  },
  component: GuideArticle,
});

function GuideArticle() {
  const { meta, exercises, more, allIndexed } = Route.useLoaderData();
  const guide = getGuide(meta.slug);
  if (!guide) return null;
  const Body = guide.Body;
  const related = guideMetas().filter((m) => m.slug !== meta.slug).slice(0, 3);

  return (
    <div
      className="min-h-dvh bg-background flex flex-col pb-28"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <CatalogHeader />

      <header className="relative overflow-hidden">
        <PageGlow />
        <div className="relative mx-auto w-full max-w-[1080px] px-5 pt-6 sm:pt-10">
          <nav aria-label="Breadcrumb" className="text-[15px] text-muted-foreground">
            <Link to="/guides" className="hover:underline">
              Guides
            </Link>
            <span aria-hidden className="px-1.5">
              ›
            </span>
            <span aria-current="page">{meta.title}</span>
          </nav>

          <h1 className="mt-2 lg:max-w-[42ch] text-3xl font-bold tracking-tight lg:text-4xl">
            {meta.title}
          </h1>
          <p className="mt-3 lg:max-w-[80ch] text-[16px] leading-relaxed text-muted-foreground lg:text-base">
            {meta.dek}
          </p>

          {/* Trust strip. One person writes these, so it names one person and
              links to the page that says what that does and doesn't qualify him
              for. Updated is separate from published on purpose. */}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-muted-foreground">
            <span>
              By{" "}
              <Link to="/about" className="font-medium text-foreground hover:underline">
                {AUTHOR_NAME}
              </Link>
            </span>
            <span aria-hidden>·</span>
            <span>{meta.readMinutes} min read</span>
            <span aria-hidden>·</span>
            <span>
              Published <time dateTime={meta.published}>{fmt(meta.published)}</time>
            </span>
            {meta.updated !== meta.published && (
              <>
                <span aria-hidden>·</span>
                <span>
                  Updated <time dateTime={meta.updated}>{fmt(meta.updated)}</time>
                </span>
              </>
            )}
          </div>

          {meta.hero && (
            <div className="mt-6 overflow-hidden rounded-xl bg-secondary/40 aspect-[1200/630] sm:max-w-[640px]">
              <img
                src={`/guides/${meta.slug}.webp`}
                alt={meta.hero.alt}
                width={2400}
                height={1260}
                sizes="(min-width: 640px) 640px, 100vw"
                className={`h-full w-full ${meta.hero.fill ? "object-cover" : "object-contain"}`}
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
            </div>
          )}
        </div>
      </header>

      {/* Body column plus a sticky rail. The rail is desktop only; on mobile the
          same list renders inline under the header, where a stuck element would
          eat a third of a phone screen. */}
      <main className="mx-auto grid w-full max-w-[1080px] flex-1 gap-10 px-5 pb-10 pt-2 lg:grid-cols-[minmax(0,1fr)_220px]">
        <article className="order-2 lg:order-1">
          <div className="mt-4 border-y border-border py-4 lg:hidden">
            <TableOfContents toc={meta.toc} />
          </div>
          <Body />

          {(exercises.length > 0 || allIndexed) && (
            <section className="mt-12" aria-labelledby="guide-exercises-heading">
              <h2 id="guide-exercises-heading" className="text-lg font-bold tracking-tight">
                Exercises in this guide
              </h2>
              {exercises.length > 0 && (
                <ul className="mt-3 p-0">
                  {exercises.map((ex) => (
                    <li key={ex.slug} className="border-b border-border">
                      <Link
                        to="/exercises/$slug"
                        params={{ slug: ex.slug }}
                        className="flex items-center gap-3 py-3 text-[16px]"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{ex.name}</span>
                          {ex.equipment && (
                            <span className="mt-0.5 block text-[15px] text-muted-foreground">
                              {formatEquipmentLabel(ex.equipment)}
                            </span>
                          )}
                        </span>
                        <span aria-hidden className="text-muted-foreground">
                          ›
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {more && (
                <Link
                  to="/exercises/$slug"
                  params={{ slug: more.hub }}
                  className="mt-4 inline-block text-[15px] font-semibold text-primary underline-offset-4 hover:underline"
                >
                  See all {more.total} {more.label} exercises
                </Link>
              )}
              {allIndexed && (
                <p className="mt-3 text-[16px] leading-relaxed text-muted-foreground">
                  Every exercise with a starting weight is on the{" "}
                  <Link
                    to="/exercises/all"
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    A to Z exercise list
                  </Link>
                  .
                </p>
              )}
            </section>
          )}

          <section className="mt-12 rounded-xl border border-border bg-secondary/40 p-5 sm:p-6 lg:px-5">
            <h2 className="text-lg font-bold tracking-tight">A free workout tracker for your phone</h2>
            <p className="mt-2 lg:max-w-[72ch] text-[16px] leading-relaxed text-muted-foreground">
              LiftCamp remembers every set you log, so next week it shows you
              what you lifted last time and you pick the weight in 2 seconds.
              Free on iPhone.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <AppStoreBadge tone="black" height={48} campaign="guide" />
              <Link
                to="/exercises"
                className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-[15px] font-medium transition-colors hover:border-primary"
              >
                Browse the exercise library
              </Link>
            </div>
            <AndroidNotify source="guide-detail" />
          </section>

          {related.length > 0 && (
            <section className="mt-10 border-t border-border pt-6">
              <h2 className="text-[15px] font-semibold">More guides</h2>
              <ul className="mt-3 p-0">
                {related.map((m) => (
                  <li key={m.slug} className="border-b border-border">
                    <Link
                      to="/guides/$slug"
                      params={{ slug: m.slug }}
                      className="flex items-center gap-3 py-3 text-[16px]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{m.title}</span>
                        <span className="mt-0.5 block text-[15px] text-muted-foreground">
                          {m.dek}
                        </span>
                      </span>
                      <span aria-hidden className="text-muted-foreground">
                        ›
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>

        <aside className="order-1 hidden lg:order-2 lg:block">
          <div className="lg:sticky lg:top-6">
            <TableOfContents toc={meta.toc} />
          </div>
        </aside>
      </main>

      <SiteFooter />
    </div>
  );
}
