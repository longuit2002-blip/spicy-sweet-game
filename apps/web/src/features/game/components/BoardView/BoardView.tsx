"use client";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
  pointerWithin,
} from "@dnd-kit/core";
import { useCallback, useMemo, useState, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  DuelDrawPassDragGhost,
  GameTableDeclarationSection,
  GameTableTableauSection,
} from "@/features/game/components/GameTable";
import type { DrawPassActionConfig, GameTablePlayfieldProps } from "@/features/game/components/GameTable";
import { PlaymatAnchorProvider, usePlaymatAnchors } from "@/features/game/components/playmat-anchors";
import {
  RoundResolutionFxOverlay,
  type PenaltyFxSnapshot,
} from "@/features/game/components/RoundResolutionFxOverlay";
import { ChallengeRevealImpactOverlay } from "@/features/game/components/ChallengeRevealImpactOverlay";
import { NextTurnImpactOverlay } from "@/features/game/components/NextTurnImpactOverlay";
import { PenaltyResultImpactOverlay } from "@/features/game/components/PenaltyResultImpactOverlay";
import { useChallengeRevealSfx } from "@/features/game/hooks/use-challenge-reveal-sfx";
import { usePenaltyResultSfx } from "@/features/game/hooks/use-penalty-result-sfx";
import { useOpponentTurnSfx } from "@/features/game/hooks/use-opponent-turn-sfx";
import { OpponentsTurnCarousel } from "@/features/game/components/BoardView/OpponentsTurnCarousel";
import { ChallengePhase } from "@/features/game/components/ChallengePhase/ChallengePhase";
import type { ChallengePhaseProps } from "@/features/game/components/ChallengePhase/ChallengePhase";
import { SpiceCard } from "@/features/game/components/SpiceCard";
import { DeclareDragPreviewHandProvider } from "@/features/game/dnd/declare-drag-preview-hand-context";
import type { GamePlayer, ClientGamePlayer, GameCard } from "@/shared/types/game";
import { GAME_PHASE } from "@/shared/types/game";
import { cn } from "@/lib/utils";
import { SNAPPY_SPRING } from "@/features/game/animations";
import {
  DRAW_PASS_COACH_HINT_REVEAL_DELAY_MS,
  DUEL_SUPPLY_RAIL_ANCHOR_VERTICAL_CENTER_CLASS,
  isRoundResolutionInterstitialPhase,
  REVEAL_REMAIN_AFTER_LOCK_THRESHOLD,
  ROUND_RESOLUTION_BOTTOM_STRIP_MIN_H,
} from "@/lib/game-room.constants";
import { PlayfieldRevealActionStrip } from "@/features/game/components/PlayfieldRevealActionStrip";
import {
  GAME_DND_DROP_HAND_DRAW_PASS,
  GAME_DND_DROP_PLAY_ZONE,
  GAME_DND_POINTER_ACTIVATION_DISTANCE_PX,
  GAME_DND_TOUCH_ACTIVATION_DELAY_MS,
  GAME_DND_TOUCH_ACTIVATION_TOLERANCE_PX,
  isGameDndDeclareCardData,
  isGameDndDrawPassData,
} from "@/features/game/dnd/game-dnd-ids";

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
  /** While dragging a card from the local hand — highlights the center play slot. */
  handDragActive?: boolean;
  /**
   * Same session as {@link handDragActive}, set synchronously at dnd-kit drag start/end (before React state).
   */
  handDragActiveRef: RefObject<boolean>;
  /** Draw-and-pass: drag the duel draw pile onto the local hand (`PLAYER_TURN` only). */
  drawPassAction?: DrawPassActionConfig | null;
  /** Drive hand-strip highlight while the draw pile drag is active. */
  onDrawPassPileDragSession?: (active: boolean) => void;
  /** While dragging a declare card from hand — highlights play zone (mirrors former PlayerHand `onDragSessionChange`). */
  onHandCardDragSessionChange?: (active: boolean) => void;
  /**
   * Local hand snapshot for declare {@link DragOverlay}. When non-empty, the dragged card renders in the overlay
   * so it is not clipped by the hand strip’s horizontal scroll container.
   */
  declareDragPreviewCards?: readonly GameCard[] | null;
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
  drawPassAction = null,
  handDragActive = false,
  handDragActiveRef,
  onDrawPassPileDragSession,
  onHandCardDragSessionChange,
  declareDragPreviewCards = null,
  challengeResult = null,
  challengeTimer = 0,
  penaltyFxSnapshot = null,
}: BoardViewProps) {
  const [drawPassOverlayVisible, setDrawPassOverlayVisible] = useState(false);
  const [declareOverlayCardId, setDeclareOverlayCardId] = useState<string | null>(null);
  const { drawStackRef, roundPileRailRef } = usePlaymatAnchors();
  const { t } = useTranslation("game");
  const reducedMotion = useReducedMotion() === true;
  useChallengeRevealSfx(phase, challengeResult, localPlayerId, reducedMotion);
  usePenaltyResultSfx(phase, penaltyFxSnapshot, localPlayerId, reducedMotion);
  useOpponentTurnSfx(phase, currentPlayerIndex, reducedMotion);
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
  /**
   * Only while the choice is locked (`challengeTimer` above {@link REVEAL_REMAIN_AFTER_LOCK_THRESHOLD}).
   * After lock, the card flips and {@link ChallengeRevealImpactOverlay} carries axis + outcome — keeping the strip
   * (flip copy: challenging / wrong axis) duplicates that and reads like a second, conflicting state.
   */
  const showRevealActionStrip =
    phase === GAME_PHASE.REVEAL &&
    playedCard != null &&
    challengeResult != null &&
    challengeTimer > REVEAL_REMAIN_AFTER_LOCK_THRESHOLD;
  const showPlayfieldActionStrip = showChallengeInline || showRevealActionStrip;

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
   * When Challenge/Reveal action UI lives below the duel band, skip centering — otherwise `justify-center`
   * floats the strip in the remaining scroll height and leaves a false “void” under the claim card.
   */
  const verticallyCenterPlayfieldInScroll =
    (!showPlayfieldActionStrip && playedCard != null) || phase === GAME_PHASE.PLAYER_TURN;

  const playfieldInterstitial = isRoundResolutionInterstitialPhase(phase);

  /**
   * Reserve min-height for the strip below the playfield when interstitial copy can mount here.
   * `REVEAL` is intentionally omitted: room client renders no `phaseContent` there, so reserving
   * {@link ROUND_RESOLUTION_BOTTOM_STRIP_MIN_H} (~24dvh) only added empty space below the hero card and caused scroll.
   * `NEXT_TURN` uses {@link NextTurnImpactOverlay} only; `PENALTY` uses {@link PenaltyResultImpactOverlay} — no strip.
   */
  const reserveRoundResolutionStrip = phase === GAME_PHASE.TROPHY_AWARDED;

  const challengeOutcomeNames = useMemo((): { challenger: string; declarer: string } | null => {
    if (!challengeResult) return null;
    return {
      challenger: players.find((p) => p.id === challengeResult.challengerId)?.nickname ?? "",
      declarer: players.find((p) => p.id === challengeResult.playerId)?.nickname ?? "",
    };
  }, [challengeResult, players]);

  /** Interstitial round UI is rendered inside {@link GameTableDeclarationSection}, not the strip below. */
  const mergeRoundResolutionInTable = playfieldInterstitial && phaseContent != null;
  const portalOnlyRoundInterstitial = playfieldInterstitial && !mergeRoundResolutionInTable;
  const phaseContentInStrip = phaseContent != null && !mergeRoundResolutionInTable;

  /** REVEAL + claim on table: flex chain must use `flex-1 min-h-0` (not `min-h-full`) so the scroll column passes height to the below-duel block on all breakpoints; otherwise `justify-center` is a no-op below `lg`. */
  const revealPlayedInScroll =
    phase === GAME_PHASE.REVEAL && playedCard != null && !showChallengeInline;

  /**
   * Drives scroll-port sizing (`lg:flex-none` vs `flex-1`) and inner `min-h` — keep derived as before.
   * Do **not** use this for `lg:justify-center` on the column that wraps the duel band: that used to run only on
   * `PLAYER_TURN`, shifting the whole duel row vs on-table claim phases.
   */
  const centerDuelClusterOnLg =
    verticallyCenterPlayfieldInScroll && !revealPlayedInScroll;

  const innerScrollJustifyCenterLg =
    verticallyCenterPlayfieldInScroll && !centerDuelClusterOnLg;

  const drawPassPileDraggable =
    drawPassAction != null
      ? {
          active: true,
          onDrawPass: drawPassAction.onDrawPass,
        }
      : null;

  const drawPassCoachRevealDelayMs = useMemo(
    () =>
      isMyTurn && phase === GAME_PHASE.PLAYER_TURN && playedCard == null
        ? DRAW_PASS_COACH_HINT_REVEAL_DELAY_MS
        : 0,
    [isMyTurn, phase, playedCard],
  );

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: GAME_DND_POINTER_ACTIVATION_DISTANCE_PX },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: GAME_DND_TOUCH_ACTIVATION_DELAY_MS,
        tolerance: GAME_DND_TOUCH_ACTIVATION_TOLERANCE_PX,
      },
    }),
  );

  const handleBoardDragStart = useCallback(
    (event: DragStartEvent) => {
      const data = event.active.data.current;
      if (isGameDndDrawPassData(data)) {
        setDrawPassOverlayVisible(true);
        onDrawPassPileDragSession?.(true);
      } else if (isGameDndDeclareCardData(data)) {
        setDeclareOverlayCardId(data.cardId);
        handDragActiveRef.current = true;
        onHandCardDragSessionChange?.(true);
      }
    },
    [handDragActiveRef, onDrawPassPileDragSession, onHandCardDragSessionChange],
  );

  const handleBoardDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDrawPassOverlayVisible(false);
      setDeclareOverlayCardId(null);
      const data = event.active.data.current;
      const { over } = event;
      if (isGameDndDrawPassData(data)) {
        onDrawPassPileDragSession?.(false);
        if (over != null && over.id === GAME_DND_DROP_HAND_DRAW_PASS) {
          drawPassAction?.onDrawPass();
        }
        return;
      }
      if (isGameDndDeclareCardData(data)) {
        handDragActiveRef.current = false;
        onHandCardDragSessionChange?.(false);
        if (over != null && over.id === GAME_DND_DROP_PLAY_ZONE) {
          playDropZone?.onCardDrop(data.cardId);
        }
      }
    },
    [
      drawPassAction,
      handDragActiveRef,
      onDrawPassPileDragSession,
      onHandCardDragSessionChange,
      playDropZone,
    ],
  );

  const handleBoardDragCancel = useCallback(
    (event: DragCancelEvent) => {
      setDrawPassOverlayVisible(false);
      setDeclareOverlayCardId(null);
      const data = event.active.data.current;
      if (isGameDndDrawPassData(data)) {
        onDrawPassPileDragSession?.(false);
      } else if (isGameDndDeclareCardData(data)) {
        handDragActiveRef.current = false;
        onHandCardDragSessionChange?.(false);
      }
    },
    [handDragActiveRef, onDrawPassPileDragSession, onHandCardDragSessionChange],
  );

  const declareDragPreviewHand = declareDragPreviewCards ?? [];
  const declareOverlayCard = useMemo((): GameCard | null => {
    if (declareOverlayCardId == null) return null;
    return declareDragPreviewHand.find((c) => c.id === declareOverlayCardId) ?? null;
  }, [declareOverlayCardId, declareDragPreviewHand]);

  /**
   * Center column only — trophy/draw rails mount on the taller `relative flex-1` playfield wrapper so
   * `top-1/2` centers them in the full playfield body (declaration + scroll), not only the declaration band height.
   */
  const duelCenterColumn = (
    <div
      className={cn(
        mergeRoundResolutionInTable
          ? "relative z-10 mx-auto w-full min-w-0 max-w-6xl px-3 sm:px-4 xl:max-w-7xl"
          : [
              "relative z-10 mx-auto w-full min-w-0 max-w-[min(100%,42rem)] px-3 sm:px-4",
              "md:w-[min(100%,max(17rem,calc(100%-19rem)))]",
              "lg:w-[min(100%,max(19rem,calc(100%-23rem)))]",
              "xl:max-w-[min(100%,48rem)] xl:w-[min(100%,max(21rem,calc(100%-26rem)))]",
            ],
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
        challengeTimer={challengeTimer}
        localPlayerId={localPlayerId}
        roundPileAnchorRef={roundPileRailRef}
        roundResolutionPanel={mergeRoundResolutionInTable ? phaseContent : null}
        showLocalTurnHints={isMyTurn}
      />
    </div>
  );

  const playfieldBelowDuel = (
    <div
      className={cn(
        "flex w-full flex-col",
        (stretchPlayfieldBlock || revealPlayedInScroll) && "min-h-0 flex-1",
        playfieldInterstitial ? "gap-2 sm:gap-3" : "gap-3 sm:gap-4",
        /** Packs action strip under the card; avoid vertical centering in a `flex-1` slot (creates a visual “void”). */
        revealPlayedInScroll && !showPlayfieldActionStrip && "justify-center",
        verticallyCenterPlayfieldInScroll && "lg:justify-center",
        showPlayfieldActionStrip && "items-center gap-2 sm:gap-3",
      )}
    >
      {showPlayfieldActionStrip ? (
        <div className="flex w-full min-h-0 flex-col items-center gap-2 sm:gap-3">
          <AnimatePresence mode="wait" initial={false}>
            {showChallengeInline && playedCard && inlineChallenge ? (
              <motion.div
                key="playfield-strip-challenge"
                initial={reducedMotion ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -10 }}
                transition={
                  reducedMotion
                    ? { type: "tween", duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }
                    : SNAPPY_SPRING
                }
                className="flex w-full min-h-0 flex-col items-center"
              >
                <ChallengePhase variant="embedded" playedCard={playedCard} {...inlineChallenge} />
              </motion.div>
            ) : showRevealActionStrip && challengeResult ? (
              <motion.div
                key="playfield-strip-reveal"
                initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
                transition={
                  reducedMotion
                    ? { type: "tween", duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }
                    : SNAPPY_SPRING
                }
                className="flex w-full min-h-0 flex-col items-center"
              >
                <PlayfieldRevealActionStrip
                  challengeResult={challengeResult}
                  challengeTimer={challengeTimer}
                  challengeOutcomeNames={challengeOutcomeNames}
                  localPlayerId={localPlayerId}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
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

  /**
   * Duel rail sits outside the scroll port so absolutely positioned trophy cards can extend
   * upward without inflating flex height or being clipped by `overflow-y-auto`.
   */
  const playfieldStageColumn = (
    <div
      className={cn(
        "board-playfield-cq flex w-full min-h-0 flex-1 flex-col",
        (stretchPlayfieldBlock || revealPlayedInScroll) && "min-h-0 flex-1",
        "items-stretch overflow-visible",
      )}
    >
      <div
        className={cn(
          "relative flex min-h-0 w-full flex-1 flex-col overflow-visible",
          playfieldInterstitial ? "@min-[28rem]:gap-3 gap-2" : "@min-[28rem]:gap-4 gap-3",
        )}
      >
        <div
          className={cn(
            "pointer-events-auto absolute left-2 z-20 sm:left-4 lg:left-5 xl:left-6",
            DUEL_SUPPLY_RAIL_ANCHOR_VERTICAL_CENTER_CLASS,
          )}
        >
          <GameTableTableauSection
            {...tableauDuelProps}
            variant="duel"
            duelSlot="trophy"
          />
        </div>
        <div
          className={cn(
            "pointer-events-auto absolute right-2 z-20 sm:right-4 lg:right-5 xl:right-6",
            DUEL_SUPPLY_RAIL_ANCHOR_VERTICAL_CENTER_CLASS,
            drawPassAction != null && "z-30",
          )}
        >
          <GameTableTableauSection
            {...tableauDuelProps}
            variant="duel"
            duelSlot="draw"
            drawStackAnchorRef={drawStackRef}
            drawPassPileDraggable={drawPassPileDraggable}
            drawPassCoachRevealDelayMs={drawPassCoachRevealDelayMs}
          />
        </div>
        <div className="w-full shrink-0 overflow-visible pt-4">{duelCenterColumn}</div>
        <div
          className={cn(
            "min-h-0 overflow-x-hidden overscroll-y-contain",
            centerDuelClusterOnLg
              ? "lg:flex-none lg:overflow-y-visible"
              : "flex-1 overflow-y-auto",
            revealPlayedInScroll && "flex min-h-0 flex-col",
          )}
        >
          <div
            className={cn(
              "flex w-full min-w-0 flex-col gap-3 @min-[28rem]:gap-4",
              "px-[clamp(0.375rem,2.5cqi,1rem)] pb-3 @min-[28rem]:px-[clamp(0.5rem,3cqi,1.25rem)]",
              revealPlayedInScroll
                ? "min-h-0 flex-1"
                : cn(
                    "min-h-full",
                    centerDuelClusterOnLg && "lg:min-h-0",
                    stretchPlayfieldBlock &&
                      !centerDuelClusterOnLg &&
                      "lg:flex-1 lg:min-h-0",
                  ),
              innerScrollJustifyCenterLg && "lg:justify-center",
            )}
          >
            {playfieldBelowDuel}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="table-stage-bg relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <ChallengeRevealImpactOverlay
        phase={phase}
        challengeResult={challengeResult}
        localPlayerId={localPlayerId}
        challengeTimer={challengeTimer}
      />
      <NextTurnImpactOverlay
        phase={phase}
        nextActorNickname={currentPlayerName}
        nextActorId={currentPlayer?.id ?? null}
        localPlayerId={localPlayerId}
      />
      <PenaltyResultImpactOverlay
        phase={phase}
        penaltyFxSnapshot={penaltyFxSnapshot}
        localPlayerId={localPlayerId}
        players={players}
      />
      <RoundResolutionFxOverlay
        phase={phase}
        penaltyFxSnapshot={penaltyFxSnapshot}
        localPlayerId={localPlayerId}
      />
      <div className="relative mx-auto flex min-h-0 w-full max-w-none flex-1 flex-col px-2 py-1.5 sm:px-4 sm:py-2">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 sm:gap-2.5">
          {sortedOpponentSlots.length > 0 ? (
            <div className="w-full min-w-0 shrink-0">
              <OpponentsTurnCarousel
                slots={sortedOpponentSlots.map(({ player, turnRelative }) => ({ player, turnRelative }))}
                currentPlayer={currentPlayer}
                currentPlayerIndex={currentPlayerIndex}
                phase={phase}
                reducedMotion={reducedMotion}
              />
            </div>
          ) : null}

          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleBoardDragStart}
            onDragEnd={handleBoardDragEnd}
            onDragCancel={handleBoardDragCancel}
          >
            <DeclareDragPreviewHandProvider cards={declareDragPreviewHand}>
              <div className="relative z-10 mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-visible px-1 sm:px-2 lg:mx-0 lg:max-w-none lg:w-full lg:px-0">
                {playfieldStageColumn}

                {tableFooter != null ? (
                  <div className="w-full shrink-0 -mx-1 bg-transparent px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3 sm:-mx-2 sm:px-6 sm:pt-3">
                    {tableFooter}
                  </div>
                ) : null}
              </div>
            </DeclareDragPreviewHandProvider>
            <DragOverlay dropAnimation={{ duration: 220, easing: "ease" }}>
              {drawPassOverlayVisible ? (
                <div className="cursor-grabbing drop-shadow-xl">
                  <DuelDrawPassDragGhost />
                </div>
              ) : declareOverlayCard != null ? (
                <div className="cursor-grabbing drop-shadow-xl">
                  <SpiceCard card={declareOverlayCard} size="hand" isDragging />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </div>
  );
}
