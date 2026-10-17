// LiftCamp service worker kill switch.
//
// The web app used to be an installable PWA with a caching service worker at
// this URL. That app was removed on 17 Oct 2026; the site is now plain pages
// with no offline mode. Browsers that installed the old worker keep running it
// until they fetch a new script from the same URL, so this file has to stay
// deployed at /sw.js for months. Nothing registers it any more.
//
// On activate it deletes every cache the old worker made, unregisters itself
// and reloads each open window, so the next load comes from the network with
// no worker in the way. There is deliberately no fetch handler.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: "window" });
      await Promise.all(windows.map((client) => client.navigate(client.url)));
    })(),
  );
});
