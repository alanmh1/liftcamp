import { createFileRoute } from "@tanstack/react-router";
import { appStoreUrl } from "@liftcamp/shared";
import { OG_IMAGE_URL } from "@/lib/metadata-base";
import { ORGANIZATION_ID } from "@/lib/brand";
import { Landing } from "@/components/Landing";
import { getExerciseCount, getPublicRoutines } from "@/lib/public-catalog.functions";
import { getAppStoreRating } from "@/lib/app-store-rating.functions";

const SCREENSHOTS = [
  "01-home",
  "02-active-workout",
  "03-summary-trex",
  "04-exercise-info",
  "05-profile-prs",
].map((name) => `https://liftcamp.app/screenshots/${name}-540.webp`);

export const Route = createFileRoute("/")({
  // The exercise count in the description, the routine count in the stats
  // row and the App Store rating are live data, not constants: the last
  // hardcoded figures went stale within weeks.
  loader: async () => {
    const [exerciseCount, routines, rating] = await Promise.all([
      getExerciseCount(),
      getPublicRoutines(),
      getAppStoreRating(),
    ]);
    // getPublicRoutines lists only programs with a slug, so this is the
    // number of routines with a public page, the same set as the sitemap.
    return { exerciseCount, routineCount: routines.length, rating };
  },
  head: ({ loaderData }) => {
    const count = loaderData?.exerciseCount ?? 886;
    const title = "LiftCamp: Lifting Programs and Workout Log for iPhone";
    const description = `Pick a lifting program, log sets in a tap, and learn ${count} exercises step by step. Built for beginners, with room to grow. Free on the App Store for iPhone.`;
    const rating = loaderData?.rating ?? null;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: "https://liftcamp.app/" },
        { property: "og:image", content: OG_IMAGE_URL },
        { name: "twitter:image", content: OG_IMAGE_URL },
      ],
      links: [{ rel: "canonical", href: "https://liftcamp.app/" }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "LiftCamp",
            operatingSystem: "iOS",
            applicationCategory: "HealthApplication",
            url: "https://liftcamp.app",
            installUrl: appStoreUrl("schema"),
            offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
            description,
            screenshot: SCREENSHOTS,
            author: { "@id": ORGANIZATION_ID },
            // Only with a real App Store rating, which the reviews section
            // shows on the page from the same lookup.
            ...(rating
              ? {
                  aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: rating.average,
                    ratingCount: rating.count,
                    bestRating: 5,
                    worstRating: 1,
                  },
                }
              : {}),
          }),
        },
      ],
    };
  },
  component: Index,
});

function Index() {
  const { routineCount, rating } = Route.useLoaderData();
  return <Landing routineCount={routineCount} rating={rating} />;
}
