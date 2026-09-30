import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AppStoreBadge } from "@/components/AppStoreBadge";
import { isIOSDevice } from "@/lib/ios";

const DISMISS_KEY = "liftcamp.appstore.dismissed.v1";

/**
 * On iPhone and iPad, points at the native app. This used to walk Safari
 * users through Add to Home Screen; the App Store app replaces that, so it
 * shows in every iOS browser and in the installed web app too, since those
 * are the people most likely to want it. Android and desktop see nothing.
 */
export function InstallNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      return;
    }
    if (isIOSDevice()) setShow(true);
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode: hide for this session only */
    }
    setShow(false);
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-sm font-semibold leading-tight">Get the iPhone app</h3>
          <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
            LiftCamp is on the App Store. Sign in with the same account and your
            workouts are there.
          </p>
          <AppStoreBadge className="mt-3" height={44} />
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss App Store prompt"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
