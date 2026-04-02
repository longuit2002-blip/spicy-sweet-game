"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { ChallengeResult } from "@/shared/types/game";
import type { Player } from "@/shared/types/game";
import { SNAPPY_SPRING } from "@/features/game/animations";
import { PenaltyPhaseFlyingCardStack } from "@/features/game/components/PenaltyPhaseFlyingCardStack";
import { Icon } from "@/components/ui/icon";
import { DEFAULT_LOBBY_NICKNAME } from "@/lib/game-room.constants";
import { cn } from "@/lib/utils";

export interface RoundPenaltyPhasePanelProps {
  result: ChallengeResult;
  challenger: Player;
  declarer: Player;
  pileCardCount: number;
  penaltyDrawCount: number;
  localPlayerId: string;
}

type OutcomeVariant = "caught" | "truth" | "timeout";

/** Keeps each outcome column wide enough that nickname + YOU badge rarely wraps mid-word at `sm+`. */
const PENALTY_OUTCOME_GRID_MIN_TRACK_REM = 11;
const penaltyOutcomeGridColsClass = `sm:grid-cols-[minmax(${PENALTY_OUTCOME_GRID_MIN_TRACK_REM}rem,1fr)_auto_minmax(${PENALTY_OUTCOME_GRID_MIN_TRACK_REM}rem,1fr)]`;

function displayName(player: Player): string {
  const n = player.nickname.trim();
  return n.length > 0 ? n : DEFAULT_LOBBY_NICKNAME;
}

function initialFromName(name: string): string {
  return name[0]?.toUpperCase() ?? "?";
}

