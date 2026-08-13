import { useEffect, useState } from "react";
import { Share, Plus, Check } from "lucide-react";

/**
 * iOS-only "Add to Home Screen" hint for the login page.
 *
 * WHY THIS EXISTS
 * ---------------
 * On iOS a home-screen web app gets its own storage partition, separate from
 * Safari. A session created in Safari does NOT carry into the installed app, so
 * anyone who signs up first and installs later opens the icon to a logged-out
 * screen and reasonably concludes it is broken. Installing *before* signing in
 * means the session is created inside the standalone context, where it persists.
 *
 * WHY iOS ONLY
 * ------------
 * Android needs nothing: Chrome fires its own install prompt off the manifest.
 * Rendering generic instructions there would be noise at best and wrong at worst.
 *
 * WHY THE "OPEN IN SAFARI" BRANCH
 * -------------------------------
 * Links tapped inside the Reddit, Instagram, X, or Facebook apps open in an
 * embedded WKWebView whose share sheet has no Add to Home Screen item at all.
 * Since Reddit is the acquisition channel, this is the common case, not an edge
 * case. Showing share-sheet steps there sends people to a menu that cannot work.
 * There is no reliable way to hand a URL from a WKWebView to Safari, so the only
 * honest affordance is copy-the-link.
 */

type Mode = "hidden" | "safari" | "inAppBrowser";

function detect(): Mode {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "hidden";

  const ua = navigator.userAgent;

  // iPadOS 13+ reports as MacIntel; touch points disambiguate it from a desktop Mac.
  const isIOS =
    /iPhone|iPod|iPad/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIOS) return "hidden";

  // Already installed — nothing to advertise.
  const standalone =
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches;
  if (standalone) return "hidden";

  // Other iOS browsers are WebKit but expose no Add to Home Screen action.
  if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return "inAppBrowser";

  // Real Safari sends both a Version/ and a Safari/ token. Embedded WKWebViews
  // (Reddit, Instagram, Facebook, X) drop Version/, which is the cleanest signal
  // available without maintaining a per-app UA list.
  const isRealSafari = /Version\/[\d.]+.*Safari/.test(ua);
  return isRealSafari ? "safari" : "inAppBrowser";
}

export function AddToHomeScreen() {
  // Always "hidden" on the server so SSR markup matches the first client render;
  // the real value lands after hydration.
  const [mode, setMode] = useState<Mode>("hidden");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMode(detect());
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  if (mode === "hidden") return null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText("https://liftcamp.app/login");
      setCopied(true);
    } catch {
      /* clipboard blocked — the URL is visible in the address bar regardless */
    }
  }

  return (
    <details className="group mt-4 rounded-lg border border-border bg-card px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        Add LiftCamp to your home screen
        <span className="micro text-muted-foreground transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>

      {mode === "safari" ? (
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <Share className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>Tap the Share button in the toolbar.</span>
          </li>
          <li className="flex items-start gap-2">
            <Plus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>Scroll down and choose Add to Home Screen.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>Tap Add, then open LiftCamp from your home screen and sign in there.</span>
          </li>
        </ol>
      ) : (
        <div className="mt-3 text-sm text-muted-foreground">
          <p>
            You're in an in-app browser, which can't add to the home screen. Open
            liftcamp.app in Safari first, then use Share → Add to Home Screen.
          </p>
          <button
            type="button"
            onClick={copyLink}
            className="mt-3 h-10 w-full rounded-md border border-input bg-background text-sm font-semibold transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Signing in from the home screen app keeps you logged in there.
      </p>
    </details>
  );
}
