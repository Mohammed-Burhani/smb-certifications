// Service worker for the SMB Fittings Certification PWA.
//
// Scope: app-shell precaching + static-asset caching only. This file does not
// know anything about certificate data, IndexedDB, or sync queues — that is
// owned elsewhere. It only makes the app installable and resilient to flaky
// networks for the shell/static assets.

const CACHE_VERSION = "v1";
const SHELL_CACHE = `smb-cert-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `smb-cert-runtime-${CACHE_VERSION}`;

// Minimal app-shell precache. Kept small and same-origin only so install
// never fails because of an unrelated asset going missing.
const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf)$/.test(url.pathname))
  );
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    const shellCache = await caches.open(SHELL_CACHE);
    const shellFallback = await shellCache.match("/");
    if (shellFallback) return shellFallback;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  return cached || (await networkFetch) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle safe, same-origin GET requests. Everything else (Server
  // Actions POSTs, Supabase/cross-origin calls, etc.) passes straight
  // through to the network untouched.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept the service worker script itself.
  if (url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
});
