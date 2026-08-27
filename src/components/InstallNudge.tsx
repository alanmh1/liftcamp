import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { detect } from "@/components/AddToHomeScreen";

const DISMISS_KEY = "liftcamp.install.dismissed.v1";

/**
 * On iOS Safari the browser's own bottom bar never fully disappears, and it
 * tints itself from the page colour at the bottom edge — so it reads as extra
 * app chrome. A home-screen install removes it completely.
 *
 * The warning matters: iOS gives a home-screen web app its own storage
 * partition, so a session created in Safari does not carry into the installed
 * app. Someone signed in here will land logged out on first open.
 */
export function InstallNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      return;
    }
    if (detect() === "safari") setShow(true);
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode — hide for this session only */
    }
    setShow(false);
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-sm font-semibold leading-tight">
            Add LiftCamp to your Home Screen
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Safari's address bar takes up the bottom of every screen. Installing
            gets rid of it.
          </p>
          <ol className="mt-3 list-decimal pl-4 text-[13px] leading-relaxed text-muted-foreground">
            <li>Tap the 3 dots at the bottom right of Safari.</li>
            <li>Tap Share, then View More.</li>
            <li>Choose Add to Home Screen.</li>
          </ol>
          <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
            You'll sign in again the first time you open it — iOS keeps the
            installed app's login separate from Safari's.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
