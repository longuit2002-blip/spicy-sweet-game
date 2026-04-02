"use client";

import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { ChallengeResult } from "@/shared/types/game";
import { PHASE_EASE_OUT, SNAPPY_SPRING } from "@/features/game/animations";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { DEFAULT_LOBBY_NICKNAME, REVEAL_REMAIN_AFTER_LOCK_THRESHOLD } from "@/lib/game-room.constants";
import {
  CHALLENGE_AXIS_PLAYFIELD_STRIP_INNER_FIXED_CLASS,
  CHALLENGE_AXIS_PLAYFIELD_STRIP_OUTER_CLASS,
  ChallengerAxisIdentityStrip,
} from "@/features/game/components/challenge-axis";
import { RevealChallengeAxisTilesRow } from "./reveal-challenge-axis-tiles-row";

export interface PlayfieldRevealActionStripProps {
  challengeResult: ChallengeResult;
  challengeTimer: number;
  challengeOutcomeNames?: { challenger: string; declarer: string } | null;
  localPlayerId: string;
  className?: string;
}

function axisDisplayFromType(ct: ChallengeResult["challengeType"]): "wild" | "number" {
  return ct === "suit" ? "wild" : "number";
}

export function PlayfieldRevealActionStrip({
  challengeResult,
  challengeTimer,
  challengeOutcomeNames = null,
  localPlayerId,
  className,
}: PlayfieldRevealActionStripProps) {
  const { t } = useTranslation("game");
  const reducedMotion = useReducedMotion() === true;
  const transition = reducedMotion
    ? { type: "tween" as const, duration: 0.14, ease: PHASE_EASE_OUT }
    : SNAPPY_SPRING;

  const challengerDisplayName = useMemo(
    () => (challengeOutcomeNames?.challenger ?? "").trim() || DEFAULT_LOBBY_NICKNAME,
    [challengeOutcomeNames?.challenger],
  );

  const inRevealLock = challengeTimer > REVEAL_REMAIN_AFTER_LOCK_THRESHOLD;
  const lockSecondsLeft = inRevealLock
    ? Math.max(0, challengeTimer - REVEAL_REMAIN_AFTER_LOCK_THRESHOLD)
    : 0;

  const isLocalChallenger = localPlayerId === challengeResult.challengerId;
  const axisDisplay = axisDisplayFromType(challengeResult.challengeType);

  const flipAriaLabel =
    challengeResult.challengeType === "suit"
      ? t("challenge.revealAxisSuit")
      : t("challenge.revealAxisNumber");

  const flipAxisTitle =
    axisDisplay === "wild" ? t("challenge.wrongSuit") : t("challenge.wrongNumber");

  const srText = useMemo(() => {
    if (!inRevealLock) return null;
    const axisLabel =
      challengeResult.challengeType === "suit" ? t("challenge.wrongSuit") : t("challenge.wrongNumber");
    return [
      t("challenge.revealLockTitle"),
      t("challenge.revealLockSubtitle", { player: challengerDisplayName, axis: axisLabel }),
      t("challenge.revealLockCountdownSr", { seconds: lockSecondsLeft }),
    ].join(" ");
  }, [inRevealLock, challengeResult.challengeType, challengerDisplayName, lockSecondsLeft, t]);

  return (
    <div
      className={cn(CHALLENGE_AXIS_PLAYFIELD_STRIP_OUTER_CLASS, className)}
      role="region"
      aria-label={t("challenge.regionLabel")}
    >
      <div className={CHALLENGE_AXIS_PLAYFIELD_STRIP_INNER_FIXED_CLASS}>
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden sm:gap-2">
        <AnimatePresence mode="wait" initial={false}>
          {inRevealLock ? (
            <motion.div
              key="reveal-lock"
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
              transition={transition}
              className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-1.5 overflow-hidden sm:gap-2"
              role="status"
              aria-live="polite"
            >
              <ChallengerAxisIdentityStrip
                className="shrink-0"
                phase="lock"
                nickname={challengerDisplayName}
                isLocalPlayer={isLocalChallenger}
                hint={t("challenge.axisIdentityLockHint")}
                challengeAxisDisplay={axisDisplay}
                revealLockCountdown={{ seconds: lockSecondsLeft }}
              />

              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <RevealChallengeAxisTilesRow challengeType={challengeResult.challengeType} />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="reveal-flip"
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
              transition={transition}
              className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center overflow-hidden py-0"
              role="status"
              aria-live="polite"
            >
              <div
                className="flex max-h-full w-full max-w-sm flex-col items-center gap-2 overflow-hidden rounded-md border border-primary/30 bg-gradient-to-b from-primary/10 to-muted/15 px-3 py-2.5 shadow-sm sm:gap-2 sm:px-4 sm:py-3"
                aria-label={flipAriaLabel}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/25 bg-primary/12 sm:h-10 sm:w-10"
                  aria-hidden
                >
                  {axisDisplay === "wild" ? (
                    <Icon name="style" size={32} fill={1} className="text-primary" />
                  ) : (
                    <Icon name="counter_1" size={32} fill={1} className="text-primary" />
                  )}
                </div>
                <div className="min-w-0 px-0.5 text-center">
                  <p className="font-headline text-xs font-black leading-tight text-foreground sm:text-sm">
                    {t("challenge.revealFlipChallengingLead")}
                  </p>
                  <p className="mt-0.5 font-headline text-sm font-black leading-tight text-primary sm:text-base">
                    {flipAxisTitle}
                  </p>
                </div>
                <span className="sr-only">{flipAriaLabel}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>

      {srText ? (
        <p className="sr-only" role="status">
          {srText}
        </p>
      ) : null}
    </div>
  );
}
