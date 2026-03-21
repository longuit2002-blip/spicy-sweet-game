"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n";
import { Toaster } from "@/components/ui/toaster";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          {children}
          <Toaster />
        </I18nextProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
