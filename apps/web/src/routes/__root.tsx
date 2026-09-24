import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { registerServiceWorker } from "@/lib/register-sw";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { trackPageView, SESSION_TIMEOUT_MS } from "@/lib/pageviews";


import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { startQueryPersistence, clearPersistedQueryCache } from "@/lib/persist-query-cache";
import { OfflineBanner } from "@/components/OfflineBanner";
import { TrialLogClaimer } from "@/components/TrialLogClaimer";
import { SharedRoutineClaimer } from "@/components/SharedRoutineClaimer";
import { DraftRoutineClaimer } from "@/components/DraftRoutineClaimer";


function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-bold tracking-tight">404</h1>
        <p className="mt-3 text-sm text-muted-foreground">Page not found.</p>
        <Link to="/" className="mt-6 inline-block text-sm underline">Home</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">Something broke.</h1>
        <p className="mt-2 text-sm text-muted-foreground">Try again or head home.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <a href="/" className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium">
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      // One entry only: meta dedupes by name, so a second theme-color silently
      // replaced the first. Chalk paper is the right default because the theme
      // is a stored class on <html>, not a media query, and prefers-color-scheme
      // does not know which the user picked.
      { name: "theme-color", content: "#FDFCFB" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "application-name", content: "LiftCamp" },
      { name: "apple-mobile-web-app-title", content: "LiftCamp" },
      { title: "LiftCamp" },
      { name: "description", content: "Log workouts fast, track sets and PRs, and know exactly what to lift next. A simple strength-training tracker built for the gym." },
      { property: "og:title", content: "LiftCamp" },
      { property: "og:description", content: "Log workouts fast, track sets and PRs, and know exactly what to lift next. A simple strength-training tracker built for the gym." },
      { property: "og:image", content: "https://liftcamp.app/og-image.png" },
      { name: "twitter:image", content: "https://liftcamp.app/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    scripts: [
      // One sitewide entity definition, so "what is LiftCamp" gets the same
      // answer everywhere — this matches the sentence in the footer.
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "LiftCamp",
          url: "https://liftcamp.app",
          logo: "https://liftcamp.app/icons/icon-512.png",
          description:
            "LiftCamp is a free workout tracker and exercise library for people in their first six months of lifting, written by one person who lifts.",
        }),
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      // iOS ignores the manifest icons and will screenshot the page without this.
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icons/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192.png" },

      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      // Outfit at the five weights the Tailwind classes use (font-normal through
      // font-extrabold). Numbers are Outfit too, with tabular figures where
      // they line up; see .num and .font-mono in styles.css.
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap",
      },

    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function PageViewTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    void trackPageView(pathname);
  }, [pathname]);

  useEffect(() => {
    let hiddenAt: number | null = null;
    const onChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt !== null && Date.now() - hiddenAt >= SESSION_TIMEOUT_MS) {
        void trackPageView(pathname);
      }
      hiddenAt = null;
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [pathname]);

  return null;
}

function NavProgress() {
  const isLoading = useRouterState({ select: (s) => s.isLoading });
  if (!isLoading) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-1 bg-transparent">
      <div className="h-full bg-primary animate-pulse" />
    </div>
  );
}

function AuthCacheInvalidator() {
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Signing out must not leave one account's rows readable offline, in the
      // persisted query cache or in a replayed SSR document.
      if (event === "SIGNED_OUT") {
        clearPersistedQueryCache();
        navigator.serviceWorker?.controller?.postMessage("CLEAR_PAGES");
      }
      router.invalidate();
      qc.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, qc]);
  return null;
}


function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Best-effort PWA registration; no-ops in dev and where unsupported.
  useEffect(() => {
    registerServiceWorker();
  }, []);

  // Offline reads: rehydrate the last online session's data on cold launch.
  useEffect(() => startQueryPersistence(queryClient), [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AuthCacheInvalidator />
          <TrialLogClaimer />
          <SharedRoutineClaimer />
          <DraftRoutineClaimer />
          <PageViewTracker />
          <NavProgress />
          <OfflineBanner />

          <div className="mx-auto w-full max-w-[480px]">
            <Outlet />
          </div>
          <Toaster position="top-center" />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
