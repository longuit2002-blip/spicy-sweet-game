"use client";

import { useTranslation } from "react-i18next";
import type { ChallengeResult } from "@/shared/types/game";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

/** Matches compact REVEAL lock row in {@link PlayfieldRevealActionStrip}. */
export const REVEAL_LOCK_AXIS_TILE_ICON_SIZE = 16;
export const REVEAL_LOCK_AXIS_TILE_ICON_SIZE_SM = 18;

/** Compact wrong-suit vs wrong-number tiles (ChallengePhase pick pattern) for REVEAL lock strip. */
export function RevealChallengeAxisTilesRow({
  challengeType,
  className,
}: {
  challengeType: ChallengeResult["challengeType"];
  className?: string;
}) {
  const { t } = useTranslation("game");
  const suitChosen = challengeType === "suit";

  const tileClass = (active: boolean) =>
    cn(
      "flex min-h-[2.875rem] min-w-0 flex-1 max-w-[8.5rem] flex-col items-center justify-center gap-0.5 rounded-md border-2 px-1 py-1 text-center sm:min-h-[3.125rem] sm:max-w-[9.25rem] sm:px-1.5 sm:py-1.5",
      active
        ? "border-primary/45 bg-primary/[0.1] ring-1 ring-primary/35 shadow-sm"
        : "border-dashed border-muted-foreground/35 bg-muted/20 opacity-50",
    );

  const labelClass = (active: boolean) =>
    cn(
      "font-headline text-[9px] font-bold uppercase leading-tight sm:text-[10px]",
      active ? "text-foreground" : "text-muted-foreground",
    );

  return (
    <div
      className={cn("flex w-full max-w-[min(100%,20rem)] justify-center gap-1.5 sm:gap-2", className)}
      aria-hidden
    >
      <div className={tileClass(suitChosen)}>
        <Icon
          name="style"
          size={REVEAL_LOCK_AXIS_TILE_ICON_SIZE}
          fill={1}
          className={cn("shrink-0 sm:hidden", suitChosen ? "text-primary" : "text-muted-foreground")}
        />
        <Icon
          name="style"
          size={REVEAL_LOCK_AXIS_TILE_ICON_SIZE_SM}
          fill={1}
          className={cn("hidden shrink-0 sm:block", suitChosen ? "text-primary" : "text-muted-foreground")}
        />
        <span className={labelClass(suitChosen)}>{t("challenge.wrongSuit")}</span>
      </div>
      <div className={tileClass(!suitChosen)}>
        <Icon
          name="counter_1"
          size={REVEAL_LOCK_AXIS_TILE_ICON_SIZE}
          fill={1}
          className={cn("shrink-0 sm:hidden", !suitChosen ? "text-primary" : "text-muted-foreground")}
        />
        <Icon
          name="counter_1"
          size={REVEAL_LOCK_AXIS_TILE_ICON_SIZE_SM}
          fill={1}
          className={cn("hidden shrink-0 sm:block", !suitChosen ? "text-primary" : "text-muted-foreground")}
        />
        <span className={labelClass(!suitChosen)}>{t("challenge.wrongNumber")}</span>
      </div>
    </div>
  );
}
