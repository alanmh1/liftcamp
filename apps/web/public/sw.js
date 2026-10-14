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
// 1. Installability and fast repeat loads (precached shell + asset SWR).
// 2. An offline app launch: the last successfully served document for a URL is
//    kept in a separate cache and replayed ONLY when the network fails.
//
// Set logging itself is not handled here. Writes go through the client-side
// outbox in src/lib/offline-queue.ts, and reads come from the persisted React
// Query cache, both of which survive a cold start without the SW's help.
//
// STALE-SHELL SAFEGUARD
// ---------------------
// Documents are SSR'd with the signed-in session, so a replayed document could
// briefly show a signed-in shell after sign-out. The app posts CLEAR_PAGES on
// sign-out, which empties the document cache.

// v3: Outfit is self-hosted, and the offline card's fonts are precached.
// The bump also drops Google Fonts responses cached by earlier versions.
// v4: the icons are redrawn from the iOS app icon, same file names.
const VERSION = "v4";
const SHELL = `liftcamp-shell-${VERSION}`;
const ASSETS = `liftcamp-assets-${VERSION}`;
const PAGES = `liftcamp-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";

// The three Outfit weights offline.html uses, so the card renders in the app's
// type with no connection. Stable copies in /public/fonts; the app itself gets
// Outfit from @fontsource/outfit through styles.css.
const PRECACHE = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/favicon-48.png",
  "/manifest.webmanifest",
  "/fonts/outfit-latin-400.woff2",
  "/fonts/outfit-latin-600.woff2",
  "/fonts/outfit-latin-700.woff2",
];

const KEEP = new Set([SHELL, ASSETS, PAGES]);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)));
  // NOTE: no skipWaiting(). A new worker taking over mid-session could reload
  // the page underneath someone logging a set. The update lands on next launch.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  // Let the page trigger an update explicitly without doing it unprompted.
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data === "CLEAR_PAGES") event.waitUntil(caches.delete(PAGES));
});

const isAsset = (url) =>
  /\.(?:js|mjs|css|woff2?|png|jpe?g|svg|gif|webp|avif|ico)$/i.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Navigations: network first, then the last good copy of this page, then the
  // offline card. Never served from cache while the network is reachable.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res && res.ok && sameOrigin) {
            const copy = res.clone();
            event.waitUntil(caches.open(PAGES).then((c) => c.put(req.url, copy)));
          }
          return res;
        } catch {
          const cached = await caches.match(req.url, { cacheName: PAGES });
          return cached || (await caches.match(OFFLINE_URL));
        }
      })(),
    );
    return;
  }

  if (!sameOrigin || !isAsset(url)) return;

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
