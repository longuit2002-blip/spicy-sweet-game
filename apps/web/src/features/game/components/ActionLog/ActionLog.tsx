"use client";

import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface ActionLogProps {
  entries: readonly { id: string; text: string; at: number }[];
  /** When true, log starts collapsed (mobile). */
  defaultCollapsed?: boolean;
  /** `embedded` = side panel tab: no outer card, no collapse toggle, fills parent scroll area. */
  variant?: "default" | "embedded";
}

function ActionLogList({
  entries,
  scrollClassName,
}: {
  entries: readonly { id: string; text: string; at: number }[];
  scrollClassName: string;
}) {
  const list = [...entries].reverse();
  return (
    <ScrollArea className={cn("w-full", scrollClassName)}>
      <ul className="space-y-1 pr-3 text-left text-xs text-muted-foreground">
        {list.map((e) => (
          <li key={e.id} className="leading-snug">
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
              {new Date(e.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>{" "}
            <span className="text-foreground/90">{e.text}</span>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}

export function ActionLog({
  entries,
  defaultCollapsed = false,
  variant = "default",
}: ActionLogProps) {
  const { t } = useTranslation("game");
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (variant === "embedded") {
    if (entries.length === 0) {
      return (
        <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t("actionLog.empty")}</p>
      );
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ActionLogList entries={entries} scrollClassName="h-full min-h-[8rem]" />
      </div>
    );
  }

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-border/25 bg-card/70 px-3 py-2 shadow-sm backdrop-blur-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("actionLog.title")}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 rounded-full px-2 text-xs md:hidden"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <>
              {t("actionLog.expand")} <ChevronDown className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              {t("actionLog.collapse")} <ChevronUp className="h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </div>
      <div
        className={cn(
          "md:block",
          collapsed ? "hidden md:block" : "block",
        )}
      >
        <ActionLogList entries={entries} scrollClassName="h-[min(8.5rem,28vh)]" />
      </div>
    </div>
  );
}
