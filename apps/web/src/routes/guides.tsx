import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Dumbbell, Target } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { guideMetas } from "@/content/guides";
import { REGIONS, REGION_META } from "@/lib/muscle-regions";
import { FeaturedGuide } from "@/components/guides/FeaturedGuide";
import { GuideGroup, type GroupedGuide } from "@/components/guides/GuideGroup";
import { CLAY_SHAPES, type GuideTone } from "@/components/guides/ClayShape";

const GROUPS: { id: GuideTone; category: string; intro: string; icon: typeof BookOpen; iconClass: string }[] = [
  {
    id: "getting-started",
    category: "Getting started",
    intro: "The questions everyone has in month one and nobody wants to ask out loud.",
    icon: BookOpen,
    iconClass: "bg-pr text-pr-foreground",
  },
  {
    id: "programming",
    category: "Programming",
    intro: "What to do each day, and how to add weight without guessing.",
    icon: Target,
    iconClass: "bg-primary text-primary-foreground",
  },
  {
    id: "technique",
    category: "Technique",
    intro:
      "When a lift hurts or feels off, the fix is usually a small setup change. These show the change.",
    icon: Dumbbell,
    iconClass: "bg-tip text-background",
  },
];

const chip =
  "inline-flex items-center gap-ds-xs rounded-full border border-border bg-background px-ds-md py-ds-sm font-label text-label text-foreground hover:border-primary hover:text-primary";

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
  // Clay illustrations cycle through the six shapes in display order.
  const shaped: GroupedGuide[] = rest.map((m, i) => ({
    ...m,
    shape: CLAY_SHAPES[i % CLAY_SHAPES.length]!,
  }));

  return (
    <div
      className="min-h-dvh bg-background flex flex-col pb-28"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <CatalogHeader />

      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-40 -top-48 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-pr/25 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-ds-xl px-ds-lg pb-ds-xl pt-ds-xl md:pt-ds-2xl lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
          <div>
            <h1 className="font-display text-5xl font-extrabold leading-none tracking-tight text-foreground md:text-display">
              Strength training guides
            </h1>
            {/* Original framing, not a list of links. This paragraph is the only
                thing on the hub a search engine can weigh. */}
            <p className="mt-ds-md max-w-2xl font-body text-xl leading-relaxed text-muted-foreground">
              These are written for someone in their first few months of lifting, by
              someone who has been the person standing in a gym unsure which machine
              to use. Each one answers a question directly at the top, then explains
              the reasoning underneath.
            </p>
            <p className="mt-ds-sm max-w-2xl font-body text-xl leading-relaxed text-muted-foreground">
              Each one tells you what to do on Monday and how to know it worked.
              Where a guide mentions an exercise, it links to a page with photos of
              the movement and a starting weight.
            </p>
          </div>

          <nav
            aria-label="Guide categories"
            className="rounded-xl border border-border bg-background p-ds-md shadow-lg shadow-primary/5"
          >
            <p className="px-ds-sm font-caption text-caption uppercase tracking-wider text-muted-foreground">
              Jump to
            </p>
            <ul className="mt-ds-xs grid gap-ds-xs p-0">
              {GROUPS.map((g) => (
                <li key={g.id}>
                  <a
                    href={`#${g.id}`}
                    className="flex items-center gap-ds-sm rounded-md px-ds-sm py-ds-sm font-label text-label text-foreground hover:bg-muted hover:text-primary"
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-md ${g.iconClass}`}
                    >
                      <g.icon className="h-4 w-4" />
                    </span>
                    {g.category}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {featured && <FeaturedGuide guide={featured} />}

        {GROUPS.map((g) => (
          <GuideGroup
            key={g.id}
            id={g.id}
            heading={g.category}
            intro={g.intro}
            guides={shaped.filter((m) => m.category === g.category)}
          />
        ))}

        {/* Passes link equity down into the six region pages, which are the
            catalog's only indexable list pages. */}
        <section
          aria-labelledby="muscle-heading"
          className="border-t border-border bg-muted/60 py-ds-2xl"
        >
          <div className="mx-auto max-w-7xl px-ds-lg">
            <h2
              id="muscle-heading"
              className="font-heading text-3xl font-extrabold tracking-tight text-foreground"
            >
              Browse exercises by muscle
            </h2>
            <ul className="mt-ds-md flex flex-wrap gap-ds-sm p-0">
              {REGIONS.map((r) => (
                <li key={r}>
                  <Link to="/exercises/$slug" params={{ slug: r }} className={chip}>
                    {REGION_META[r].h1}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      {!session && <SiteFooter />}
      {session && <BottomNav />}
    </div>
  );
}
