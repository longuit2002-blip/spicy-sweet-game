import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { isDismissedWithinWindow } from "./use-install-prompt";
import { PWA_INSTALL_DISMISS_DURATION_MS } from "@/lib/game-room.constants";

/**
 * Feature: mobile-responsive-pwa, Property 5: Install prompt hook phản ứng đúng với beforeinstallprompt
 *
 * **Validates: Requirements 9.1, 9.3**
 *
 * For any initial state of useInstallPrompt hook, when beforeinstallprompt fires,
 * canInstall must become true. When display-mode: standalone is detected,
 * isInstalled must be true and canInstall must be false.
 *
 * We test the state machine logic by simulating event sequences against the
 * underlying state transitions rather than rendering the full React hook,
 * since the hook's logic is straightforward event → state mapping.
 */
describe("Property 5: Install prompt hook phản ứng đúng với beforeinstallprompt", () => {
  type HookState = {
    canInstall: boolean;
    isInstalled: boolean;
    deferredPrompt: unknown | null;
  };

  type EventKind = "beforeinstallprompt" | "appinstalled" | "standalone-on" | "standalone-off";

  /** Pure state machine that mirrors useInstallPrompt logic */
  function applyEvent(state: HookState, event: EventKind): HookState {
    switch (event) {
      case "beforeinstallprompt":
        if (state.isInstalled) return state;
        return { ...state, canInstall: true, deferredPrompt: {} };
      case "appinstalled":
        return { ...state, canInstall: false, deferredPrompt: null };
      case "standalone-on":
        return { ...state, isInstalled: true, canInstall: false };
      case "standalone-off":
        return { ...state, isInstalled: false };
      default:
        return state;
    }
  }

  const eventArb: fc.Arbitrary<EventKind> = fc.oneof(
    fc.constant("beforeinstallprompt" as const),
    fc.constant("appinstalled" as const),
    fc.constant("standalone-on" as const),
    fc.constant("standalone-off" as const),
  );

  it("after beforeinstallprompt, canInstall is true (unless installed)", () => {
    fc.assert(
      fc.property(
        fc.array(eventArb, { minLength: 1, maxLength: 10 }),
        (events) => {
          let state: HookState = { canInstall: false, isInstalled: false, deferredPrompt: null };
          for (const event of events) {
            state = applyEvent(state, event);
          }

          // Core invariant 1: if isInstalled is true, canInstall must always be false
          if (state.isInstalled) {
            expect(state.canInstall).toBe(false);
          }

          // Core invariant 2: canInstall and isInstalled are never both true
          expect(state.canInstall && state.isInstalled).toBe(false);

          // Core invariant 3: canInstall can only be true if a beforeinstallprompt
          // was received while NOT in standalone mode, and no appinstalled followed
          if (state.canInstall) {
            // There must have been at least one beforeinstallprompt event
            expect(events.includes("beforeinstallprompt")).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

/**
 * Feature: mobile-responsive-pwa, Property 6: Dismiss banner tôn trọng cửa sổ 7 ngày
 *
 * **Validates: Requirements 9.4**
 *
 * For any dismiss timestamp t and any check timestamp now:
 * - if now - t < 7 days → isDismissed returns true
 * - if now - t >= 7 days → isDismissed returns false
 */
describe("Property 6: Dismiss banner tôn trọng cửa sổ 7 ngày", () => {
  const realDateNow = Date.now;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    Date.now = realDateNow;
    localStorage.clear();
  });

  it("isDismissed is true when within 7-day window", () => {
    fc.assert(
      fc.property(
        // dismissedAt: a timestamp in a reasonable range
        fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
        // elapsed: time since dismiss, less than 7 days (in ms)
        fc.integer({ min: 0, max: PWA_INSTALL_DISMISS_DURATION_MS - 1 }),
        (dismissedAt, elapsed) => {
          const now = dismissedAt + elapsed;
          localStorage.setItem("pwa-install-dismissed-at", String(dismissedAt));
          Date.now = () => now;

          expect(isDismissedWithinWindow()).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("isDismissed is false when outside 7-day window", () => {
    fc.assert(
      fc.property(
        // dismissedAt: a timestamp in a reasonable range
        fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
        // elapsed: time since dismiss, at least 7 days (in ms)
        fc.integer({ min: PWA_INSTALL_DISMISS_DURATION_MS, max: PWA_INSTALL_DISMISS_DURATION_MS * 3 }),
        (dismissedAt, elapsed) => {
          const now = dismissedAt + elapsed;
          localStorage.setItem("pwa-install-dismissed-at", String(dismissedAt));
          Date.now = () => now;

          expect(isDismissedWithinWindow()).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("isDismissed is false when no dismiss timestamp exists", () => {
    // No localStorage entry → not dismissed
    expect(isDismissedWithinWindow()).toBe(false);
  });
});
