/**
 * Extracted Service Worker URL-matching logic for testability.
 * These mirror the functions in `public/sw.js` — keep them in sync.
 */

/**
 * Returns `true` for static assets that benefit from cache-first:
 * Next.js bundles, CSS, game card art, fonts, and PWA icons.
 */
export function isStaticAsset(url: URL): boolean {
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
export function isApiRequest(url: URL): boolean {
  return url.pathname.startsWith("/api/");
}

/** Returns `true` for Socket.IO transport — always network-only. */
export function isSocketRequest(url: URL): boolean {
  return url.pathname.startsWith("/socket.io/");
}

export type FetchStrategy = "cache-first" | "network-first" | "network-only" | "navigation";

/**
 * Determine the fetch strategy for a given URL and request mode.
 * Mirrors the logic in `public/sw.js` fetch event handler.
 */
export function determineFetchStrategy(
  url: URL,
  requestMode: string,
  origin: string,
): FetchStrategy | null {
  // Only handle same-origin requests
  if (url.origin !== origin) return null;

  // Socket.IO — network-only
  if (isSocketRequest(url)) return "network-only";

  // Static assets — cache-first
  if (isStaticAsset(url)) return "cache-first";

  // API requests — network-first
  if (isApiRequest(url)) return "network-first";

  // Navigation requests — network-first with offline fallback
  if (requestMode === "navigate") return "navigation";

  return null;
}
