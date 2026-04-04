"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { ChallengeResult } from "@/shared/types/game";
import { SPICE_EMOJI, SPICE_LABEL } from "@/shared/types/game";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { PHASE_TRANSITION_REDUCED, SNAPPY_SPRING } from "@/features/game/animations";
import { DEFAULT_LOBBY_NICKNAME, REVEAL_OUTCOME_CALLOUT_DELAY_SECONDS } from "@/lib/game-room.constants";
import { isLocalChallengeLoser } from "@/features/game/lib/challenge-outcome-local";

export type ChallengeOutcomeCalloutProps = {
  result: ChallengeResult;
  challengerName: string;
  declarerName: string;
  className?: string;
  /** Smaller type + tighter padding (REVEAL strip under the card). */
  compact?: boolean;
  /**
   * When true, fades/slides in after {@link REVEAL_OUTCOME_CALLOUT_DELAY_SECONDS} (or 0 if reduced motion).
   * Set false for PENALTY panel where the parent already animates.
   */
  motionEntrance?: boolean;
  /** When false, only headline + icon (e.g. PENALTY uses phase copy below). Default true. */
  showSubline?: boolean;
  /** When set, the losing seat sees destructive (red) styling even on global "truth" outcomes. */
  localPlayerId?: string;
};

export function ChallengeOutcomeCallout({
  result,
  challengerName,
  declarerName,
  className,
  compact = false,
  motionEntrance = false,
  showSubline = true,
  localPlayerId = "",
}: ChallengeOutcomeCalloutProps) {
  const { t } = useTranslation("game");
  const reducedMotion = useReducedMotion() === true;
  const { challengeCorrect, timedOut, realCard, declaredCard, challengeType } = result;
  const challenger = challengerName.trim() || DEFAULT_LOBBY_NICKNAME;
  const declarer = declarerName.trim() || DEFAULT_LOBBY_NICKNAME;

  const timeoutBranch = timedOut && !challengeCorrect;
  const localLost = isLocalChallengeLoser(result, localPlayerId);
  const isNegative = timeoutBranch || challengeCorrect || localLost;

  const headlineIcon = timeoutBranch ? (
    <Icon name="timer_off" size={compact ? 22 : 28} className="shrink-0 text-destructive" />
  ) : challengeCorrect ? (
    <Icon name="gpp_bad" size={compact ? 22 : 28} className="shrink-0 text-destructive" fill={1} />
  ) : localLost ? (
    <Icon name="gpp_bad" size={compact ? 22 : 28} className="shrink-0 text-destructive" fill={1} />
  ) : (
    <Icon name="verified" size={compact ? 22 : 28} className="shrink-0 text-secondary" fill={1} />
  );

  const headlineText = timeoutBranch
    ? t("result.challengeTimedOut")
    : challengeCorrect
      ? t("challenge.bluffCaught")
      : t("result.wasTruth");

  const headlineClass = timeoutBranch
    ? "text-destructive"
    : challengeCorrect
      ? "text-destructive"
      : localLost
        ? "text-destructive"
        : "text-secondary";

  /** Inline card comparison: "Declared X ≠ Real Y" or "Declared X = Real Y". */
  const cardComparisonLine = (
    <div className={cn(
      "flex flex-wrap items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs tabular-nums sm:gap-2 sm:px-2.5",
      isNegative
        ? "border-destructive/25 bg-destructive/5"
        : "border-secondary/25 bg-secondary/5",
    )}>
      <span className="font-medium text-muted-foreground">
        {SPICE_EMOJI[declaredCard.type]} {SPICE_LABEL[declaredCard.type]} {declaredCard.number}
      </span>
      <span className={cn(
        "font-headline text-sm font-black",
        challengeCorrect ? "text-destructive" : "text-secondary",
      )}>
        {challengeCorrect ? "≠" : "="}
      </span>
      <span className="font-semibold text-foreground">
        {SPICE_EMOJI[realCard.type]} {SPICE_LABEL[realCard.type]} {realCard.number}
      </span>
      <span className={cn(
        "ml-0.5 text-ui-micro font-bold uppercase tracking-wider",
        isNegative ? "text-destructive/70" : "text-secondary/70",
      )}>
        ({challengeType === "suit" ? t("result.suitAttr") : t("result.numberAttr")})
      </span>
    </div>
  );

  const subline =
    timeoutBranch ? (
      <>
        <p className="text-muted-foreground text-xs leading-relaxed">{t("result.declarerTakesPile")}</p>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          {t("result.challengerPenalty", { player: challenger })}
        </p>
      </>
    ) : challengeCorrect ? (
      <>
        <p className="text-foreground text-xs leading-relaxed">
          <span className="font-semibold">{challenger}</span> {t("result.challengeCorrect")}
        </p>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{t("result.challengerTakesPile")}</p>
        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
          {t("result.declarerPenaltyBluffCaught", { player: declarer })}
        </p>
      </>
    ) : (
      <>
        <p className="text-foreground text-xs leading-relaxed">
          <span className="font-semibold">{declarer}</span> {t("result.wasTruthMessage")}
        </p>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          {t("result.challengerPenalty", { player: challenger })}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{t("result.declarerTakesPile")}</p>
      </>
    );

  const inner = (
    <div
      role="status"
      className={cn(
        "flex w-full max-w-md flex-col items-center gap-2 rounded-lg border px-3 py-2 text-center shadow-sm backdrop-blur-[2px] sm:px-4 sm:py-2.5",
        isNegative
          ? "border-destructive/35 bg-destructive/8 ring-1 ring-destructive/15"
          : "border-secondary/40 bg-secondary/10 ring-1 ring-secondary/20",
        compact ? "sm:max-w-lg" : "sm:max-w-md",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {headlineIcon}
        <p
          className={cn(
            "font-headline font-bold leading-tight tracking-tight",
            compact ? "text-base sm:text-lg" : "text-lg sm:text-xl",
            headlineClass,
          )}
        >
          {headlineText}
        </p>
      </div>
      {cardComparisonLine}
      {showSubline ? subline : null}
    </div>
  );

  if (!motionEntrance) {
    return inner;
  }

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reducedMotion
          ? PHASE_TRANSITION_REDUCED
          : {
              ...SNAPPY_SPRING,
              delay: REVEAL_OUTCOME_CALLOUT_DELAY_SECONDS,
            }
      }
      className="w-full max-w-md"
    >
      {inner}
    </motion.div>
  );
}
