// LiftCamp service worker — hand-written, deliberately.
//
// vite-plugin-pwa is NOT used here: vite.config.ts warns that
// @lovable.dev/vite-tanstack-config already owns the plugin list and adding
// plugins manually breaks the build with duplicates. A static SW in /public
// sidesteps that entirely, and at this size Workbox would be more machinery
// than the problem needs.
//
// SCOPE OF THIS FILE
// ------------------
// It makes the app installable and makes repeat loads fast. It does NOT make
// the app usable offline -- that needs a mutation queue so sets logged without
// signal survive, which is separate work. Until then, a failed navigation gets
// an honest offline page rather than a browser error.
//
// HTML IS NEVER CACHED. The app is SSR'd with an authenticated session, so a
// cached document could render a stale signed-in shell after sign-out. Only
// static assets and the offline fallback are stored.

const VERSION = "v1";
const SHELL = `liftcamp-shell-${VERSION}`;
const ASSETS = `liftcamp-assets-${VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/favicon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)));
  // NOTE: no skipWaiting(). A new worker taking over mid-session could reload
  // the page underneath someone logging a set. The update lands on next launch.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// Let the page trigger an update explicitly (e.g. from a Profile "check for
// updates" action) without doing it unprompted.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

const isAsset = (url) =>
  /\.(?:js|mjs|css|woff2?|png|jpe?g|svg|gif|webp|avif|ico)$/i.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Supabase, and anything else that isn't a static asset or a page, passes
  // straight through. Caching API reads here would fight TanStack Query.
  const sameOrigin = url.origin === self.location.origin;
  const isFontCdn = /(?:fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname);

  // Navigations: always network, fall back to the offline page. Never stored.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (!sameOrigin && !isFontCdn) return;
  if (sameOrigin && !isAsset(url)) return;

  // Assets: stale-while-revalidate. Hashed filenames make this safe, and the
  // unhashed ones (icons, favicon) change rarely enough that a one-load delay
  // is fine.
  event.respondWith(
    caches.open(ASSETS).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
