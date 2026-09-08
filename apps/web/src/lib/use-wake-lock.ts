import { useEffect, useRef } from "react";

/**
 * Holds a Screen Wake Lock while `active` is true, so the display does not
 * auto-sleep.
 *
 * WHY THIS EXISTS
 * ---------------
 * The rest timer is now accurate across a screen lock, but accuracy is not the
 * same as reaching the user. The web has no reliable scheduled local
 * notification, so if the screen sleeps mid-rest, nothing tells you rest is
 * over -- you have to pick the phone up and look. Keeping the display awake for
 * the duration of the rest is the only mechanism the platform actually gives us.
 *
 * WHAT IT CANNOT DO
 * -----------------
 * A wake lock prevents the *automatic* sleep timeout. It does not stop a user
 * pressing the power button, and the browser releases the lock whenever the
 * document becomes hidden. That is why this re-acquires on `visibilitychange`
 * rather than assuming one request lasts.
 *
 * It is also refused in some states -- low power mode, unsupported browsers
 * (Safari below 16.4), or a restrictive permissions policy. Every failure path
 * here is silent: the timer keeps working, it just cannot hold the screen on.
 */

type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
};

export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || typeof document === "undefined") return;
    const wakeLock = (navigator as WakeLockNavigator).wakeLock;
    if (!wakeLock) return;

    let cancelled = false;

    const release = () => {
      const s = sentinelRef.current;
      sentinelRef.current = null;
      if (s && !s.released) void s.release().catch(() => {});
    };

    const acquire = async () => {
      if (cancelled || !active) return;
      if (document.visibilityState !== "visible") return;
      if (sentinelRef.current && !sentinelRef.current.released) return;
      try {
        const s = await wakeLock.request("screen");
        // The effect may have torn down while the request was in flight.
        if (cancelled || !active) {
          void s.release().catch(() => {});
          return;
        }
        sentinelRef.current = s;
      } catch {
        // Denied (low power mode, policy) or unsupported. Nothing to do.
      }
    };

    if (active) void acquire();
    else release();

    // The lock is dropped by the browser every time the page hides, so it has
    // to be taken again on return rather than requested once.
    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      release();
    };
  }, [active]);
}