function PlayerOutcomeCard({
  player,
  isLocal,
  youLabel,
  roleEyebrow,
  outcomeKind,
  pileCardCount,
  penaltyDrawCount,
  iconName,
  iconClassName,
  outcomeBandClass,
  captionClassName,
  className,
}: {
  player: Player;
  isLocal: boolean;
  youLabel: string;
  roleEyebrow: string;
  outcomeKind: "pile" | "draw";
  pileCardCount: number;
  penaltyDrawCount: number;
  iconName: "layers" | "playing_cards";
  iconClassName: string;
  outcomeBandClass: string;
  captionClassName: string;
  className?: string;
}) {
  const { t } = useTranslation("game");
  const name = displayName(player);
  const initial = initialFromName(name);
  const outcomeCaption =
    outcomeKind === "pile" ? t("phase.penaltyOutcomePileCaption") : t("phase.penaltyOutcomeDrawCaption");

  const heroFigure =
    outcomeKind === "pile" ? (
      <span className="font-headline text-3xl font-black tabular-nums leading-none tracking-tight text-foreground sm:text-[2.125rem]">
        {pileCardCount}
      </span>
    ) : (
      <span className="font-headline text-3xl font-black tabular-nums leading-none tracking-tight text-foreground sm:text-[2.125rem]">
        +{penaltyDrawCount}
      </span>
    );

  return (
    <div
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col gap-2 rounded-2xl border px-3 py-3 shadow-sm sm:gap-2.5 sm:px-4 sm:py-3.5",
        "border-border/60 bg-background/90 ring-1 ring-border/25",
        className,
      )}
    >
      <p className="text-center text-[10px] font-bold uppercase leading-tight tracking-[0.12em] text-muted-foreground sm:text-[11px]">
        {roleEyebrow}
      </p>

      <div className="flex flex-col items-center gap-2 sm:gap-2.5">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-primary/40 bg-primary/14 font-headline text-lg font-black text-foreground shadow-inner sm:h-[3.75rem] sm:w-[3.75rem] sm:text-xl"
          aria-hidden
        >
          {initial}
        </div>

        <div className="flex w-full min-w-0 flex-col items-center gap-1.5">
          <div className="flex min-h-[2.5rem] w-full max-w-[16rem] flex-col items-center gap-1 sm:min-h-[2.75rem] sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-1.5">
            <p className="line-clamp-2 w-full text-center font-headline text-base font-black leading-tight text-foreground break-normal sm:w-auto sm:max-w-none sm:text-left sm:text-lg">
              {name}
            </p>
            {isLocal ? (
              <span className="shrink-0 rounded-md border border-primary/35 bg-primary/12 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary sm:text-[10px]">
                {youLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-auto pt-1">
        <div
          className={cn(
            "flex w-full min-w-0 items-center gap-3 rounded-xl border px-3 py-3 sm:gap-3.5 sm:px-3.5 sm:py-3.5",
            outcomeBandClass,
          )}
        >
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border shadow-inner sm:h-[3.25rem] sm:w-[3.25rem]",
              captionClassName,
            )}
            aria-hidden
          >
            <Icon name={iconName} size={28} className={iconClassName} fill={1} />
          </div>
          <div className="min-w-0 flex-1 text-left">
            {heroFigure}
            <p className="mt-1 text-[11px] font-bold leading-snug text-muted-foreground sm:text-xs">{outcomeCaption}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function OutcomeFlowArrowHorizontal() {
  return (
    <div
      className="hidden shrink-0 flex-col items-center justify-center self-stretch py-1 sm:flex"
      aria-hidden
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/40 bg-muted/30 text-muted-foreground shadow-inner sm:h-10 sm:w-10">
        <Icon name="arrow_forward" size={24} fill={1} className="opacity-75" />
      </div>
    </div>
  );
}

function OutcomeFlowArrowVertical() {
  return (
    <div className="flex shrink-0 justify-center py-0.5 sm:hidden" aria-hidden>
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/40 bg-muted/30 text-muted-foreground shadow-inner">
        <Icon name="arrow_downward" size={22} fill={1} className="opacity-75" />
      </div>
    </div>
  );
}

export function RoundPenaltyPhasePanel({
  result: r,
  challenger,
  declarer,
  pileCardCount,
  penaltyDrawCount,
  localPlayerId,
}: RoundPenaltyPhasePanelProps) {
  const { t } = useTranslation("game");
  const reducedMotion = useReducedMotion() === true;
  const you = t("seat.you");

  const variant: OutcomeVariant = r.challengeCorrect
    ? "caught"
    : r.timedOut
      ? "timeout"
      : "truth";

  const panelTone =
    variant === "caught"
      ? "border-destructive/40 bg-gradient-to-b from-destructive/[0.09] via-destructive/[0.05] to-background/40 shadow-lg"
      : variant === "timeout"
        ? "border-amber-500/40 bg-gradient-to-b from-amber-500/[0.08] via-amber-500/[0.04] to-background/40 shadow-lg"
        : "border-secondary/50 bg-gradient-to-b from-secondary/[0.1] via-secondary/[0.05] to-background/40 shadow-lg";

  const headline =
    variant === "caught"
      ? t("phase.penaltyTitleBluffCaught")
      : variant === "timeout"
        ? t("phase.penaltyTitleTimedOut")
        : t("phase.penaltyTitleTruth");

  const heroIcon =
    variant === "caught" ? (
      <Icon name="gpp_bad" size={36} className="text-destructive" fill={1} aria-hidden />
    ) : variant === "timeout" ? (
      <Icon name="timer_off" size={36} className="text-amber-600 dark:text-amber-400" aria-hidden />
    ) : (
      <Icon name="verified" size={36} className="text-secondary" fill={1} aria-hidden />
    );

  const heroRing =
    variant === "caught"
      ? "border-destructive/45 bg-destructive/[0.12] shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]"
      : variant === "timeout"
        ? "border-amber-500/45 bg-amber-500/10 shadow-[inset_0_1px_0_rgb(255_255_255/0.1)]"
        : "border-secondary/45 bg-secondary/15 shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]";

  const fullSummarySr = r.challengeCorrect
    ? t("phase.penaltyChallengerWins", {
        challenger: displayName(challenger),
        declarer: displayName(declarer),
        count: pileCardCount,
      })
    : t("phase.penaltyDeclarerWins", {
        declarer: displayName(declarer),
        challenger: displayName(challenger),
      });

  const pileBandClass =
    variant === "caught"
      ? "border-destructive/25 bg-destructive/[0.07]"
      : "border-secondary/30 bg-secondary/[0.1]";
  const drawBandClass = "border-destructive/25 bg-destructive/[0.06]";

  const pileIconClass = variant === "caught" ? "text-destructive" : "text-secondary";
  const drawIconClass = "text-destructive";

  const pileIconOrbitClass =
    variant === "caught"
      ? "border-destructive/30 bg-destructive/[0.1]"
      : "border-secondary/35 bg-secondary/[0.12]";
  const drawIconOrbitClass = "border-destructive/30 bg-destructive/[0.1]";

  const receivesPileRole = t("phase.penaltyRoleReceivesPile");
  const penaltyDrawRole = t("phase.penaltyRolePenaltyDraw");

  return (
    <motion.article
      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SNAPPY_SPRING}
      className={cn(
        "relative min-w-0 w-full max-w-full overflow-hidden rounded-2xl border px-3 py-3.5 sm:px-5 sm:py-5",
        panelTone,
      )}
      aria-labelledby="round-penalty-headline"
    >
      <p
        id="round-penalty-eyebrow"
        className="text-center text-[10px] font-bold uppercase leading-tight tracking-[0.14em] text-muted-foreground sm:text-[11px]"
      >
        {t("phase.penalty")}
      </p>

      <div className="mt-2.5 flex flex-col items-center gap-2 sm:mt-3">
        <motion.div
          initial={reducedMotion ? false : { scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...SNAPPY_SPRING, delay: reducedMotion ? 0 : 0.04 }}
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-full border-2 sm:h-[4.25rem] sm:w-[4.25rem]",
            heroRing,
          )}
          aria-hidden
        >
          {heroIcon}
        </motion.div>
        <h2
          id="round-penalty-headline"
          className="text-center font-headline text-xl font-black leading-tight text-foreground sm:text-2xl"
        >
          {headline}
        </h2>
      </div>

      <div
        className={cn(
          "mt-4 flex min-w-0 flex-col gap-2 sm:grid sm:items-stretch sm:gap-2 md:gap-3",
          penaltyOutcomeGridColsClass,
        )}
      >
        {r.challengeCorrect ? (
          <>
            <PlayerOutcomeCard
              player={challenger}
              isLocal={challenger.id === localPlayerId}
              youLabel={you}
              roleEyebrow={receivesPileRole}
              outcomeKind="pile"
              pileCardCount={pileCardCount}
              penaltyDrawCount={penaltyDrawCount}
              iconName="layers"
              iconClassName={pileIconClass}
              outcomeBandClass={pileBandClass}
              captionClassName={pileIconOrbitClass}
              className="min-h-0 sm:col-start-1 sm:row-start-1"
            />
            <OutcomeFlowArrowVertical />
            <OutcomeFlowArrowHorizontal />
            <PlayerOutcomeCard
              player={declarer}
              isLocal={declarer.id === localPlayerId}
              youLabel={you}
              roleEyebrow={penaltyDrawRole}
              outcomeKind="draw"
              pileCardCount={pileCardCount}
              penaltyDrawCount={penaltyDrawCount}
              iconName="playing_cards"
              iconClassName={drawIconClass}
              outcomeBandClass={drawBandClass}
              captionClassName={drawIconOrbitClass}
              className="min-h-0 sm:col-start-3 sm:row-start-1"
            />
          </>
        ) : (
          <>
            <PlayerOutcomeCard
              player={declarer}
              isLocal={declarer.id === localPlayerId}
              youLabel={you}
              roleEyebrow={receivesPileRole}
              outcomeKind="pile"
              pileCardCount={pileCardCount}
              penaltyDrawCount={penaltyDrawCount}
              iconName="layers"
              iconClassName={pileIconClass}
              outcomeBandClass={pileBandClass}
              captionClassName={pileIconOrbitClass}
              className="min-h-0 sm:col-start-1 sm:row-start-1"
            />
            <OutcomeFlowArrowVertical />
            <OutcomeFlowArrowHorizontal />
            <PlayerOutcomeCard
              player={challenger}
              isLocal={challenger.id === localPlayerId}
              youLabel={you}
              roleEyebrow={penaltyDrawRole}
              outcomeKind="draw"
              pileCardCount={pileCardCount}
              penaltyDrawCount={penaltyDrawCount}
              iconName="playing_cards"
              iconClassName={drawIconClass}
              outcomeBandClass={drawBandClass}
              captionClassName={drawIconOrbitClass}
              className="min-h-0 sm:col-start-3 sm:row-start-1"
            />
          </>
        )}
      </div>

      <p className="sr-only">{fullSummarySr}</p>

      <div className="mt-4 rounded-2xl border border-border/30 bg-muted/20 px-2 pb-2 pt-2 sm:mt-5 sm:px-3 sm:pb-2.5 sm:pt-2.5">
        <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px]">
          {t("phase.penaltyPilePreviewCaption")}
        </p>
        <PenaltyPhaseFlyingCardStack pileCardCount={pileCardCount} density="panel" />
      </div>
    </motion.article>
  );
}
