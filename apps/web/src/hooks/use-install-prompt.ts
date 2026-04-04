"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PWA_INSTALL_DISMISS_DURATION_MS } from "@/lib/game-room.constants";

import { useIsStandalone } from "./use-standalone";

/**
 * The `beforeinstallprompt` event is not yet in the standard DOM typings.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  prompt(): Promise<void>;
}

/**
 * localStorage key for the timestamp when the user dismissed the install banner.
 * The banner stays hidden for {@link PWA_INSTALL_DISMISS_DURATION_MS} after dismissal.
 */
const PWA_INSTALL_DISMISSED_AT_KEY = "pwa-install-dismissed-at";

export interface UseInstallPromptReturn {
  /** `true` when the browser has fired `beforeinstallprompt` and the user hasn't installed yet. */
  canInstall: boolean;
  /** `true` when the app is running in standalone (installed) mode. */
  isInstalled: boolean;
  /** `true` when the user dismissed the banner within the last 7 days. */
  isDismissed: boolean;
  /** Trigger the native install dialog. No-op if `canInstall` is `false`. */
  promptInstall: () => Promise<void>;
  /** Dismiss the banner and persist the timestamp to localStorage. */
  dismiss: () => void;
}

/** Check whether the dismiss window (7 days) is still active. */
export function isDismissedWithinWindow(): boolean {
  try {
    const raw = localStorage.getItem(PWA_INSTALL_DISMISSED_AT_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (Number.isNaN(dismissedAt)) return false;
    return Date.now() - dismissedAt < PWA_INSTALL_DISMISS_DURATION_MS;
  } catch {
    // localStorage unavailable (e.g. private browsing quota exceeded)
    return false;
  }
}

/**
 * Manages the PWA install prompt lifecycle:
 * - Captures the `beforeinstallprompt` event
 * - Tracks standalone (installed) mode via `useIsStandalone`
 * - Persists dismiss state to localStorage with a 7-day window
 */
export function useInstallPrompt(): UseInstallPromptReturn {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true); // default hidden until hydrated
  const isInstalled = useIsStandalone();

  // Hydrate dismiss state from localStorage on mount
  useEffect(() => {
    setIsDismissed(isDismissedWithinWindow());
  }, []);

  // Listen for the browser's beforeinstallprompt event
  useEffect(() => {
    if (isInstalled) return;

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Also listen for successful install to clear the prompt
    const installedHandler = () => {
      deferredPromptRef.current = null;
      setCanInstall(false);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, [isInstalled]);

  const promptInstall = useCallback(async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;

    await prompt.prompt();
    const result = await prompt.userChoice;

    if (result.outcome === "accepted") {
      deferredPromptRef.current = null;
      setCanInstall(false);
    }
  }, []);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    try {
      localStorage.setItem(
        PWA_INSTALL_DISMISSED_AT_KEY,
        String(Date.now()),
      );
    } catch {
      // localStorage unavailable — dismiss is still honoured in-memory for this session
    }
  }, []);

  return {
    canInstall: canInstall && !isInstalled,
    isInstalled,
    isDismissed,
    promptInstall,
    dismiss,
  };
}
