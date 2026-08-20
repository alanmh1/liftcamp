import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

const TOUR_KEY = "liftcamp.tour.home.v1";

type TourStep = { target: string; title: string; body: string };

const STEPS: readonly TourStep[] = [
  {
    target: '[data-tour="start"]',
    title: "Start a workout",
    body: "Tap the gold pill any time to open an empty session and start logging sets.",
  },
  {
    target: '[data-tour="routines"]',
    title: "Or follow a routine",
    body: "Starter programs build the session for you — pick one and repeat it week to week.",
  },
  {
    target: '[data-tour="history"]',
    title: "History and progress",
    body: "Finished workouts land here, along with your charts and personal records.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

/**
 * A three-beat tour of the home screen, shown once per browser. Deliberately
 * dependency-free: it measures the real elements via data-tour attributes and
 * draws a cutout ring plus a tooltip, so it can never drift out of sync with a
 * cloned copy of the UI.
 */
export function GuidedTour({ enabled }: { enabled: boolean }) {
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (!enabled) return;
    try {
      if (localStorage.getItem(TOUR_KEY) === "1") return;
    } catch {
      return;
    }
    // Let the home screen finish its first paint before measuring.
    const t = setTimeout(() => setActive(true), 700);
    return () => clearTimeout(t);
  }, [enabled]);

  const measure = useCallback(() => {
    const step = STEPS[index];
    const el = step ? document.querySelector(step.target) : null;
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [index]);

  useLayoutEffect(() => {
    if (!active) return;
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, measure]);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {
      /* ignore */
    }
    setActive(false);
  }, []);

  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, finish]);

  if (!active || typeof document === "undefined") return null;

  const step = STEPS[index];
  const pad = 8;
  const ring = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  // Place the tooltip above the target when the target sits low on screen.
  const below = ring ? ring.top + ring.height + 12 : 0;
  const placeAbove = ring ? below + 170 > window.innerHeight : false;

  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={step.title}>
      <button
        type="button"
        aria-label="Skip tour"
        onClick={finish}
        className="absolute inset-0 h-full w-full cursor-default bg-foreground/60"
      />

      {ring && (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-pr"
          style={{
            top: ring.top,
            left: ring.left,
            width: ring.width,
            height: ring.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          }}
        />
      )}

      {/* bg-popover, not bg-card: the card token is intentionally transparent
          in this theme, which made the tour text unreadable over the dim. */}
      <div
        className="absolute left-1/2 z-10 w-[min(340px,calc(100vw-32px))] -translate-x-1/2 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-2xl"
        style={
          placeAbove && ring
            ? { top: Math.max(16, ring.top - 180) }
            : { top: ring ? below : 120 }
        }
      >
        <p className="text-base font-semibold tracking-tight">{step.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-popover-foreground/80">{step.body}</p>

        <div className="mt-3 flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {index + 1}/{STEPS.length}
          </span>
          <button
            type="button"
            onClick={finish}
            className="ml-auto h-9 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => (index === STEPS.length - 1 ? finish() : setIndex(index + 1))}
            className="h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {index === STEPS.length - 1 ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
