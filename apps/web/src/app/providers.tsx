"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { I18nextProvider } from "react-i18next";
import i18n, {
  applyStoredOrBrowserLanguage,
  initI18nForLocale,
} from "@/lib/i18n";
import { Toaster } from "@/components/ui/toaster";
import { useState, useEffect, useLayoutEffect, type ReactNode } from "react";

/** Radix toast portal is not SSR-critical; mounting after hydration avoids extension-touched DOM mismatches in that subtree. */
function ClientToaster() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <Toaster />;
}

export function Providers({
  children,
  initialLanguage = "en",
}: {
  children: ReactNode;
  /** From root layout: cookie `i18nextLng` or Accept-Language — must match SSR HTML. */
  initialLanguage?: "en" | "vi";
}) {
  const [queryClient] = useState(() => new QueryClient());

  // Server / RSC: sync init here. Client: `bootstrapClientI18nFromHtml()` in i18n.ts already ran from `<html lang>`;
  // calling `init()` during render would sync-update `useTranslation` children and trigger React warnings.
  if (typeof window === "undefined") {
    initI18nForLocale(initialLanguage);
  }

  useLayoutEffect(() => {
    initI18nForLocale(initialLanguage);
  }, [initialLanguage]);

  useEffect(() => {
    applyStoredOrBrowserLanguage();
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          {children}
          <ClientToaster />
        </I18nextProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
