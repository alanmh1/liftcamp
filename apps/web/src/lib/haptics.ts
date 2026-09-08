// Small, best-effort haptic tap. Silently no-ops where the Vibration API is
// unavailable (iOS Safari, desktop) — the visual pulse carries the feedback there.
export function haptic(pattern: number | number[] = 12) {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  try {
    nav.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}
