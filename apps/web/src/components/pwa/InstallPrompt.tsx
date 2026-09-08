import { usePwaInstall } from "@/hooks/usePwaInstall";

/** iOS share glyph, rendered at text size in the surrounding text colour. */
function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-label="Share"
      role="img"
      className="mx-1 inline-block h-[1.05em] w-[1.05em] -translate-y-[1px] align-middle"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15V3" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

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
          <h3 className="text-sm font-semibold leading-tight">
            Add LiftCamp to your home screen
          </h3>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-[15px] leading-relaxed text-muted-foreground">
            <li>
              Tap the share button
              <ShareIcon />
            </li>
            <li>Tap "View More" if you don't see "Add to Home Screen" straight away</li>
            <li>Tap "Add to Home Screen"</li>
          </ol>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            You'll sign in once more the first time you open it.
          </p>
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
