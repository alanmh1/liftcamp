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
import { trackPageView } from "@/lib/pageviews";


import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";


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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
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
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      // Chalk background, not the old Ember #0E0F12 -- a stale theme-color paints
      // the standalone status bar near-black against a cream app.
      { name: "theme-color", content: "#FDFCFB", media: "(prefers-color-scheme: light)" },
      { name: "theme-color", content: "#16151A", media: "(prefers-color-scheme: dark)" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "application-name", content: "LiftCamp" },
      { name: "apple-mobile-web-app-title", content: "LiftCamp" },
      { title: "LiftCamp" },
      { name: "description", content: "Log workouts fast, track sets and PRs, and know exactly what to lift next — a simple strength-training tracker built for the gym." },
      { property: "og:title", content: "LiftCamp" },
      { property: "og:description", content: "Log workouts fast, track sets and PRs, and know exactly what to lift next — a simple strength-training tracker built for the gym." },
      { property: "og:image", content: "https://liftcamp.app/og-image.png" },
      { name: "twitter:image", content: "https://liftcamp.app/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
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
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap" },

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

function AuthCacheInvalidator() {
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
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

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AuthCacheInvalidator />
          <div className="mx-auto w-full max-w-[480px]">
            <Outlet />
          </div>
          <Toaster position="top-center" />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

