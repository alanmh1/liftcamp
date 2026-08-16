import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TableOfContents } from "@/components/guides/TableOfContents";
import { getGuide, guideMetas } from "@/content/guides";
import { AUTHOR_NAME } from "@/lib/brand";

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
  loader: ({ params }) => {
    const guide = getGuide(params.slug);
    if (!guide) throw notFound();
    // Only the meta crosses the loader boundary. Body is a component, resolved
    // from the same registry inside the render.
    return { meta: guide.meta };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const m = loaderData.meta;
    const title = `${m.title} | LiftCamp`;
    const url = `${SITE}/guides/${m.slug}`;
    const meta = [
      { title },
      { name: "description", content: m.description },
      { property: "og:title", content: title },
      { property: "og:description", content: m.description },
      { property: "og:url", content: url },
      { property: "og:type", content: "article" },
    ];
    // A draft renders at its URL so it can be previewed, but must never be
    // indexed. Published guides carry no robots tag at all.
    if (m.draft) meta.push({ name: "robots", content: "noindex,nofollow" });

    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [
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
            author: { "@type": "Person", name: AUTHOR_NAME, url: `${SITE}/about` },
            publisher: { "@type": "Organization", name: "LiftCamp", url: SITE },
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
  const { meta } = Route.useLoaderData();
  const { session } = useAuth();
  const guide = getGuide(meta.slug);
  if (!guide) return null;
  const Body = guide.Body;
  const related = guideMetas().filter((m) => m.slug !== meta.slug).slice(0, 3);

  return (
    <div
      className="min-h-dvh bg-background flex flex-col pb-24"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <CatalogHeader />

      <header className="mx-auto w-full max-w-[1080px] px-5 pt-6 sm:pt-10">
        <nav aria-label="Breadcrumb" className="text-[13px] text-muted-foreground">
          <Link to="/guides" className="hover:underline">
            Guides
          </Link>
          <span aria-hidden className="px-1.5">
            ›
          </span>
          <span aria-current="page">{meta.title}</span>
        </nav>

        <h1 className="mt-2 max-w-[20ch] text-3xl font-bold tracking-tight lg:text-4xl">
          {meta.title}
        </h1>
        <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground lg:text-base">
          {meta.dek}
        </p>

        {/* Trust strip. One person writes these, so it names one person and
            links to the page that says what that does and doesn't qualify him
            for. Updated is separate from published on purpose. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
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

          <section className="mt-12 rounded-xl border border-border bg-secondary/40 p-5 sm:p-6">
            <h2 className="text-lg font-bold tracking-tight">Track it, so next week is easy</h2>
            <p className="mt-2 max-w-[58ch] text-[15px] leading-relaxed text-muted-foreground">
              The whole method above depends on remembering what you lifted last
              time. LiftCamp is free and does that part for you.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to="/exercises"
                className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:border-primary"
              >
                Browse the exercise library
              </Link>
              <Link
                to="/login"
                search={{ mode: "signup" }}
                className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                Create a free account
              </Link>
            </div>
          </section>

          {related.length > 0 && (
            <section className="mt-10 border-t border-border pt-6">
              <h2 className="text-sm font-semibold">More guides</h2>
              <ul className="mt-3 p-0">
                {related.map((m) => (
                  <li key={m.slug} className="border-b border-border">
                    <Link
                      to="/guides/$slug"
                      params={{ slug: m.slug }}
                      className="flex items-center gap-3 py-3 text-[15px]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{m.title}</span>
                        <span className="mt-0.5 block text-[13px] text-muted-foreground">
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

      {!session && <SiteFooter />}
      {session && <BottomNav />}
    </div>
  );
}
