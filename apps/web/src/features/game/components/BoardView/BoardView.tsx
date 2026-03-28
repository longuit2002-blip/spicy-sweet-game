"use client";

import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { GameTableDeclarationSection, GameTableTableauSection } from "@/features/game/components/GameTable";
import type { GameTablePlayfieldProps } from "@/features/game/components/GameTable";
import { PlaymatAnchorProvider, usePlaymatAnchors } from "@/features/game/components/playmat-anchors";
import {
  RoundResolutionFxOverlay,
  type PenaltyFxSnapshot,
} from "@/features/game/components/RoundResolutionFxOverlay";
import { ChallengeRevealImpactOverlay } from "@/features/game/components/ChallengeRevealImpactOverlay";
import { useChallengeRevealSfx } from "@/features/game/hooks/use-challenge-reveal-sfx";
import { ChallengePhase } from "@/features/game/components/ChallengePhase/ChallengePhase";
import type { ChallengePhaseProps } from "@/features/game/components/ChallengePhase/ChallengePhase";
import type { GamePlayer, ClientGamePlayer } from "@/shared/types/game";
import { GAME_PHASE } from "@/shared/types/game";
import { cn } from "@/lib/utils";
import { SNAPPY_SPRING } from "@/features/game/animations";
import { playerPresenceStats } from "@/features/game/lib/player-presence-stats";
import {
  isRoundResolutionInterstitialPhase,
  ROUND_RESOLUTION_BOTTOM_STRIP_MIN_H,
} from "@/lib/game-room.constants";

type BoardPlayer = GamePlayer | ClientGamePlayer;

/** Max opponents drawn on the ring (positions still use full `players.length` for angle step). */
const RING_OPPONENT_CAP = 6;

/** Horizontal radius as % of ring container half-width (ellipse); higher = seats hug left/right edges. */
const ROUND_TABLE_RADIUS_X_PERCENT = 49;

/** Vertical radius as % of ring container half-height (ellipse); higher = seats hug top/bottom of ring box. */
const ROUND_TABLE_RADIUS_Y_PERCENT = 44;

/**
 * Turn order relative to current player (logic / a11y). Same as
 * `(playerIndex - currentPlayerIndex + totalPlayers) % totalPlayers`.
 * 0 = whose turn it is; does not move seats — UI stays local-bottom-centric.
 */
export function turnRelativeIndex(
  playerIndex: number,
  currentPlayerIndex: number,
  totalPlayers: number,
): number {
  return (playerIndex - currentPlayerIndex + totalPlayers) % totalPlayers;
}

/** Seat index around the table with local player at 0 (bottom, not drawn on ring). */
function localSeatIndex(playerIndex: number, localPlayerIndex: number, totalPlayers: number): number {
  return (playerIndex - localPlayerIndex + totalPlayers) % totalPlayers;
}

/**
 * Polar angle (radians): seat 0 = bottom center (local), increasing counter-clockwise on screen.
 * Step between adjacent seats = 2π / totalPlayers (e.g. 4 → 90°, 5 → 72°, 6 → 60°).
 */
function seatAngleRadFromLocalBottom(seatIndex: number, totalPlayers: number): number {
  return Math.PI / 2 + (2 * Math.PI * seatIndex) / totalPlayers;
}

const OPPONENT_STAT_MAX_PIPS = 8;

