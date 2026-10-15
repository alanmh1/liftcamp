import { createFileRoute, Link } from "@tanstack/react-router";
import { APP_STORE_URL, appStoreUrl } from "@liftcamp/shared";
import { getInviteLanding } from "@/lib/invite.functions";
import { LOGO_MARK_SRC } from "@/lib/brand";

/** The site's share image, the one the root layout uses. 2400 × 1260. */
const SHARE_IMAGE = "https://liftcamp.app/og-image.png";

// An invite link: https://liftcamp.app/i/<code>, shared from the app. Shows
// who sent it, the code in large type for anyone who installs from the App
// Store (which loses the link) and types it in, and Open in LiftCamp through
// the app's scheme. Universal links need a native build, so the button is
// the way in for now. noindex: every invite is personal.
//
// The title, og tags and image make the link preview in Messages and other
// apps name the inviter. The image is the site's share image.
export const Route = createFileRoute("/i/$code")({
  loader: ({ params }) => getInviteLanding({ data: { code: params.code } }),
  head: ({ loaderData }) => {
    const username = loaderData?.username ?? null;
    const title = username ? `@${username} invited you to LiftCamp` : "You're invited to LiftCamp";
    const description = username
      ? `Train with @${username} on LiftCamp and follow each other's workouts. Open the invite in the app.`
      : "Follow each other's workouts on LiftCamp. Open the invite in the app.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:image", content: SHARE_IMAGE },
        { property: "og:image:width", content: "2400" },
        { property: "og:image:height", content: "1260" },
        { property: "og:image:alt", content: "LiftCamp" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: SHARE_IMAGE },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: InvitePage,
});

function InvitePage() {
  const { code, username } = Route.useLoaderData();

  if (!code) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl font-bold tracking-tight">This invite link doesn't work</h1>
        <p className="text-sm text-muted-foreground">
          Check that the whole link was copied, or ask your friend to send it again.
        </p>
        <Link to="/" className="text-sm font-semibold text-primary underline">
          Go to LiftCamp
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-12 pt-6">
      <div className="flex items-center gap-2">
        <img src={LOGO_MARK_SRC} alt="" className="h-7 w-7 rounded" />
        <span className="text-sm font-semibold tracking-tight">LiftCamp</span>
      </div>

      <h1 className="mt-10 text-2xl font-bold tracking-tight">
        {username ? `@${username} invited you to LiftCamp` : "You've been invited"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Follow each other's workouts. Each of you approves who follows you.
      </p>

      <div className="mt-8 rounded-lg border border-border bg-card px-4 py-5 text-center">
        <p className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
          Invite code
        </p>
        <p className="num mt-2 select-all text-4xl font-bold tracking-[0.2em]">{code}</p>
      </div>

      <a
        href={`liftcamp://invite/${code}`}
        className="mt-6 flex h-12 w-full items-center justify-center rounded-lg bg-primary text-base font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
      >
        Open in LiftCamp
      </a>

      <div className="mt-8 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">Don't have the app yet?</p>
        {APP_STORE_URL ? (
          <a
            href={appStoreUrl("invite")}
            className="mt-1 inline-block font-semibold text-primary underline"
          >
            Get LiftCamp on the App Store
          </a>
        ) : (
          <p className="mt-1">LiftCamp for iPhone is coming to the App Store soon.</p>
        )}
        <p className="mt-2">
          Once it's installed, come back to this page and tap Open in LiftCamp. You can also enter
          the code in Profile → Following.
        </p>
      </div>
    </div>
  );
}
