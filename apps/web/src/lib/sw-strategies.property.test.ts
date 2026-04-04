import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { determineFetchStrategy, isStaticAsset, isApiRequest } from "./sw-strategies";

const ORIGIN = "https://example.com";

/** Generator for random file name segments */
const fileNameArb = fc.stringMatching(/^[a-z0-9]{1,12}$/);

/** Generator for random static asset paths */
const staticAssetPathArb = fc.oneof(
  fileNameArb.map((name) => `/_next/static/chunks/${name}.js`),
  fileNameArb.map((name) => `/game/${name}.webp`),
  fileNameArb.map((name) => `/icons/${name}.png`),
  fileNameArb.map((name) => `/fonts/${name}.woff2`),
  fileNameArb.map((name) => `/assets/${name}.css`),
  fileNameArb.map((name) => `/images/${name}.svg`),
);

/** Generator for random API paths */
const apiPathArb = fileNameArb.map((suffix) => `/api/${suffix}`);

/**
 * Feature: mobile-responsive-pwa, Property 3: Service Worker cache-first cho static assets
 *
 * **Validates: Requirements 8.1**
 *
 * For any URL matching a static asset pattern, the fetch strategy must be "cache-first".
 */
describe("Property 3: Service Worker cache-first cho static assets", () => {
  it("static asset URLs always get cache-first strategy", () => {
    fc.assert(
      fc.property(staticAssetPathArb, (pathname) => {
        const url = new URL(pathname, ORIGIN);
        expect(isStaticAsset(url)).toBe(true);
        expect(determineFetchStrategy(url, "cors", ORIGIN)).toBe("cache-first");
      }),
      { numRuns: 200 },
    );
  });
});

/**
 * Feature: mobile-responsive-pwa, Property 4: Service Worker network-first cho API requests
 *
 * **Validates: Requirements 8.2**
 *
 * For any URL matching an API pattern (/api/*), the fetch strategy must be "network-first".
 */
describe("Property 4: Service Worker network-first cho API requests", () => {
  it("API URLs always get network-first strategy", () => {
    fc.assert(
      fc.property(apiPathArb, (pathname) => {
        const url = new URL(pathname, ORIGIN);
        expect(isApiRequest(url)).toBe(true);
        expect(determineFetchStrategy(url, "cors", ORIGIN)).toBe("network-first");
      }),
      { numRuns: 200 },
    );
  });
});
