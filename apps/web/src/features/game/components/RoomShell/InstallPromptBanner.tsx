"use client";

import { Download, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { cn } from "@/lib/utils";

interface InstallPromptBannerProps {
  className?: string;
}

/**
 * A dismissible banner that prompts the user to install the PWA.
 *
 * Visible only when:
 * - The browser has fired `beforeinstallprompt` (`canInstall`)
 * - The app is NOT already installed (`!isInstalled`)
 * - The user hasn't dismissed the banner in the last 7 days (`!isDismissed`)
 */
export function InstallPromptBanner({ className }: InstallPromptBannerProps) {
  const { t } = useTranslation("game");
  const { canInstall, isInstalled, isDismissed, promptInstall, dismiss } =
    useInstallPrompt();

  if (!canInstall || isInstalled || isDismissed) return null;

  return (
    <div
      role="banner"
      className={cn(
        "fixed bottom-0 left-0 z-50 flex w-full items-center gap-3 border-t border-border bg-surface-container px-4 py-3 shadow-lg sm:px-6",
        "safe-area-pb",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Download className="size-5 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 truncate text-sm font-medium text-foreground">
          {t("installBanner.message")}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          onClick={promptInstall}
          className="min-h-[44px] min-w-[44px]"
        >
          {t("installBanner.install")}
        </Button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("installBanner.dismissAria")}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-container-high hover:text-foreground"
        >
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
}
