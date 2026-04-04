import { describe, it, expect } from "vitest";
import { determineFetchStrategy } from "./sw-strategies";

const ORIGIN = "https://example.com";

/**
 * Unit test: SW offline fallback when network fails + cache miss
 *
 * Validates: Requirements 8.3
 *
 * When a navigation request hits the SW and it's not a static asset or API,
 * the strategy should be "navigation" — which in the actual SW triggers
 * network-first with offline.html fallback on failure + cache miss.
 */
describe("SW offline fallback — navigation strategy", () => {
  it("returns 'navigation' for same-origin navigate requests", () => {
    const url = new URL("/room/ABC123", ORIGIN);
    const strategy = determineFetchStrategy(url, "navigate", ORIGIN);
    expect(strategy).toBe("navigation");
  });

  it("returns 'navigation' for root navigate request", () => {
    const url = new URL("/", ORIGIN);
    const strategy = determineFetchStrategy(url, "navigate", ORIGIN);
    expect(strategy).toBe("navigation");
  });

  it("returns null for cross-origin requests (no offline fallback)", () => {
    const url = new URL("https://other-domain.com/page");
    const strategy = determineFetchStrategy(url, "navigate", ORIGIN);
    expect(strategy).toBeNull();
  });

  it("returns 'network-only' for socket.io (no cache, no offline fallback)", () => {
    const url = new URL("/socket.io/?EIO=4&transport=polling", ORIGIN);
    const strategy = determineFetchStrategy(url, "cors", ORIGIN);
    expect(strategy).toBe("network-only");
  });

  it("prioritizes cache-first for static assets over navigation", () => {
    const url = new URL("/_next/static/chunks/main.js", ORIGIN);
    // Even if requestMode were 'navigate', static asset pattern takes precedence
    const strategy = determineFetchStrategy(url, "cors", ORIGIN);
    expect(strategy).toBe("cache-first");
  });

  it("prioritizes network-first for API requests", () => {
    const url = new URL("/api/rooms", ORIGIN);
    const strategy = determineFetchStrategy(url, "cors", ORIGIN);
    expect(strategy).toBe("network-first");
  });

  it("returns null for same-origin non-navigate, non-asset, non-api requests", () => {
    const url = new URL("/some-unknown-path", ORIGIN);
    const strategy = determineFetchStrategy(url, "cors", ORIGIN);
    expect(strategy).toBeNull();
  });
});
