"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, SkipForward } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ChallengeType, ClientPlayedCard, PlayedCard, Player } from "@/shared/types/game";
import type { ChallengeStep } from "@/shared/types/game";
import { SPICE_EMOJI, SPICE_LABEL } from "@/shared/types/game";
import { cn } from "@/lib/utils";
import {
  CHALLENGE_STEP_CROSSFADE_TRANSITION,
  CHALLENGE_STEP_CROSSFADE_TRANSITION_REDUCED,
} from "@/features/game/animations";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { playerPresenceStats } from "@/features/game/lib/player-presence-stats";
import { useSmoothCountdownRemainder } from "@/features/game/hooks/use-smooth-countdown-remainder";
import {
  CHALLENGE_PICK_STANDALONE_TILE_MAX_W_CLASS,
  CHALLENGE_PICK_STANDALONE_TILE_SURFACE_CLASS,
} from "@/lib/game-room.constants";
import {
  CHALLENGE_AXIS_PLAYFIELD_STRIP_INNER_FIXED_CLASS,
  CHALLENGE_AXIS_PLAYFIELD_STRIP_OUTER_CLASS,
  CHALLENGE_AXIS_TILE_COL_CLASS,
  CHALLENGE_AXIS_TILE_ICON_SIZE,
  CHALLENGE_AXIS_TILE_ROW_CLASS,
  CHALLENGE_AXIS_TILE_SPECTATOR_WRAP_CLASS,
  ChallengeAxisPlayfieldTile,
  ChallengerAxisIdentityStrip,
} from "@/features/game/components/challenge-axis";

/** Standalone pick icon size (non-embedded). */
const DEFAULT_PICK_ICON_SIZE = CHALLENGE_AXIS_TILE_ICON_SIZE;

const CONTEXT_STRIP_MAX_PIPS = 6;

function ChallengePickContextChip({
  roleLabel,
  player,
  focal,
}: {
  roleLabel: string;
  player: Player;
  /** Larger card — used when this is the only context chip (perspective spotlight). */
  focal?: boolean;
}) {
  const { t } = useTranslation("game");
  const { hand, score, trophies } = playerPresenceStats(player);
  const initial = player.nickname[0]?.toUpperCase() ?? "?";

  return (
    <div
      className={cn(
        "flex min-w-0 max-w-[14rem] flex-col gap-2 rounded-2xl border px-3 py-2.5 shadow-kawaii sm:max-w-[16rem]",
        "border-primary/45 bg-primary/10 ring-2 ring-primary/35 ring-offset-2 ring-offset-background",
        focal && "gap-2.5 px-4 py-3 sm:py-3.5",
      )}
    >
      <span
        className={cn(
          "font-semibold uppercase tracking-wide text-muted-foreground",
          focal ? "text-ui-caption" : "text-ui-micro",
        )}
      >
        {roleLabel}
      </span>
      <div className="flex min-w-0 items-center gap-2.5">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary/15 font-bold text-foreground",
            focal ? "h-11 w-11 text-sm" : "h-9 w-9 text-xs",
          )}
          aria-hidden
        >
          {initial}
        </div>
        <p
          className={cn(
            "min-w-0 truncate font-headline font-bold text-foreground",
            focal ? "text-sm sm:text-base" : "text-xs font-semibold",
          )}
        >
          {player.nickname}
        </p>
      </div>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-2.5 gap-y-1 text-muted-foreground",
          focal ? "text-ui-caption sm:text-xs" : "text-ui-micro",
        )}
        aria-label={t("challenge.contextChipStats", { hand, score, trophies })}
      >
        <span className="flex items-center gap-0.5" aria-hidden>
          {Array.from({ length: Math.min(hand, CONTEXT_STRIP_MAX_PIPS) }).map((_, i) => (
            <span key={i} className="inline-block h-2.5 w-1.5 rounded-sm border border-border bg-card-back" />
          ))}
          {hand > CONTEXT_STRIP_MAX_PIPS ? (
            <span className="text-ui-tiny">+{hand - CONTEXT_STRIP_MAX_PIPS}</span>
          ) : null}
        </span>
        <span className="tabular-nums">
          ⭐ <strong className="text-foreground">{score}</strong>
        </span>
        <span className="tabular-nums">
          🏆 <strong className="text-foreground">{trophies}</strong>
        </span>
      </div>
    </div>
  );
}

