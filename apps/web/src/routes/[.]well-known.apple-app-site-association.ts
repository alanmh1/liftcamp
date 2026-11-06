import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { appleAppSiteAssociation } from "@/lib/apple-app-site-association";

// A route and not a file in public/: the path has no extension, so a static
// file would not be served as application/json. Apple's CDN fetches this from
// the apex with no redirects, which is why applinks names liftcamp.app.
export const Route = createFileRoute("/.well-known/apple-app-site-association")({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify(appleAppSiteAssociation()), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
