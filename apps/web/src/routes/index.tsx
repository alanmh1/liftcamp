import { createFileRoute } from "@tanstack/react-router";
import { OG_IMAGE_URL } from "@/lib/metadata-base";
import { Landing } from "@/components/Landing";
import { getExerciseCount } from "@/lib/public-catalog.functions";

export const Route = createFileRoute("/")({
  // The exercise count in the description is live data, not a constant — the
  // last hardcoded figure went stale within weeks.
  loader: async () => ({ exerciseCount: await getExerciseCount() }),
  head: ({ loaderData }) => {
    const count = loaderData?.exerciseCount ?? 886;
    const title = "LiftCamp: Lifting Programs and Workout Log for iPhone";
    const description = `Pick a lifting program, log sets in a tap, and learn ${count} exercises step by step. Built for beginners, with room to grow. Free on the App Store for iPhone.`;
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
    };
  },
  component: Index,
});

function Index() {
  return <Landing />;
}