function ChallengePickTimeBar({
  smoothRemainFraction,
  displaySeconds,
  urgent,
  embeddedCompact = false,
}: {
  /** 1 = full time remaining, 0 = none */
  smoothRemainFraction: number;
  displaySeconds: number;
  urgent: boolean;
  embeddedCompact?: boolean;
}) {
  const { t } = useTranslation("game");
  const pct = Math.max(0, Math.min(100, smoothRemainFraction * 100));

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[min(26rem,calc(100%-1rem))] px-1",
        embeddedCompact ? "mt-1" : "mt-3",
      )}
      role="timer"
      aria-label={t("challenge.timeRemainingSr", { seconds: displaySeconds })}
    >
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/90 ring-1 ring-border/40">
        <div
          className={cn(
            "h-full rounded-full transition-none",
            urgent ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export interface ChallengePhaseProps {
  playedCard: PlayedCard | ClientPlayedCard;
  players: Player[];
  localPlayerId: string;
  challengeStep: ChallengeStep | null;
  challengeClaimHolderId: string | null;
  /** Players who tapped skip during CLAIM_RACE (non-declarers only). */
  challengePassIds: string[];
  challengeTimer: number;
  /** Denominator for the countdown (matches server initial seconds for current step). */
  countdownTotalSeconds: number;
  onClaimChallenge: () => void;
  onChallenge: (challengerId: string, challengeType: ChallengeType) => void;
  /** During CLAIM_RACE: register pass / skip (unanimous passes accept the declaration early). */
  onChallengePass: () => void;
  /**
   * `default` — glass card (e.g. standalone strip).
   * `embedded` — sits on the board glass panel (flat separator, no nested card chrome).
   */
  variant?: "default" | "embedded";
}

export function ChallengePhase({
  playedCard,
  players,
  localPlayerId,
  challengeStep,
  challengeClaimHolderId,
  challengePassIds,
  challengeTimer,
  countdownTotalSeconds,
  onClaimChallenge,
  onChallenge,
  onChallengePass,
  variant = "default",
}: ChallengePhaseProps) {
  const { t } = useTranslation("game");
  const reducedMotion = useReducedMotion() === true;
  const timeLeft = challengeTimer;
  const progressDen = Math.max(countdownTotalSeconds, 1);
  const smoothRemain = useSmoothCountdownRemainder(timeLeft, reducedMotion);
  const smoothProgress = Math.max(0, Math.min(1, smoothRemain / progressDen));
  const displaySeconds = Math.max(0, Math.floor(smoothRemain + 1e-6));
  const playerWhoPlayed = players.find((p) => p.id === playedCard.playerId);
  const isDeclarer = localPlayerId === playedCard.playerId;
  const canAct = !isDeclarer;
  const step = challengeStep ?? "CLAIM_RACE";
  const isRace = step === "CLAIM_RACE";
  const isPick = step === "PICK_TYPE";
  const holder = challengeClaimHolderId ? players.find((p) => p.id === challengeClaimHolderId) : null;
  const isHolder = challengeClaimHolderId === localPlayerId;
  const urgent = smoothRemain <= 3;
  const challengePassEligibleCount = Math.max(0, players.length - 1);
  const localPassedClaimRace = challengePassIds.includes(localPlayerId);
  const passProgressFraction =
    challengePassEligibleCount > 0
      ? Math.min(1, challengePassIds.length / challengePassEligibleCount)
      : 0;

  const isEmbedded = variant === "embedded";
  /** 0–1: remaining time — pink fill height (anchored to bottom, recedes downward from the top). */
  const bluffFillHeightPercent = smoothProgress * 100;

  const pickInstructionSr = holder
    ? isHolder
      ? t("challenge.youHoldChallenge")
      : t("challenge.holderMustPick", { player: holder.nickname })
    : "";

  /** Focal chip is tall — omit on embedded playfield; ring seats show identities. */
  const showPickSpotlight =
    isPick && playerWhoPlayed && holder && !isEmbedded;

  const pickSpotlightBlock = showPickSpotlight ? (
    <div className="mb-3 flex justify-center px-1">
      {isHolder ? (
        <ChallengePickContextChip focal roleLabel={t("challenge.declareRole")} player={playerWhoPlayed} />
      ) : (
        <ChallengePickContextChip focal roleLabel={t("challenge.holderRole")} player={holder} />
      )}
    </div>
  ) : null;

  const challengeStepCrossFade = reducedMotion
    ? CHALLENGE_STEP_CROSSFADE_TRANSITION_REDUCED
    : CHALLENGE_STEP_CROSSFADE_TRANSITION;

  return (
    <div
      className={cn(
        "relative w-full",
        isEmbedded ? cn(CHALLENGE_AXIS_PLAYFIELD_STRIP_OUTER_CLASS, "mt-0") : "game-glass-panel max-w-lg rounded-2xl p-4 sm:p-5",
      )}
      role="region"
      aria-label={t("challenge.regionLabel")}
    >
      {!isEmbedded ? (
        <>
          <p className="text-muted-foreground mb-1 text-center text-sm">
            {playerWhoPlayed?.nickname} {t("challenge.title")}:
          </p>
          <p className="mb-4 text-center text-[clamp(1.5rem,5vw,2.25rem)] font-semibold leading-tight text-foreground tabular-nums">
            {SPICE_EMOJI[playedCard.declaration.type]} {SPICE_LABEL[playedCard.declaration.type]}{" "}
            <span className="text-primary font-bold">{playedCard.declaration.number}</span>
          </p>
        </>
      ) : null}

      <div
        className={cn(
          "grid w-full grid-cols-1 grid-rows-1 [&>*]:col-start-1 [&>*]:row-start-1",
          !isEmbedded && "mb-4",
          isEmbedded && "mb-2 min-h-0",
        )}
      >
        <AnimatePresence mode="sync" initial={false}>
          {isRace ? (
            <motion.div
              key="challenge-claim-race"
              className={cn(
                "col-start-1 row-start-1 flex w-full flex-col items-center justify-self-stretch gap-2",
                isEmbedded && "gap-1.5",
              )}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={challengeStepCrossFade}
            >
              {canAct ? (
                <p
                  id="challenge-race-skip-hint"
                  className={cn(
                    "max-w-[15rem] px-1 text-center text-ui-caption text-muted-foreground sm:max-w-[17rem] sm:text-xs",
                    isEmbedded && "max-w-[14rem] text-ui-micro sm:text-ui-caption",
                  )}
                >
                  {t("challenge.raceSkipMicroHint")}
                </p>
              ) : null}
              <motion.button
                type="button"
                disabled={!canAct}
                onClick={onClaimChallenge}
                whileTap={reducedMotion || !canAct ? undefined : { scale: 0.96 }}
                className={cn(
                  "bluff-bubble bouncy-action relative flex h-24 w-24 flex-col items-center justify-center overflow-hidden rounded-full border-[6px] border-white/40 sm:h-28 sm:w-28",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                  !canAct && "pointer-events-none opacity-50",
                )}
                aria-label={`${t("challenge.claimChallenge")} — ${t("challenge.timeLeft", { seconds: displaySeconds })}`}
                aria-describedby={canAct ? "challenge-race-skip-hint" : undefined}
              >
                {/* Depleted body — stays visible as the pink “juice” drains toward the bottom. */}
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/40 via-primary/30 to-black/25"
                  aria-hidden
                />
                <div
                  className={cn(
                    "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-b from-primary via-primary to-primary/85 transition-none",
                    urgent && "from-destructive via-destructive to-destructive/90",
                  )}
                  style={{ height: `${bluffFillHeightPercent}%` }}
                  aria-hidden
                />
                <span className="relative z-[2] flex flex-col items-center gap-0.5">
                  <span className="font-headline text-lg font-black tracking-tighter text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)] sm:text-xl">
                    {t("board.bluff")}
                  </span>
                  <span className="text-base font-bold tabular-nums leading-none text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)] sm:text-lg">
                    {displaySeconds}
                  </span>
                </span>
              </motion.button>

              <div
                className={cn(
                  "mt-0.5 w-full max-w-[15rem] space-y-2 rounded-2xl border border-border/70 bg-muted/30 px-3 py-2.5 shadow-inner ring-1 ring-background/40 backdrop-blur-sm sm:max-w-[17rem]",
                  isEmbedded && "max-w-[14rem] space-y-1.5 px-2.5 py-2",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-ui-micro font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    {t("challenge.passConsensusLabel")}
                  </span>
                  <span
                    className="font-headline text-xs font-semibold tabular-nums text-foreground sm:text-sm"
                    aria-hidden
                  >
                    {challengePassIds.length}/{challengePassEligibleCount}
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-background/90 ring-1 ring-border/50"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={challengePassEligibleCount}
                  aria-valuenow={challengePassIds.length}
                  aria-label={t("challenge.passProgress", {
                    current: challengePassIds.length,
                    total: challengePassEligibleCount,
                  })}
                >
                  <motion.div
                    className={cn(
                      "h-full rounded-full bg-gradient-to-r from-primary/75 to-primary",
                      urgent && "from-destructive/85 to-destructive",
                    )}
                    initial={false}
                    animate={{
                      width: `${Math.round(passProgressFraction * 100)}%`,
                    }}
                    transition={{
                      type: reducedMotion ? "tween" : "spring",
                      stiffness: 420,
                      damping: 34,
                      duration: reducedMotion ? 0.15 : undefined,
                    }}
                  />
                </div>

                {canAct ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-9 w-full gap-2 border-dashed text-xs font-medium shadow-sm transition-colors sm:h-10 sm:text-sm",
                      "border-border/90 hover:border-primary/45 hover:bg-primary/5",
                      localPassedClaimRace &&
                        "pointer-events-none border-primary/35 bg-primary/10 text-primary hover:bg-primary/10",
                    )}
                    disabled={localPassedClaimRace}
                    onClick={onChallengePass}
                    aria-label={t("challenge.skipClaimRaceAria")}
                  >
                    {localPassedClaimRace ? (
                      <Check className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    ) : (
                      <SkipForward className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    )}
                    {localPassedClaimRace ? t("challenge.skipClaimRaceDone") : t("challenge.skipClaimRace")}
                  </Button>
                ) : isDeclarer ? (
                  <p
                    className={cn(
                      "text-center text-ui-caption text-muted-foreground",
                      isEmbedded && "text-ui-micro",
                    )}
                  >
                    {t("challenge.declarerPassWatchHint")}
                  </p>
                ) : null}
              </div>
            </motion.div>
          ) : null}

          {isPick && holder ? (
            <motion.div
              key="challenge-pick-type"
              className="col-start-1 row-start-1 w-full min-w-0 justify-self-stretch"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={challengeStepCrossFade}
            >
              {pickSpotlightBlock}

              {isEmbedded ? (
                /* ── Embedded playfield band (fixed height) ───────────────────── */
                <div className={cn(CHALLENGE_AXIS_PLAYFIELD_STRIP_INNER_FIXED_CLASS, "gap-1.5 sm:gap-2")}>
                  <ChallengerAxisIdentityStrip
                    className="shrink-0"
                    phase="pick"
                    nickname={holder.nickname}
                    isLocalPlayer={isHolder}
                    hint={pickInstructionSr || null}
                    pickCountdown={{
                      smoothRemainFraction: smoothProgress,
                      displaySeconds,
                      urgent,
                    }}
                  />

                  <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    {!isHolder ? (
                      <div
                        className={CHALLENGE_AXIS_TILE_ROW_CLASS}
                        role="region"
                        aria-label={t("challenge.pickWaitShort", { player: holder.nickname })}
                      >
                        <p className="sr-only">{t("challenge.spectatorPickGhostCaption")}</p>
                        <div className={cn(CHALLENGE_AXIS_TILE_COL_CLASS, CHALLENGE_AXIS_TILE_SPECTATOR_WRAP_CLASS)} aria-hidden>
                          <ChallengeAxisPlayfieldTile axis="suit" emphasis="inactive" />
                        </div>
                        <div className={cn(CHALLENGE_AXIS_TILE_COL_CLASS, CHALLENGE_AXIS_TILE_SPECTATOR_WRAP_CLASS)} aria-hidden>
                          <ChallengeAxisPlayfieldTile axis="number" emphasis="inactive" />
                        </div>
                      </div>
                    ) : (
                      <div className={CHALLENGE_AXIS_TILE_ROW_CLASS}>
                        <div className={CHALLENGE_AXIS_TILE_COL_CLASS}>
                          <ChallengeAxisPlayfieldTile
                            axis="suit"
                            emphasis="active"
                            activeEmphasisStyle="pickMuted"
                            as="button"
                            onClick={() => onChallenge(localPlayerId, "suit")}
                            aria-label={`${t("challenge.wrongSuit")}. ${t("challenge.youHoldChallenge")}`}
                          />
                        </div>
                        <div className={CHALLENGE_AXIS_TILE_COL_CLASS}>
                          <ChallengeAxisPlayfieldTile
                            axis="number"
                            emphasis="active"
                            activeEmphasisStyle="pickMuted"
                            as="button"
                            onClick={() => onChallenge(localPlayerId, "number")}
                            aria-label={`${t("challenge.wrongNumber")}. ${t("challenge.youHoldChallenge")}`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ── Standalone glass panel ────────────────────────────────────── */
                <div className="flex flex-col gap-2">
                  <ChallengerAxisIdentityStrip
                    className="mb-1 w-full shrink-0"
                    phase="pick"
                    nickname={holder.nickname}
                    isLocalPlayer={isHolder}
                    hint={pickInstructionSr || null}
                  />

                  {!isHolder ? (
                    <div
                      className="mb-1.5 flex w-full justify-center gap-3 sm:gap-4"
                      role="region"
                      aria-label={t("challenge.pickWaitShort", { player: holder.nickname })}
                    >
                      <p className="sr-only">{t("challenge.spectatorPickGhostCaption")}</p>
                      <div
                        className={cn(
                          "pointer-events-none w-full flex-1 opacity-50 saturate-50 sm:flex-none",
                          CHALLENGE_PICK_STANDALONE_TILE_MAX_W_CLASS,
                        )}
                      >
                        <div
                          className={cn(
                            CHALLENGE_PICK_STANDALONE_TILE_SURFACE_CLASS,
                            "border border-dashed border-muted-foreground/50 bg-muted/30 shadow-inner",
                          )}
                        >
                          <Icon name="style" size={DEFAULT_PICK_ICON_SIZE} className="text-muted-foreground" fill={1} />
                          <span className="font-headline text-base font-bold leading-tight text-muted-foreground sm:text-lg">{t("challenge.wrongSuit")}</span>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "pointer-events-none w-full flex-1 opacity-50 saturate-50 sm:flex-none",
                          CHALLENGE_PICK_STANDALONE_TILE_MAX_W_CLASS,
                        )}
                      >
                        <div
                          className={cn(
                            CHALLENGE_PICK_STANDALONE_TILE_SURFACE_CLASS,
                            "border border-dashed border-muted-foreground/50 bg-muted/30 shadow-inner",
                          )}
                        >
                          <Icon name="counter_1" size={DEFAULT_PICK_ICON_SIZE} className="text-muted-foreground" fill={1} />
                          <span className="font-headline text-base font-bold leading-tight text-muted-foreground sm:text-lg">{t("challenge.wrongNumber")}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {canAct && isHolder ? (
                    <div className="flex w-full justify-center gap-3 sm:gap-4">
                      <div
                        className={cn("w-full flex-1 sm:flex-none", CHALLENGE_PICK_STANDALONE_TILE_MAX_W_CLASS)}
                      >
                        <button
                          type="button"
                          onClick={() => onChallenge(localPlayerId, "suit")}
                          className={cn(
                            CHALLENGE_PICK_STANDALONE_TILE_SURFACE_CLASS,
                            "border border-primary/40 bg-primary/10 shadow-sm transition-[box-shadow,transform,background-color,border-color]",
                            "hover:border-primary/55 hover:bg-primary/16 hover:shadow-md",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                            "motion-safe:active:scale-[0.98]",
                          )}
                          aria-label={`${t("challenge.wrongSuit")}. ${t("challenge.youHoldChallenge")}`}
                        >
                          <Icon name="style" size={DEFAULT_PICK_ICON_SIZE} className="text-primary" fill={1} />
                          <span className="font-headline text-base font-bold leading-tight text-foreground sm:text-lg">{t("challenge.wrongSuit")}</span>
                        </button>
                      </div>
                      <div
                        className={cn("w-full flex-1 sm:flex-none", CHALLENGE_PICK_STANDALONE_TILE_MAX_W_CLASS)}
                      >
                        <button
                          type="button"
                          onClick={() => onChallenge(localPlayerId, "number")}
                          className={cn(
                            CHALLENGE_PICK_STANDALONE_TILE_SURFACE_CLASS,
                            "border border-primary/40 bg-primary/10 shadow-sm transition-[box-shadow,transform,background-color,border-color]",
                            "hover:border-primary/55 hover:bg-primary/16 hover:shadow-md",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                            "motion-safe:active:scale-[0.98]",
                          )}
                          aria-label={`${t("challenge.wrongNumber")}. ${t("challenge.youHoldChallenge")}`}
                        >
                          <Icon name="counter_1" size={DEFAULT_PICK_ICON_SIZE} className="text-primary" fill={1} />
                          <span className="font-headline text-base font-bold leading-tight text-foreground sm:text-lg">{t("challenge.wrongNumber")}</span>
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <ChallengePickTimeBar
                    displaySeconds={displaySeconds}
                    smoothRemainFraction={smoothProgress}
                    urgent={urgent}
                  />
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
