"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { ChallengeType, ClientPlayedCard, PlayedCard, Player } from "@/shared/types/game";
import type { ChallengeStep } from "@/shared/types/game";
import { SPICE_EMOJI, SPICE_LABEL } from "@/shared/types/game";
import { cn } from "@/lib/utils";
import { SNAPPY_SPRING } from "@/features/game/animations";
import { Icon } from "@/components/ui/icon";
import { playerPresenceStats } from "@/features/game/lib/player-presence-stats";
import { useSmoothCountdownRemainder } from "@/features/game/hooks/use-smooth-countdown-remainder";

const CONTEXT_STRIP_MAX_PIPS = 6;

/** Embedded board: pick tiles — sized for touch / readability on the playfield strip. */
const EMBEDDED_PICK_ICON_SIZE = 52;
/** Standalone glass panel — match embedded legibility. */
const DEFAULT_PICK_ICON_SIZE = 52;

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
          focal ? "text-[11px]" : "text-[10px]",
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
          focal ? "text-[11px] sm:text-xs" : "text-[10px]",
        )}
        aria-label={t("challenge.contextChipStats", { hand, score, trophies })}
      >
        <span className="flex items-center gap-0.5" aria-hidden>
          {Array.from({ length: Math.min(hand, CONTEXT_STRIP_MAX_PIPS) }).map((_, i) => (
            <span key={i} className="inline-block h-2.5 w-1.5 rounded-sm border border-border bg-card-back" />
          ))}
          {hand > CONTEXT_STRIP_MAX_PIPS ? (
            <span className="text-[9px]">+{hand - CONTEXT_STRIP_MAX_PIPS}</span>
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
        embeddedCompact ? "mt-1.5" : "mt-3",
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
  challengeTimer: number;
  /** Denominator for the countdown (matches server initial seconds for current step). */
  countdownTotalSeconds: number;
  onClaimChallenge: () => void;
  onChallenge: (challengerId: string, challengeType: ChallengeType) => void;
  /** Optional — accept control removed from UI for now; parent may still wire server accept later. */
  onAccept?: () => void;
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
  challengeTimer,
  countdownTotalSeconds,
  onClaimChallenge,
  onChallenge,
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

  const pickSpotlight = showPickSpotlight ? (
    <div className="mb-3 flex justify-center px-1">
      {isHolder ? (
        <ChallengePickContextChip focal roleLabel={t("challenge.declareRole")} player={playerWhoPlayed} />
      ) : (
        <ChallengePickContextChip focal roleLabel={t("challenge.holderRole")} player={holder} />
      )}
    </div>
  ) : null;

  return (
    <div
      className={cn(
        "relative w-full",
        isEmbedded
          ? "mx-auto mt-0 flex w-full max-w-lg shrink-0 flex-col items-center pt-2 sm:max-w-xl sm:pt-3 lg:max-w-2xl"
          : "game-glass-panel max-w-lg rounded-2xl p-4 sm:p-5",
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

      {isPick ? pickSpotlight : null}

      {isRace && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={SNAPPY_SPRING}
          className={cn("mb-4 flex flex-col items-center gap-2", isEmbedded && "mb-2 gap-1.5")}
        >
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
        </motion.div>
      )}

      {isPick && holder ? (
        <>
          <p className="sr-only">{pickInstructionSr}</p>
          {!isHolder ? (
            <div
              className={cn(
                "mb-2 flex w-full flex-col items-center gap-2.5 sm:mb-3 sm:gap-3",
                isEmbedded && "px-1",
              )}
              role="region"
              aria-label={t("challenge.pickWaitShort", { player: holder.nickname })}
            >
              <div className="text-center">
                <p className="text-[11px] font-bold uppercase tracking-wide text-foreground sm:text-xs">
                  {t("challenge.spectatorPickTitle")}
                </p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground sm:text-sm">
                  {t("challenge.spectatorPickSubline", { player: holder.nickname })}
                </p>
              </div>
              <p className="sr-only">{t("challenge.spectatorPickGhostCaption")}</p>
              <div
                className={cn(
                  "flex w-full flex-nowrap items-stretch justify-center gap-3 sm:gap-4",
                  isEmbedded && "mx-auto max-w-2xl px-0.5 sm:px-1",
                )}
                aria-hidden
              >
                <div
                  className={cn(
                    "pointer-events-none min-w-0 flex-1 opacity-50 grayscale-[0.25]",
                    isEmbedded
                      ? "max-w-[calc(50%-0.4rem)] min-w-[8rem] sm:min-w-[10.5rem] sm:max-w-none"
                      : "w-full max-w-[13rem] min-w-[10rem] flex-1 sm:flex-none",
                  )}
                >
                  <div
                    className={cn(
                      "flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-muted-foreground/40 bg-muted/25 text-center shadow-inner",
                      isEmbedded
                        ? "min-h-[7.75rem] gap-2.5 px-3 py-3.5 sm:min-h-[9rem] sm:gap-3 sm:px-5 sm:py-4"
                        : "aspect-[4/5] min-h-[8.25rem] gap-2.5 rounded-md p-4",
                    )}
                  >
                    <Icon
                      name="style"
                      size={isEmbedded ? EMBEDDED_PICK_ICON_SIZE : DEFAULT_PICK_ICON_SIZE}
                      className="text-muted-foreground"
                      fill={1}
                    />
                    <span
                      className={cn(
                        "font-headline font-bold leading-tight text-muted-foreground",
                        isEmbedded ? "text-sm sm:text-base" : "text-base sm:text-lg",
                      )}
                    >
                      {t("challenge.wrongSuit")}
                    </span>
                  </div>
                </div>
                <div
                  className={cn(
                    "pointer-events-none min-w-0 flex-1 opacity-50 grayscale-[0.25]",
                    isEmbedded
                      ? "max-w-[calc(50%-0.4rem)] min-w-[8rem] sm:min-w-[10.5rem] sm:max-w-none"
                      : "w-full max-w-[13rem] min-w-[10rem] flex-1 sm:flex-none",
                  )}
                >
                  <div
                    className={cn(
                      "flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-muted-foreground/40 bg-muted/25 text-center shadow-inner",
                      isEmbedded
                        ? "min-h-[7.75rem] gap-2.5 px-3 py-3.5 sm:min-h-[9rem] sm:gap-3 sm:px-5 sm:py-4"
                        : "aspect-[4/5] min-h-[8.25rem] gap-2.5 rounded-md p-4",
                    )}
                  >
                    <Icon
                      name="counter_1"
                      size={isEmbedded ? EMBEDDED_PICK_ICON_SIZE : DEFAULT_PICK_ICON_SIZE}
                      className="text-muted-foreground"
                      fill={1}
                    />
                    <span
                      className={cn(
                        "font-headline font-bold leading-tight text-muted-foreground",
                        isEmbedded ? "text-sm sm:text-base" : "text-base sm:text-lg",
                      )}
                    >
                      {t("challenge.wrongNumber")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {canAct && isHolder ? (
            <div
              className={cn(
                "flex flex-nowrap items-stretch justify-center gap-3 sm:gap-4",
                isEmbedded && "mx-auto w-full max-w-2xl px-0.5 sm:px-1",
              )}
            >
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reducedMotion ? 0 : 0.06, ...SNAPPY_SPRING }}
                className={cn(
                  "min-w-0 flex-1",
                  isEmbedded
                    ? "max-w-[calc(50%-0.4rem)] min-w-[8rem] sm:min-w-[10.5rem] sm:max-w-none"
                    : "w-full max-w-[13rem] min-w-[10rem] flex-1 sm:flex-none",
                )}
              >
                <button
                  type="button"
                  onClick={() => onChallenge(localPlayerId, "suit")}
                  className={cn(
                    "flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-primary/35 bg-card text-center shadow-sm transition-[box-shadow,transform,background-color,border-color]",
                    "hover:border-primary/55 hover:bg-card hover:shadow-md hover:ring-2 hover:ring-primary/20",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                    "motion-safe:active:scale-[0.98]",
                    isEmbedded
                      ? "min-h-[7.75rem] gap-2.5 px-3 py-3.5 sm:min-h-[9rem] sm:gap-3 sm:px-5 sm:py-4"
                      : "aspect-[4/5] min-h-[8.25rem] gap-2.5 rounded-md p-4",
                  )}
                  aria-label={`${t("challenge.wrongSuit")}. ${t("challenge.youHoldChallenge")}`}
                >
                  <Icon
                    name="style"
                    size={isEmbedded ? EMBEDDED_PICK_ICON_SIZE : DEFAULT_PICK_ICON_SIZE}
                    className="text-primary"
                    fill={1}
                  />
                  <span
                    className={cn(
                      "font-headline font-bold leading-tight text-foreground",
                      isEmbedded ? "text-sm sm:text-base" : "text-base sm:text-lg",
                    )}
                  >
                    {t("challenge.wrongSuit")}
                  </span>
                </button>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reducedMotion ? 0 : 0.1, ...SNAPPY_SPRING }}
                className={cn(
                  "min-w-0 flex-1",
                  isEmbedded
                    ? "max-w-[calc(50%-0.4rem)] min-w-[8rem] sm:min-w-[10.5rem] sm:max-w-none"
                    : "w-full max-w-[13rem] min-w-[10rem] flex-1 sm:flex-none",
                )}
              >
                <button
                  type="button"
                  onClick={() => onChallenge(localPlayerId, "number")}
                  className={cn(
                    "flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-primary/35 bg-card text-center shadow-sm transition-[box-shadow,transform,background-color,border-color]",
                    "hover:border-primary/55 hover:bg-card hover:shadow-md hover:ring-2 hover:ring-primary/20",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                    "motion-safe:active:scale-[0.98]",
                    isEmbedded
                      ? "min-h-[7.75rem] gap-2.5 px-3 py-3.5 sm:min-h-[9rem] sm:gap-3 sm:px-5 sm:py-4"
                      : "aspect-[4/5] min-h-[8.25rem] gap-2.5 rounded-md p-4",
                  )}
                  aria-label={`${t("challenge.wrongNumber")}. ${t("challenge.youHoldChallenge")}`}
                >
                  <Icon
                    name="counter_1"
                    size={isEmbedded ? EMBEDDED_PICK_ICON_SIZE : DEFAULT_PICK_ICON_SIZE}
                    className="text-primary"
                    fill={1}
                  />
                  <span
                    className={cn(
                      "font-headline font-bold leading-tight text-foreground",
                      isEmbedded ? "text-sm sm:text-base" : "text-base sm:text-lg",
                    )}
                  >
                    {t("challenge.wrongNumber")}
                  </span>
                </button>
              </motion.div>
            </div>
          ) : null}

          <ChallengePickTimeBar
            displaySeconds={displaySeconds}
            smoothRemainFraction={smoothProgress}
            urgent={urgent}
            embeddedCompact={isEmbedded}
          />
        </>
      ) : null}
    </div>
  );
}