function OpponentSeatBubble({
  opp,
  isCurrentTurn,
  turnRelative,
}: {
  opp: BoardPlayer;
  isCurrentTurn: boolean;
  /** From {@link turnRelativeIndex}; 0 = current turn (logic layer). */
  turnRelative: number;
}) {
  const { t } = useTranslation("game");
  const { hand, score, trophies } = playerPresenceStats(opp);

  return (
    <div
      className={cn(
        "pointer-events-auto flex flex-col items-center gap-1.5 rounded-2xl p-1.5 transition-[background-color,box-shadow]",
        isCurrentTurn && "bg-primary/12 shadow-kawaii ring-2 ring-primary/35 ring-offset-2 ring-offset-background",
      )}
      data-turn-relative={turnRelative}
    >
      <div className="relative">
        <div
          className={cn(
            "flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 bg-background/40 shadow-sm backdrop-blur-[2px] sm:h-[4.5rem] sm:w-[4.5rem]",
            "ring-2 ring-offset-2 ring-offset-background transition-shadow",
            isCurrentTurn
              ? "border-primary ring-primary shadow-md"
              : "border-foreground/[0.12] ring-primary/15",
          )}
        >
          <span className="text-2xl font-bold text-primary sm:text-3xl">
            {opp.nickname[0]?.toUpperCase()}
          </span>
        </div>
      </div>
      <span
        className={cn(
          "max-w-[6.5rem] truncate rounded-full border border-foreground/[0.12] bg-background/50 px-3 py-1 text-center font-headline text-xs font-bold text-foreground backdrop-blur-[2px]",
          isCurrentTurn && "border-primary/45 bg-primary/10 text-foreground",
        )}
      >
        {opp.nickname}
      </span>
      <div
        className="flex max-w-[7.5rem] flex-col items-center gap-0.5 text-[10px] text-muted-foreground"
        aria-label={t("challenge.contextChipStats", { hand, score, trophies })}
      >
        <div className="flex flex-wrap justify-center gap-0.5" aria-hidden>
          {Array.from({ length: Math.min(hand, OPPONENT_STAT_MAX_PIPS) }).map((_, i) => (
            <span key={i} className="inline-block h-2.5 w-1.5 rounded-sm border border-border bg-card-back" />
          ))}
          {hand > OPPONENT_STAT_MAX_PIPS ? (
            <span className="text-[9px] text-muted-foreground">+{hand - OPPONENT_STAT_MAX_PIPS}</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 tabular-nums">
          <span>
            ⭐ <strong className="text-foreground">{score}</strong>
          </span>
          <span>
            🏆 <strong className="text-foreground">{trophies}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}

export interface BoardViewProps extends Omit<GameTablePlayfieldProps, "roundResolutionPanel"> {
  players: readonly BoardPlayer[];
  localPlayerId: string;
  /** Index in `players` for the active turn — drives {@link turnRelativeIndex} (logic, not seat motion). */
  currentPlayerIndex: number;
  currentPlayer: BoardPlayer | undefined;
  isMyTurn: boolean;
  /**
   * When `phase === CHALLENGE_PHASE` and `playedCard` is set, renders {@link ChallengePhase} below the playfield.
   */
  inlineChallenge?: Omit<ChallengePhaseProps, "playedCard" | "variant"> | null;
  /** REVEAL / PENALTY / NEXT_TURN / TROPHY_AWARDED UI below the playfield on the same stage. */
  phaseContent?: ReactNode | null;
  /** Local seat + hand — below the playfield in the same column. */
  tableFooter?: ReactNode | null;
  /** Set during `PENALTY` for flight VFX (challenge cleared from state; use snapshot from room client). */
  penaltyFxSnapshot?: PenaltyFxSnapshot | null;
}

export function BoardView(props: BoardViewProps) {
  return (
    <PlaymatAnchorProvider>
      <BoardViewImpl {...props} />
    </PlaymatAnchorProvider>
  );
}

function BoardViewImpl({
  players,
  localPlayerId,
  currentPlayerIndex,
  currentPlayer,
  isMyTurn,
  playedCard,
  currentPlayerName,
  phase,
  lastResolvedDeclaration,
  lockedSuit,
  tablePileCount,
  drawPileCount,
  supremeReserve,
  trophiesRemaining,
  inlineChallenge = null,
  phaseContent = null,
  tableFooter = null,
  playDropZone = null,
  challengeResult = null,
  penaltyFxSnapshot = null,
}: BoardViewProps) {
  const { drawStackRef, roundPileRailRef } = usePlaymatAnchors();
  const { t } = useTranslation("game");
  const reducedMotion = useReducedMotion() === true;
  useChallengeRevealSfx(phase, challengeResult, localPlayerId, reducedMotion);
  const localIdx = useMemo(() => players.findIndex((p) => p.id === localPlayerId), [players, localPlayerId]);
  const totalPlayers = players.length;

  const ringSlots = useMemo(() => {
    if (localIdx < 0 || totalPlayers < 2) return [];

    const slots: {
      player: BoardPlayer;
      playerIndex: number;
      leftPct: number;
      topPct: number;
      turnRelative: number;
    }[] = [];

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (p.id === localPlayerId) continue;

      const seatRel = localSeatIndex(i, localIdx, totalPlayers);

      const θ = seatAngleRadFromLocalBottom(seatRel, totalPlayers);
      const leftPct = 50 + ROUND_TABLE_RADIUS_X_PERCENT * Math.cos(θ);
      const topPct = 50 + ROUND_TABLE_RADIUS_Y_PERCENT * Math.sin(θ);
      const turnRelative = turnRelativeIndex(i, currentPlayerIndex, totalPlayers);

      slots.push({ player: p, playerIndex: i, leftPct, topPct, turnRelative });
    }

    return slots.slice(0, RING_OPPONENT_CAP);
  }, [players, localPlayerId, localIdx, totalPlayers, currentPlayerIndex]);

  const sortedOpponentSlots = useMemo(
    () => [...ringSlots].sort((a, b) => a.leftPct - b.leftPct),
    [ringSlots],
  );

  const isChallenge = phase === GAME_PHASE.CHALLENGE_PHASE;
  const showChallengeInline = isChallenge && playedCard != null && inlineChallenge != null;

  const tableauDuelProps = {
    drawPileCount,
    tablePileCount,
    supremeReserve,
    trophiesRemaining,
    lockedSuit,
  };

  /** Fill scroll column height for declaration + interstitial messaging. */
  const stretchPlayfieldBlock =
    playedCard != null ||
    phase === GAME_PHASE.PLAYER_TURN ||
    isRoundResolutionInterstitialPhase(phase);

  /**
   * Center the scroll column on large viewports when there is an on-table claim or an active turn.
   * PENALTY / NEXT_TURN / trophy panels live in {@link GameTableDeclarationSection} (not the strip below).
   */
  /** REVEAL excluded: vertical centering with `playedCard` forces tall flex and scroll; top-align REVEAL instead. */
  const verticallyCenterPlayfieldInScroll =
    (playedCard != null && phase !== GAME_PHASE.REVEAL) || phase === GAME_PHASE.PLAYER_TURN;

  const playfieldInterstitial = isRoundResolutionInterstitialPhase(phase);

  /** Hold strip height across REVEAL → PENALTY so the playfield does not jump when copy mounts. */
  const reserveRoundResolutionStrip =
    phase === GAME_PHASE.REVEAL || phase === GAME_PHASE.PENALTY;

  const challengeOutcomeNames = useMemo((): { challenger: string; declarer: string } | null => {
    if (!challengeResult) return null;
    return {
      challenger: players.find((p) => p.id === challengeResult.challengerId)?.nickname ?? "",
      declarer: players.find((p) => p.id === challengeResult.playerId)?.nickname ?? "",
    };
  }, [challengeResult, players]);

  /** Interstitial round UI is rendered inside {@link GameTableDeclarationSection}, not the strip below. */
  const mergeRoundResolutionInTable = playfieldInterstitial && phaseContent != null;
  const phaseContentInStrip = phaseContent != null && !mergeRoundResolutionInTable;

  const boardScrollColumnRef = useRef<HTMLDivElement>(null);
  const boardScrollInnerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (phase !== GAME_PHASE.REVEAL) return;
    const scrollEl = boardScrollColumnRef.current;
    const innerEl = boardScrollInnerRef.current;
    const doc = document.documentElement;
    const scrollCH = scrollEl?.clientHeight ?? -1;
    const scrollSH = scrollEl?.scrollHeight ?? -1;
    const innerOH = innerEl?.offsetHeight ?? -1;
    const data = {
      verticallyCenterPlayfieldInScroll,
      stretchPlayfieldBlock,
      mergeRoundResolutionInTable,
      viewportH: window.innerHeight,
      viewportW: window.innerWidth,
      docClientH: doc.clientHeight,
      docScrollH: doc.scrollHeight,
      bodyScrollH: document.body.scrollHeight,
      scrollClientH: scrollCH,
      scrollScrollH: scrollSH,
      innerOffsetH: innerOH,
      scrollOverflowY: scrollSH > scrollCH + 1,
      pageOverflowY: doc.scrollHeight > doc.clientHeight + 1,
    };
    // #region agent log
    fetch("http://127.0.0.1:7545/ingest/dfeb2aae-d72a-4d3e-9028-a1269ee253e7", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "eae836" },
      body: JSON.stringify({
        sessionId: "eae836",
        runId: "pre-fix",
        hypothesisId: "H1-H5-layout",
        location: "BoardView.tsx:useLayoutEffect(REVEAL)",
        message: "REVEAL scroll metrics",
        data,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [
    phase,
    verticallyCenterPlayfieldInScroll,
    stretchPlayfieldBlock,
    mergeRoundResolutionInTable,
    challengeResult,
  ]);

  const playfieldColumn = (
    <div
      className={cn(
        "flex min-h-0 w-full flex-col",
        playfieldInterstitial ? "gap-2 sm:gap-3" : "gap-3 sm:gap-4",
        stretchPlayfieldBlock && "flex-1",
        showChallengeInline
          ? "items-center gap-2 sm:gap-3"
          : "items-stretch",
      )}
    >
      <GameTableDeclarationSection
        playedCard={playedCard}
        currentPlayerName={currentPlayerName}
        phase={phase}
        lastResolvedDeclaration={lastResolvedDeclaration}
        lockedSuit={lockedSuit}
        tablePileCount={tablePileCount}
        showEmptyStateTurnLine={false}
        playDropZone={playDropZone}
        challengeResult={challengeResult}
        challengeOutcomeNames={challengeOutcomeNames}
        localPlayerId={localPlayerId}
        roundPileAnchorRef={roundPileRailRef}
        roundResolutionPanel={mergeRoundResolutionInTable ? phaseContent : null}
      />

      {showChallengeInline && playedCard && inlineChallenge ? (
        <ChallengePhase variant="embedded" playedCard={playedCard} {...inlineChallenge} />
      ) : null}

      <div
        className={cn(
          "relative w-full shrink-0",
          !mergeRoundResolutionInTable &&
            reserveRoundResolutionStrip &&
            ROUND_RESOLUTION_BOTTOM_STRIP_MIN_H,
          !mergeRoundResolutionInTable && !reserveRoundResolutionStrip && "min-h-0",
          phase === GAME_PHASE.REVEAL &&
            phaseContent == null &&
            "flex flex-col items-center border-t border-border/20 pt-2 sm:pt-2.5",
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {phaseContentInStrip ? (
            <motion.div
              key={phase}
              initial={
                isRoundResolutionInterstitialPhase(phase)
                  ? false
                  : { opacity: 0, y: 6 }
              }
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={SNAPPY_SPRING}
              className="flex w-full min-h-0 flex-col items-center border-t border-border/25 pt-4"
            >
              {phaseContent}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <div className="table-stage-bg relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <ChallengeRevealImpactOverlay
        phase={phase}
        challengeResult={challengeResult}
        localPlayerId={localPlayerId}
      />
      <RoundResolutionFxOverlay
        phase={phase}
        penaltyFxSnapshot={penaltyFxSnapshot}
        localPlayerId={localPlayerId}
      />
      <div className="relative mx-auto flex min-h-0 w-full max-w-none flex-1 flex-col px-2 py-1.5 sm:px-4 sm:py-2">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 sm:gap-2.5">
          {sortedOpponentSlots.length > 0 ? (
            <div
              role="list"
              aria-label={t("room.opponents")}
              className="shrink-0 overflow-x-auto overflow-y-visible [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="flex min-w-min justify-center gap-5 px-2 py-1 sm:gap-7">
                {sortedOpponentSlots.map(({ player, turnRelative }) => (
                  <div key={player.id} role="listitem" className="shrink-0">
                    <OpponentSeatBubble
                      opp={player}
                      isCurrentTurn={currentPlayer?.id === player.id}
                      turnRelative={turnRelative}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="relative z-10 mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col px-1 sm:px-2">
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-x-4 lg:gap-y-2",
              )}
            >
              <div className="flex shrink-0 justify-between gap-3 px-1 sm:gap-6 lg:contents">
                <div className="tableau-supply-rail flex justify-center lg:col-start-1 lg:row-start-1">
                  <GameTableTableauSection
                    {...tableauDuelProps}
                    variant="duel"
                    duelSlot="trophy"
                  />
                </div>
                <div className="tableau-supply-rail flex justify-center lg:col-start-3 lg:row-start-1">
                  <GameTableTableauSection
                    {...tableauDuelProps}
                    variant="duel"
                    duelSlot="draw"
                    drawStackAnchorRef={drawStackRef}
                  />
                </div>
              </div>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:col-start-2 lg:row-start-1">
                <div
                  ref={boardScrollColumnRef}
                  className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain"
                >
                  <div
                    ref={boardScrollInnerRef}
                    className={cn(
                      "flex min-h-full w-full min-w-0 flex-col gap-3 sm:gap-4",
                      "px-2 pb-3 pt-1 sm:px-4 sm:pt-2",
                      stretchPlayfieldBlock && "lg:flex-1 lg:min-h-0",
                      verticallyCenterPlayfieldInScroll && "lg:justify-center",
                    )}
                  >
                    {playfieldColumn}
                  </div>
                </div>
              </div>
            </div>

            {phase === GAME_PHASE.PLAYER_TURN && (
              <p className="shrink-0 px-1 pt-2 text-center text-sm text-muted-foreground sm:pt-2">
                <span className="font-semibold text-foreground">{currentPlayer?.nickname}</span>
                &nbsp;
                {isMyTurn ? t("turn.yourTurn") : t("turn.waitingTurn", { player: currentPlayer?.nickname })}
              </p>
            )}

            {tableFooter != null ? (
              <div className="w-full shrink-0 -mx-1 bg-transparent px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3 sm:-mx-2 sm:px-6 sm:pt-3">
                {tableFooter}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
