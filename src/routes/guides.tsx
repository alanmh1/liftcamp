import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { guideMetas } from "@/content/guides";
import { REGIONS, REGION_META } from "@/lib/muscle-regions";

const SITE = "https://liftcamp.app";

export const Route = createFileRoute("/guides")({
  head: () => {
    const title = "Strength Training Guides for Beginners | LiftCamp";
    const description =
      "Plain guides to starting out: what weight to lift, what to do first, and what to swap when the gym is busy. Written for people new to lifting.";
    const url = `${SITE}/guides`;
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
              { "@type": "ListItem", position: 1, name: "LiftCamp", item: SITE },
              { "@type": "ListItem", position: 2, name: "Guides" },
            ],
          }),
        },
      ],
    };
  },
  component: GuidesHub,
});

function GuidesHub() {
  const { session } = useAuth();
  const metas = guideMetas();
  const [featured, ...rest] = metas;

  return (
    <div
      className="min-h-dvh bg-background flex flex-col pb-24"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <CatalogHeader />

      <header className="mx-auto w-full max-w-[1080px] px-5 pt-6 pb-2 sm:pt-10">
        <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">
          Strength training guides
        </h1>
        {/* Original framing, not a list of links. This paragraph is the only
            thing on the hub a search engine can weigh. */}
        <div className="mt-3 max-w-[62ch] text-[16px] leading-relaxed text-muted-foreground lg:text-base">
          <p>
            These are written for someone in their first few months of lifting, by
            someone who has been the person standing in a gym unsure which machine
            to use. Each one answers a question directly at the top, then explains
            the reasoning underneath.
          </p>
          <p className="mt-3">
            No supplement recommendations, no fat-burning claims, no thirty-item
            listicles. Just what to do on Monday and how to know it worked.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1080px] flex-1 px-5 pb-10 pt-4">
        {featured && (
          <Link
            to="/guides/$slug"
            params={{ slug: featured.slug }}
            className="block rounded-xl border border-border bg-secondary/40 p-5 transition-colors hover:border-primary sm:p-7"
          >
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {featured.category}
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
              {featured.title}
            </h2>
            <p className="mt-2 max-w-[62ch] text-[16px] leading-relaxed text-muted-foreground lg:text-base">
              {featured.dek}
            </p>
            <p className="mt-3 font-mono text-[13px] text-muted-foreground">
              {featured.readMinutes} min read
            </p>
          </Link>
        )}

        {rest.length > 0 && (
          <ul className="mt-6 grid gap-4 p-0 sm:grid-cols-2">
            {rest.map((m) => (
              <li key={m.slug}>
                <Link
                  to="/guides/$slug"
                  params={{ slug: m.slug }}
                  className="flex h-full flex-col rounded-xl border border-border p-5 transition-colors hover:border-primary"
                >
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {m.category}
                  </p>
                  <h2 className="mt-1 text-lg font-bold tracking-tight">{m.title}</h2>
                  <p className="mt-2 flex-1 text-[16px] leading-relaxed text-muted-foreground">
                    {m.dek}
                  </p>
                  <p className="mt-3 font-mono text-[13px] text-muted-foreground">
                    {m.readMinutes} min read
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* Passes link equity down into the six region pages, which are the
            catalog's only indexable list pages. */}
        <section className="mt-12 border-t border-border pt-6">
          <h2 className="text-[15px] font-semibold">Browse exercises by muscle</h2>
          <ul className="mt-3 flex flex-wrap gap-2 p-0">
            {REGIONS.map((r) => (
              <li key={r}>
                <Link
                  to="/exercises/$slug"
                  params={{ slug: r }}
                  className="inline-flex rounded-full border border-border px-3.5 py-2 text-[15px] font-medium transition-colors hover:border-primary lg:text-[15px]"
                >
                  {REGION_META[r].h1}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>

      {!session && <SiteFooter />}
      {session && <BottomNav />}
    </div>
  );
}
