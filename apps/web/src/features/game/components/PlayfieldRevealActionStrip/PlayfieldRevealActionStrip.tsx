"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ChallengeResult } from "@/shared/types/game";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { DEFAULT_LOBBY_NICKNAME, REVEAL_REMAIN_AFTER_LOCK_THRESHOLD } from "@/lib/game-room.constants";
import { RevealChallengeAxisTilesRow } from "./reveal-challenge-axis-tiles-row";

/**
 * REVEAL phase UI below the claim card (same stack as {@link ChallengePhase} embedded strip).
 * Lock vs post-lock share a fixed inner height so the adjacent claim card does not shift mid-phase.
 */
const REVEAL_ACTION_STRIP_INNER_HEIGHT_CLASS = "h-[10.5rem] sm:h-[11.25rem]";

export interface PlayfieldRevealActionStripProps {
  challengeResult: ChallengeResult;
  challengeTimer: number;
  challengeOutcomeNames?: { challenger: string; declarer: string } | null;
  className?: string;
}

export function PlayfieldRevealActionStrip({
  challengeResult,
  challengeTimer,
  challengeOutcomeNames = null,
  className,
}: PlayfieldRevealActionStripProps) {
  const { t } = useTranslation("game");

  const inRevealLock = challengeTimer > REVEAL_REMAIN_AFTER_LOCK_THRESHOLD;
  const revealLockDisplaySeconds = inRevealLock
    ? Math.max(0, challengeTimer - REVEAL_REMAIN_AFTER_LOCK_THRESHOLD)
    : 0;

  const revealLockSrText = useMemo(() => {
    if (!inRevealLock) return null;
    const challenger = (challengeOutcomeNames?.challenger ?? "").trim() || DEFAULT_LOBBY_NICKNAME;
    const axisLabel =
      challengeResult.challengeType === "suit" ? t("challenge.wrongSuit") : t("challenge.wrongNumber");
    return [
      t("challenge.revealLockTitle"),
      t("challenge.revealLockSubtitle", { player: challenger, axis: axisLabel }),
      t("challenge.revealLockCountdownSr", { seconds: revealLockDisplaySeconds }),
    ].join(" ");
  }, [
    inRevealLock,
    challengeResult.challengeType,
    challengeOutcomeNames?.challenger,
    revealLockDisplaySeconds,
    t,
  ]);

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-lg shrink-0 flex-col items-center pt-2 sm:max-w-xl sm:pt-3 lg:max-w-2xl",
        className,
      )}
      role="region"
      aria-label={t("challenge.regionLabel")}
    >
      <div
        className={cn(
          "flex w-full max-w-[min(100%,26rem)] shrink-0 flex-col justify-center sm:max-w-[min(100%,28rem)]",
          REVEAL_ACTION_STRIP_INNER_HEIGHT_CLASS,
        )}
      >
        {inRevealLock ? (
          <div className="flex min-h-0 flex-1 flex-col justify-center">
            <div
              className="relative overflow-hidden rounded-xl border-2 border-primary/40 bg-gradient-to-b from-primary/[0.14] to-card px-2 py-2 shadow-kawaii ring-1 ring-primary/25 sm:px-3 sm:py-2.5"
              role="status"
              aria-live="polite"
            >
              <div
                className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-primary/10 blur-xl"
                aria-hidden
              />
              <div className="relative flex min-h-0 flex-col items-stretch gap-1 sm:gap-1.5">
                <div className="flex w-full items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5 text-primary">
                    <Icon name="lock" size={18} className="shrink-0" aria-hidden />
                    <span className="truncate font-headline text-[10px] font-black uppercase tracking-wide sm:text-xs">
                      {t("challenge.revealLockTitle")}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-center justify-center rounded-lg border border-border/60 bg-background/80 px-2 py-1 tabular-nums shadow-inner sm:px-2.5">
                    <span className="font-headline text-lg font-black leading-none text-primary sm:text-xl">
                      {revealLockDisplaySeconds}
                    </span>
                    <span className="max-w-[4.5rem] truncate text-center text-[8px] font-bold uppercase leading-tight tracking-wider text-muted-foreground sm:max-w-[6rem] sm:text-[9px]">
                      {t("challenge.revealLockCountLabel")}
                    </span>
                  </div>
                </div>
                <p className="w-full truncate text-left text-[10px] font-semibold text-muted-foreground sm:text-[11px]">
                  {(challengeOutcomeNames?.challenger ?? "").trim() || DEFAULT_LOBBY_NICKNAME}
                </p>
                <RevealChallengeAxisTilesRow challengeType={challengeResult.challengeType} />
              </div>
            </div>
          </div>
        ) : (
          <div
            className="flex min-h-0 flex-1 flex-col items-center justify-center px-1"
            role="status"
            aria-live="polite"
          >
            <div className="rounded-full border border-primary/35 bg-primary/[0.09] px-3 py-2 shadow-kawaii ring-1 ring-primary/20 sm:px-4">
              <p className="text-[11px] font-bold uppercase leading-snug tracking-wide text-foreground sm:text-xs">
                {challengeResult.challengeType === "suit"
                  ? t("challenge.revealAxisSuit")
                  : t("challenge.revealAxisNumber")}
              </p>
            </div>
          </div>
        )}
      </div>
      {revealLockSrText ? (
        <p className="sr-only" role="status">
          {revealLockSrText}
        </p>
      ) : null}
    </div>
  );
}
