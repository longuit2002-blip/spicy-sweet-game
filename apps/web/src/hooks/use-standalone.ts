"use client";

import { useMediaQuery } from "./useMediaQuery";

/**
 * Detect whether the app is running in PWA standalone mode
 * (installed to home screen, no browser chrome).
 *
 * Returns `false` during SSR and in normal browser tabs.
 */
export function useIsStandalone(): boolean {
  return useMediaQuery("(display-mode: standalone)");
}
