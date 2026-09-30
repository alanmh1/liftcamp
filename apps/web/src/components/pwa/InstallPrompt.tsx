import { usePwaInstall } from "@/hooks/usePwaInstall";
import { AppStoreBadge } from "@/components/AppStoreBadge";

/**
 * A card, never a modal: it sits below the workout recap so it can't cover the
 * session the user just finished.
 */
export function InstallPrompt() {
  const { platform, canPrompt, promptInstall, dismiss, shouldShow } = usePwaInstall();

  if (!shouldShow) return null;

  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-4 text-left shadow-sm">
      {platform === "inAppBrowser" ? (
        <>
          <h3 className="text-sm font-semibold leading-tight">
            Open LiftCamp in your browser
          </h3>
          <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
            Tap the menu in the top corner and choose Open in browser, then you can add
            LiftCamp to your home screen.
          </p>
        </>
      ) : platform === "ios" ? (
        <>
          <h3 className="text-sm font-semibold leading-tight">Get the iPhone app</h3>
          <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
            LiftCamp is on the App Store. Sign in with the same account and this
            workout is there.
          </p>
          <AppStoreBadge className="mt-3" height={44} />
        </>
      ) : (
        <>
          <h3 className="text-sm font-semibold leading-tight">
            Add LiftCamp to your home screen
          </h3>
          <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
            One tap to open it, no app store needed.
          </p>
          {canPrompt && (
            <button
              type="button"
              onClick={() => void promptInstall()}
              className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Install
            </button>
          )}
        </>
      )}

      <button
        type="button"
        onClick={dismiss}
        className="mt-3 h-9 w-full rounded-lg text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Not now
      </button>
    </section>
  );
}
