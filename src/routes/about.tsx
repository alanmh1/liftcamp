import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteFooter";
import alanPhoto from "@/assets/alan.jpg.asset.json";

const PHOTO_URL = `https://liftcamp.app${alanPhoto.url}`;


/**
 * /about — the credibility page. Frames 6a/6b: article type scale at a 660px
 * measure, no rail, no photo, no card treatment. The page is prose and nothing
 * else on purpose; a bio wrapped in a card reads like a product feature.
 *
 * Copy is authored, not generated. Do not "improve" it — the plainness about
 * having no certifications is the point of the page.
 */

/** Public contact address. */
const EMAIL = "hello@liftcamp.app";

/**
 * TODO(alan): GitHub / X / wherever you're real. Left empty rather than
 * guessed — sameAs pointing at profiles that aren't yours is worse than
 * omitting the property, so the JSON-LD drops it while this is empty.
 */
const SAME_AS: string[] = [];

const DESCRIPTION =
  "LiftCamp is written by one person who lifts, not a coach or a physio. What that means for the guides, and what to see a doctor about instead.";

export const Route = createFileRoute("/about")({
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
  return (
    <div
      className="min-h-dvh bg-[#FBF9F6] text-[#1F1D1A]"
      style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      <main className="mx-auto w-full max-w-[660px] px-5 pb-16 pt-8 md:pt-12">
        <Link
          to="/"
          className="text-[15px] text-[#544D44] underline-offset-4 hover:underline"
        >
          ← LiftCamp
        </Link>

        <h1 className="mt-8 text-[clamp(30px,5vw,42px)] font-extrabold leading-[1.08] tracking-[-.03em]">
          Who writes this
        </h1>

        <div className="mt-6 flex items-start gap-5">
          <img
            src={alanPhoto.url}
            alt="Alan, who writes LiftCamp"
            width={96}
            height={96}
            loading="lazy"
            className="h-24 w-24 shrink-0 rounded-full object-cover object-[35%_25%]"
          />
          {/* Lead: 20px desktop, then standard body from here down. */}
          <p className="text-[18px] leading-[1.6] text-[#3B362F] md:text-[20px] md:leading-[1.55]">
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
          kid has 886 exercise pages up. I'm not a coach, a personal trainer, or
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
          is why there aren't 886.
        </Body>

        <Body>
          If something here is wrong, tell me and I'll fix it:{" "}
          <a
            href={`mailto:${EMAIL}`}
            className="underline underline-offset-4"
          >
            {EMAIL}
          </a>
          .
        </Body>
      </main>

      <SiteFooter />
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-11 text-[clamp(21px,2.6vw,26px)] font-bold leading-[1.2] tracking-[-.02em]">
      {children}
    </h2>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 text-[18px] leading-[1.65] text-[#3B362F]">{children}</p>
  );
}
