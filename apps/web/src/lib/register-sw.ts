// Registers /public/sw.js. Client-only and entirely best-effort: if anything
// here fails, the app runs exactly as it does today, just without offline
// fallback or asset caching.
//
// Registration is deferred to the `load` event so it never competes with the
// first render for bandwidth.
//
// Deliberately no auto-update prompt. The worker does not call skipWaiting, so
// a new version activates on the next cold launch. Reloading the page while
// someone is mid-set to deliver an update would be a worse bug than the one
// being fixed.

export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  // Lovable preview/sandbox origins churn deployments; a stale worker there is
  // more confusing than helpful.
  if (import.meta.env?.DEV) return;

  const register = () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* unsupported, blocked by policy, or insecure origin — ignore */
    });
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
