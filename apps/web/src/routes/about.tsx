import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteFooter";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { getCatalogIndex } from "@/lib/public-catalog.functions";
import alanPhoto from "@/assets/alan.jpg";
import { metadataUrl } from "@/lib/metadata-base";

const PHOTO_URL = metadataUrl(alanPhoto);


/**
 * /about: the credibility page. One reading column at a 62ch measure, the
 * photo beside the opening line, no rail. The page is prose and nothing else
 * on purpose; a bio wrapped in a card reads like a product feature.
 *
 * Copy is authored, not generated. Do not "improve" it. The plainness about
 * having no certifications is the point of the page.
 */

/** Public contact address. */
const EMAIL = "hello@liftcamp.app";

/**
 * TODO(alan): GitHub / X / wherever you're real. Left empty rather than
 * guessed. sameAs pointing at profiles that aren't yours is worse than
 * omitting the property, so the JSON-LD drops it while this is empty.
 */
const SAME_AS: string[] = [];

const DESCRIPTION =
  "LiftCamp is written by one person who lifts, not a coach or a physio. What that means for the guides, and what to see a doctor about instead.";

export const Route = createFileRoute("/about")({
  // Live exercise count for the two sentences that quote it; the hardcoded
  // 886 went stale. Shares the catalog cache with /exercises.
  loader: async () => ({ total: (await getCatalogIndex()).length }),
  head: () => ({
    meta: [
      { title: "About LiftCamp and Who Writes the Guides" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "About LiftCamp and Who Writes the Guides" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "profile" },
      { property: "og:url", content: "https://liftcamp.app/about" },
      { property: "og:image", content: PHOTO_URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: PHOTO_URL },

    ],
    links: [{ rel: "canonical", href: "https://liftcamp.app/about" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: "https://liftcamp.app/about",
          mainEntity: {
            "@type": "Person",
            name: "Alan",
            image: PHOTO_URL,

            url: "https://liftcamp.app/about",
            description:
              "Builds and writes LiftCamp on his own, in evenings and weekends.",
            ...(EMAIL.startsWith("[") ? {} : { email: `mailto:${EMAIL}` }),
            ...(SAME_AS.length > 0 ? { sameAs: SAME_AS } : {}),
            worksFor: {
              "@type": "Organization",
              name: "LiftCamp",
              url: "https://liftcamp.app",
            },
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "LiftCamp",
              item: "https://liftcamp.app",
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "About",
              item: "https://liftcamp.app/about",
            },
          ],
        }),
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const { total } = Route.useLoaderData();
  return (
    <div
      className="min-h-dvh bg-background text-foreground"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <CatalogHeader />

      <article className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-40 -top-48 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-32 top-40 h-72 w-72 rounded-full bg-pr/20 blur-3xl" />

        <div className="relative mx-auto max-w-[62ch] px-ds-lg pb-ds-3xl pt-ds-xl md:pt-ds-2xl">
          <h1 className="font-display text-5xl font-extrabold leading-none tracking-tight text-foreground md:text-6xl">
            Who writes this
          </h1>

          <div className="mt-ds-xl flex flex-col gap-ds-lg sm:flex-row sm:items-start">
            <figure className="m-0 flex shrink-0 flex-col items-center sm:w-24">
              <img
                src={alanPhoto}
                alt="Alan, who writes LiftCamp"
                width={96}
                height={96}
                loading="lazy"
                className="h-24 w-24 rounded-full object-cover object-[35%_25%] shadow-lg shadow-primary/10 ring-4 ring-background"
              />
              <figcaption className="mt-ds-sm whitespace-nowrap font-caption text-caption text-muted-foreground">
                Alan, Oakland
              </figcaption>
            </figure>
            <p className="font-body text-xl leading-relaxed text-foreground">
              I'm Alan. I build LiftCamp on my own, and I write every guide and
              every beginner note on the exercise pages.
            </p>
          </div>

          <Body>
            I work in tech, I'm a dad, and I've been lifting off and on for years.
            Mostly off, if I'm honest. The last stretch is the first one that's
            stuck.
          </Body>

          <Body>
            LiftCamp is a hobby. I built it in evenings and weekends using AI
            coding tools, which is the only reason one person with a day job and a
            kid has {total} exercise pages up. I'm not a coach, a personal trainer, or
            a physiotherapist. I have no certifications and I'm not going to imply
            otherwise by putting letters after my name.
          </Body>

          <H2>Why I write it anyway</H2>

          <Body>
            Because I've been the beginner more than once. Starting over after a
            year away is its own particular thing: you know roughly what a squat
            is, you have no idea what you can lift anymore, and every page you find
            tells you which muscle it works and nothing you actually need. What
            goes on the bar. What it feels like when you're doing it wrong. What to
            do when someone's on the machine you came for.
          </Body>

          <Body>
            That's what the beginner notes are. The three things I wanted written
            down, for the version of me who was standing there guessing.
          </Body>

          <H2>What I'm not qualified to tell you</H2>

          <Body>
            Anything about pain. If something hurts in a way that isn't ordinary
            soreness, I have no idea what's wrong and no business guessing. See a
            doctor or a physio. Same for training around an injury, anything
            involving a medical condition, pregnancy, medication, or a specific
            eating plan. Those need somebody who can look at you.
          </Body>

          <Body>
            I'd rather lose you to a physio's waiting room than have you take a
            starting weight off a website while your shoulder is telling you
            something.
          </Body>

          <H2>How the library gets written</H2>

          <Body>
            Most of the exercises come from an open dataset, checked by hand for
            names and muscle groups. A few I wrote myself, where the dataset had
            no entry for a machine that sits in most gyms. Beginner notes exist on
            about 40 so far. I add them as I go rather than generating them, which
            is why there aren't {total}.
          </Body>

          <p className="mt-ds-2xl rounded-lg border border-border bg-muted/70 px-ds-lg py-ds-md font-body text-body text-muted-foreground">
            If something here is wrong, tell me and I'll fix it:{" "}
            <a
              href={`mailto:${EMAIL}`}
              className="font-label text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
            >
              {EMAIL}
            </a>
            .
          </p>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-ds-2xl font-heading text-heading font-bold tracking-tight text-foreground">
      {children}
    </h2>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <p className="mt-ds-md font-body text-lg leading-8 text-foreground">{children}</p>;
}
