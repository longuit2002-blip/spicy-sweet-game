"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { GamePlayer, ClientGamePlayer } from "@/shared/types/game";
import { GAME_PHASE, type GamePhase } from "@/shared/types/game";
import { cn } from "@/lib/utils";
import {
  OPPONENT_ACTIVE_PULSE_DURATION_SECONDS,
  OPPONENT_ACTIVE_PULSE_SCALE_PEAK_CENTER,
  OPPONENT_ACTIVE_PULSE_SCALE_PEAK_SIDE,
  OPPONENT_INCOMING_TURN_TRANSITION,
  SNAPPY_SPRING,
} from "@/features/game/animations";
import { playerPresenceStats } from "@/features/game/lib/player-presence-stats";

type BoardPlayer = GamePlayer | ClientGamePlayer;

const OPPONENT_STAT_MAX_PIPS = 8;

export type OpponentSeatBubbleProps = {
  opp: BoardPlayer;
  isCurrentTurn: boolean;
  turnRelative: number;
  phase: GamePhase;
  isUpNext: boolean;
  reducedMotion: boolean;
  carouselScale: number;
  carouselOpacity: number;
  isIncomingTurnEmphasis: boolean;
  rowStaggerDelay: number;
  /** True when this seat is the horizontal carousel anchor (center “hero”). */
  isCarouselFocus: boolean;
};

