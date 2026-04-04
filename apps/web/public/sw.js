// @ts-nocheck
// Sweet & Spicy — Service Worker (hand-written, no Workbox)
// ─────────────────────────────────────────────────────────

/* ---------- Constants ---------- */

/** Bump this when deploying a new version to bust old caches. */
const SW_CACHE_VERSION = 1;

const STATIC_CACHE_NAME = `sweet-spicy-static-v${SW_CACHE_VERSION}`;
const API_CACHE_NAME = `sweet-spicy-api-v${SW_CACHE_VERSION}`;
const OFFLINE_CACHE_NAME = `sweet-spicy-offline-v${SW_CACHE_VERSION}`;

const OFFLINE_PAGE = "/offline.html";

/** All versioned cache names owned by this SW. */
const EXPECTED_CACHES = [STATIC_CACHE_NAME, API_CACHE_NAME, OFFLINE_CACHE_NAME];

/* ---------- URL matchers ---------- */

/**
 * Returns `true` for static assets that benefit from cache-first:
 * Next.js bundles, CSS, game card art, fonts, and PWA icons.
 */
function isStaticAsset(url) {
  const { pathname } = url;
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/game/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/fonts/") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".woff2") ||
    pathname.endsWith(".woff") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".svg")
  );
}

/** Returns `true` for API requests that use network-first. */
function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

/** Returns `true` for Socket.IO transport — always network-only. */
function isSocketRequest(url) {
  return url.pathname.startsWith("/socket.io/");
}

/** Returns `true` for navigation requests (HTML pages). */
function isNavigationRequest(request) {
  return request.mode === "navigate";
}

/* ---------- Install ---------- */

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE_NAME)
      .then((cache) => cache.add(OFFLINE_PAGE))
      .then(() => self.skipWaiting()),
  );
});

/* ---------- Activate ---------- */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("sweet-spicy-") && !EXPECTED_CACHES.includes(key),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: "window" }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: "SW_UPDATED", version: SW_CACHE_VERSION });
          });
        }),
      ),
  );
});

/* ---------- Fetch strategies ---------- */

/**
 * Cache-first: try cache, fall back to network, then store the fresh copy.
 */
function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          cache.put(request, response.clone()).catch(() => {
            /* cache storage full — silently continue */
          });
        }
        return response;
      });
    }),
  );
}

/**
 * Network-first: try network, cache the response, fall back to cache on failure.
 */
function networkFirst(request, cacheName) {
  return caches.open(cacheName).then((cache) =>
    fetch(request)
      .then((response) => {
        if (response.ok) {
          cache.put(request, response.clone()).catch(() => {
            /* cache storage full — silently continue */
          });
        }
        return response;
      })
      .catch(() => cache.match(request)),
  );
}

/**
 * Serve the offline fallback page from the offline cache.
 */
function offlineFallback() {
  return caches.match(OFFLINE_PAGE).then(
    (cached) =>
      cached ||
      new Response("You are offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      }),
  );
}

/* ---------- Fetch event ---------- */

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Socket.IO — network-only, never cache
  if (isSocketRequest(url)) return;

  // Static assets — cache-first
  if (isStaticAsset(url)) {
    event.respondWith(
      cacheFirst(event.request, STATIC_CACHE_NAME).catch(() => offlineFallback()),
    );
    return;
  }

  // API requests — network-first
  if (isApiRequest(url)) {
    event.respondWith(
      networkFirst(event.request, API_CACHE_NAME).then(
        (response) => response || offlineFallback(),
      ),
    );
    return;
  }

  // Navigation requests — network-first with offline fallback
  if (isNavigationRequest(event.request)) {
    event.respondWith(
      fetch(event.request).catch(() => offlineFallback()),
    );
    return;
  }
});
