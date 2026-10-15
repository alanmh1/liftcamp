import { useEffect, type RefObject } from "react";

/**
 * Marks each [data-reveal-section] inside `root` with data-revealed="true" the first time it
 * enters the viewport, then stops watching it, so scrolling back up never replays it.
 * Skipped entirely when the user prefers reduced motion.
 */
export function useRevealOnScroll(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-revealed", "true");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0, rootMargin: "0px 0px -15% 0px" },
    );

    el.querySelectorAll("[data-reveal-section]:not([data-revealed])").forEach((section) =>
      observer.observe(section),
    );
    el.setAttribute("data-motion", "ready");

    return () => observer.disconnect();
  }, [root]);
}