export function OpponentSeatBubble({
  opp,
  isCurrentTurn,
  turnRelative,
  phase,
  isUpNext,
  reducedMotion,
  carouselScale,
  carouselOpacity,
  isIncomingTurnEmphasis,
  rowStaggerDelay,
  isCarouselFocus,
}: OpponentSeatBubbleProps) {
  const { t } = useTranslation("game");
  const prefersReduced = useReducedMotion() === true;
  const reduce = reducedMotion || prefersReduced;
  const { hand, score, trophies } = playerPresenceStats(opp);

  const roleParts: string[] = [];
  if (isCurrentTurn) roleParts.push(t("seat.activeTurn"));
  if (isUpNext) roleParts.push(t("seat.upNext"));
  const roleLabel = roleParts.length > 0 ? roleParts.join(" · ") : "";

  const ariaSeat = t("seat.ariaSeat", {
    player: opp.nickname,
    hand,
    score,
    trophies,
    role: roleLabel || t("room.opponents"),
  });

  const showNextTurnStagger = phase === GAME_PHASE.NEXT_TURN && !reduce;
  const s = carouselScale;
  const activePulsePeak =
    isCarouselFocus || isIncomingTurnEmphasis
      ? OPPONENT_ACTIVE_PULSE_SCALE_PEAK_CENTER
      : OPPONENT_ACTIVE_PULSE_SCALE_PEAK_SIDE;

  const initial =
    isIncomingTurnEmphasis && !reduce
      ? { scale: s * 0.92, opacity: 0.88 }
      : showNextTurnStagger
        ? { opacity: 0.82, y: 10, scale: s }
        : undefined;

  const animate =
    isIncomingTurnEmphasis && !reduce
      ? { scale: s, opacity: carouselOpacity }
      : isCurrentTurn && !reduce
        ? { scale: [s, s * activePulsePeak, s], opacity: carouselOpacity }
        : { scale: s, opacity: carouselOpacity, y: 0 };

  const transition =
    isIncomingTurnEmphasis && !reduce
      ? OPPONENT_INCOMING_TURN_TRANSITION
      : isCurrentTurn && !reduce
        ? {
            scale: {
              duration: OPPONENT_ACTIVE_PULSE_DURATION_SECONDS,
              repeat: Infinity,
              ease: "easeInOut" as const,
            },
            opacity: { duration: 0.2 },
          }
        : showNextTurnStagger
          ? { ...SNAPPY_SPRING, delay: rowStaggerDelay }
          : { duration: 0.2 };

  const showHeroShine =
    !reduce && isCarouselFocus && (isCurrentTurn || isIncomingTurnEmphasis || phase === GAME_PHASE.NEXT_TURN);

  return (
    <motion.div
      layout={!reduce}
      className={cn("pointer-events-auto flex flex-col items-center")}
      aria-label={ariaSeat}
      data-turn-relative={turnRelative}
      initial={initial}
      animate={animate}
      transition={transition}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-md border-[3px] bg-gradient-to-b from-card/95 via-card/88 to-muted/90 shadow-[var(--shadow-card)] transition-[box-shadow,border-color] duration-300",
          "ring-1 ring-inset ring-white/[0.08]",
          isCarouselFocus
            ? "border-[hsl(var(--trophy-gold)/0.72)] shadow-[var(--shadow-card),0_0_36px_hsl(var(--primary)/0.28),inset_0_1px_0_hsl(var(--trophy-glow)/0.2)]"
            : "border-[hsl(var(--trophy-gold)/0.32)]",
          isCurrentTurn &&
            "border-[hsl(var(--primary)/0.65)] shadow-[var(--shadow-card),var(--shadow-glow),inset_0_0_24px_hsl(var(--primary)/0.08)]",
          isUpNext && !isCurrentTurn && "border-dashed border-[hsl(var(--trophy-gold)/0.5)]",
        )}
      >
        <span
          className="pointer-events-none absolute left-1/2 top-0 z-[2] h-0.5 w-[72%] -translate-x-1/2 rounded-full bg-[var(--gradient-gold)] opacity-70"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_2px_14px_hsl(0_0%_100%/0.06),inset_0_-8px_20px_hsl(0_0%_0%/0.35)]"
          aria-hidden
        />
        {["top-1 left-1", "top-1 right-1", "bottom-8 left-1", "bottom-8 right-1"].map((pos) => (
          <span
            key={pos}
            className={cn(
              "pointer-events-none absolute z-[2] size-1.5 rounded-full border border-[hsl(var(--trophy-gold)/0.45)] bg-muted/90 shadow-inner",
              pos,
            )}
            aria-hidden
          />
        ))}
        {isCurrentTurn && !reduce ? (
          <span
            className="pointer-events-none absolute -inset-[3px] -z-10 rounded-[inherit] bg-primary/25 blur-xl motion-safe:opacity-90"
            aria-hidden
          />
        ) : null}
        {showHeroShine ? (
          <span
            className="pointer-events-none absolute inset-0 z-[3] w-[45%] bg-gradient-to-r from-transparent via-white/30 to-transparent opponent-tcg-shine-animate"
            aria-hidden
          />
        ) : null}

        <div className="relative z-[1] flex flex-col items-center gap-1 px-1.5 pb-2 pt-2.5 sm:gap-1.5 sm:px-2 sm:pb-2.5 sm:pt-3">
          <div className="relative">
            {isUpNext && !isCurrentTurn && !reduce ? (
              <span
                className="pointer-events-none absolute -inset-1 z-0 rounded-lg border-2 border-dashed border-primary/55 motion-safe:animate-ping motion-reduce:animate-none"
                style={{ animationDuration: "2.5s" }}
                aria-hidden
              />
            ) : null}
            <div
              className={cn(
                "relative z-[1] flex h-[3.75rem] w-[3.75rem] items-center justify-center overflow-hidden rounded-md border-[3px] bg-[hsl(var(--surface-rail)/0.85)] shadow-inner backdrop-blur-[1px] sm:h-[4.25rem] sm:w-[4.25rem] md:h-[5rem] md:w-[5rem]",
                "transition-[border-color,box-shadow] duration-300",
                isCurrentTurn
                  ? "border-[hsl(var(--primary)/0.7)] shadow-[inset_0_0_0_1px_hsl(var(--trophy-gold)/0.35),0_0_20px_hsl(var(--primary)/0.25)]"
                  : isUpNext
                    ? "border-[hsl(var(--primary)/0.38)]"
                    : "border-[hsl(var(--trophy-gold)/0.28)]",
              )}
            >
              <span className="select-none bg-[var(--gradient-gold)] bg-clip-text font-display text-2xl font-bold text-transparent drop-shadow-sm sm:text-3xl md:text-4xl">
                {opp.nickname[0]?.toUpperCase()}
              </span>
            </div>
          </div>

          <div
            className={cn(
              "-skew-x-6 transform-gpu px-2 py-0.5 sm:py-1",
              "w-[min(100%,8.25rem)] border border-[hsl(var(--trophy-gold)/0.4)] bg-gradient-to-b from-background/80 to-muted/70 text-center shadow-sm backdrop-blur-[2px] sm:w-[min(100%,9.5rem)]",
              isCurrentTurn && "border-[hsl(var(--primary)/0.55)] from-primary/15 to-primary/5",
              isUpNext && !isCurrentTurn && "border-dashed border-primary/45",
            )}
          >
            <span
              className={cn(
                "block skew-x-6 truncate px-0.5 font-display text-ui-micro font-bold uppercase tracking-wide text-foreground sm:text-ui-caption",
                isCurrentTurn && "text-[hsl(var(--trophy-gold))] drop-shadow-[0_0_8px_hsl(var(--trophy-glow)/0.35)]",
              )}
            >
              {opp.nickname}
            </span>
          </div>

          {isCurrentTurn ? (
            <span className="sr-only">{t("seat.activeTurn")}</span>
          ) : isUpNext ? (
            <span className="sr-only">{t("seat.upNext")}</span>
          ) : null}

          <div
            className="flex max-w-[7.25rem] flex-col items-center gap-1 text-ui-tiny text-muted-foreground sm:max-w-[8.5rem] sm:text-ui-micro"
            aria-hidden
          >
            <div className="flex flex-wrap justify-center gap-0.5">
              {Array.from({ length: Math.min(hand, OPPONENT_STAT_MAX_PIPS) }).map((_, i) => (
                <span
                  key={i}
                  className="inline-block h-2.5 w-1.5 rounded-[2px] border border-[hsl(var(--trophy-gold)/0.25)] bg-card-back shadow-[inset_0_1px_0_hsl(0_0%_100%/0.12)]"
                />
              ))}
              {hand > OPPONENT_STAT_MAX_PIPS ? (
                <span className="self-center text-ui-tiny text-muted-foreground">+{hand - OPPONENT_STAT_MAX_PIPS}</span>
              ) : null}
            </div>
            <div className="flex w-full items-stretch justify-center gap-1.5 tabular-nums">
              <span className="flex min-w-0 flex-1 items-center justify-center gap-0.5 rounded border border-[hsl(var(--trophy-gold)/0.22)] bg-background/40 px-1 py-0.5 text-center font-headline shadow-inner">
                <span aria-hidden>⭐</span>
                <strong className="text-foreground">{score}</strong>
              </span>
              <span className="flex min-w-0 flex-1 items-center justify-center gap-0.5 rounded border border-[hsl(var(--trophy-gold)/0.22)] bg-background/40 px-1 py-0.5 text-center font-headline shadow-inner">
                <span aria-hidden>🏆</span>
                <strong className="text-foreground">{trophies}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
