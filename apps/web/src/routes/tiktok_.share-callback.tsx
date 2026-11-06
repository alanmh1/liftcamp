import { createFileRoute } from "@tanstack/react-router";
import { ContentHero } from "@/components/content/ContentParts";

// TikTok returns here after a share. With the app installed the universal
// link opens LiftCamp and this page never shows; it is what a browser gets
// when iOS has not picked up the link. noindex: nothing here to find.
export const Route = createFileRoute("/tiktok_/share-callback")({
  head: () => ({
    meta: [{ title: "Back to LiftCamp" }, { name: "robots", content: "noindex" }],
  }),
  component: TikTokShareCallbackPage,
});

function TikTokShareCallbackPage() {
  return (
    <main>
      <ContentHero h1="You're done in TikTok" lead="Open LiftCamp to get back to your training." />
      <div className="mx-auto w-full max-w-[1080px] px-4 pb-12 sm:px-5">
        <a
          href="liftcamp://"
          className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-6 text-base font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
        >
          Open LiftCamp
        </a>
      </div>
    </main>
  );
}
