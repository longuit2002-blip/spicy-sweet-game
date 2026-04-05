import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TFunction } from "i18next";
import type { GameCard, GameViewState, ChallengeResult } from "@/shared/types/game";
import { GAME_PHASE } from "@/shared/types/game";
import type { PenaltyFxSnapshot } from "@/features/game/components/RoundResolutionFxOverlay";
import { PENALTY_DRAW_COUNT } from "@sweet-spicy/game-logic";

interface UseGameRoomActionLogArgs {
  currentGameState: GameViewState;
  localPlayerId: string;
  revealPileCardCount: number;
  t: TFunction;
}

export function useGameRoomActionLog({
  currentGameState,
  localPlayerId,
  revealPileCardCount,
  t,
}: UseGameRoomActionLogArgs) {
  const [gameLog, setGameLog] = useState<readonly { id: string; text: string; at: number }[]>([]);
  const [lastActionByPlayerId, setLastActionByPlayerId] = useState<Readonly<Record<string, string>>>({});
  const [penaltySnapshot, setPenaltySnapshot] = useState<{
    result: ChallengeResult;
    pileCardCount: number;
  } | null>(null);
  const [challengerHandBeforePenalty, setChallengerHandBeforePenalty] = useState<readonly string[] | null>(null);
  const [declarerHandBeforePenalty, setDeclarerHandBeforePenalty] = useState<readonly string[] | null>(null);
  const logSeq = useRef(0);
  const prevPhaseRef = useRef(currentGameState.phase);

  const addLog = useCallback((text: string) => {
    logSeq.current += 1;
    const id = `log-${logSeq.current}`;
    setGameLog((previousLogs) => [...previousLogs.slice(-49), { id, text, at: Date.now() }]);
  }, []);

  useEffect(() => {
    const previousPhase = prevPhaseRef.current;
    const currentPhase = currentGameState.phase;
    if (previousPhase !== currentPhase) {
      if (currentPhase === GAME_PHASE.CHALLENGE_PHASE && currentGameState.playedCard) {
        const playedCard = currentGameState.playedCard;
        const declarer = currentGameState.players.find((player) => player.id === playedCard.playerId);
        addLog(
          t("log.declared", {
            player: declarer?.nickname ?? t("common.unknownPlayer", { ns: "common" }),
            type: t(`spice.${playedCard.declaration.type}`),
            number: playedCard.declaration.number,
          }),
        );
        setLastActionByPlayerId((previousActions) => ({
          ...previousActions,
          [playedCard.playerId]: t("seat.actionDeclared"),
        }));
      }

      if (currentPhase === GAME_PHASE.REVEAL && currentGameState.challengeResult) {
        const challengeResult = currentGameState.challengeResult;
        const challenger = currentGameState.players.find((player) => player.id === challengeResult.challengerId);
        const challengedAttributeKey =
          challengeResult.challengeType === "suit" ? "result.suitAttr" : "result.numberAttr";
        addLog(
          t("log.challenged", {
            player: challenger?.nickname ?? t("common.unknownPlayer", { ns: "common" }),
            attr: t(challengedAttributeKey),
          }),
        );
        setLastActionByPlayerId((previousActions) => ({
          ...previousActions,
          [challengeResult.challengerId]: t("seat.actionChallenged"),
        }));
      }

      if (currentPhase === GAME_PHASE.NEXT_TURN && previousPhase === GAME_PHASE.CHALLENGE_PHASE) {
        addLog(t("log.accepted"));
      }

      if (currentPhase === GAME_PHASE.PENALTY && penaltySnapshot) {
        const challengeResult = penaltySnapshot.result;
        const challenger = currentGameState.players.find((player) => player.id === challengeResult.challengerId);
        const declarer = currentGameState.players.find((player) => player.id === challengeResult.playerId);
        if (challengeResult.challengeCorrect) {
          addLog(
            t("log.penaltyBluffCaught", {
              challenger: challenger?.nickname ?? t("common.unknownPlayer", { ns: "common" }),
              declarer: declarer?.nickname ?? t("common.unknownPlayer", { ns: "common" }),
              count: penaltySnapshot.pileCardCount,
            }),
          );
        } else {
          addLog(
            t("phase.penaltyDeclarerWins", {
              declarer: declarer?.nickname ?? t("common.unknownPlayer", { ns: "common" }),
              challenger: challenger?.nickname ?? t("common.unknownPlayer", { ns: "common" }),
            }),
          );
        }
      }

      if (currentPhase === GAME_PHASE.TROPHY_AWARDED) {
        if (previousPhase === GAME_PHASE.CHALLENGE_PHASE) {
          addLog(t("log.accepted"));
        }
        const playerCount = currentGameState.players.length;
        if (playerCount > 0) {
          const declarerIndex = (currentGameState.currentPlayerIndex - 1 + playerCount) % playerCount;
          const trophyEarner = currentGameState.players[declarerIndex];
          if (trophyEarner) {
            addLog(t("log.trophy", { player: trophyEarner.nickname }));
          }
        }
      }

      prevPhaseRef.current = currentPhase;
    }
  }, [addLog, currentGameState, penaltySnapshot, t]);

  useEffect(() => {
    if (currentGameState.phase === GAME_PHASE.REVEAL && currentGameState.challengeResult) {
      setPenaltySnapshot({
        result: currentGameState.challengeResult,
        pileCardCount: revealPileCardCount,
      });
      const challengeResult = currentGameState.challengeResult;
      const challenger = currentGameState.players.find((player) => player.id === challengeResult.challengerId);
      setChallengerHandBeforePenalty(challenger ? challenger.hand.map((card) => card.id) : null);
      const declarer = currentGameState.players.find((player) => player.id === challengeResult.playerId);
      setDeclarerHandBeforePenalty(declarer ? declarer.hand.map((card) => card.id) : null);
      return;
    }

    if (currentGameState.phase !== GAME_PHASE.PENALTY) {
      setPenaltySnapshot(null);
      setChallengerHandBeforePenalty(null);
      setDeclarerHandBeforePenalty(null);
    }
  }, [currentGameState.phase, currentGameState.challengeResult, currentGameState.players, revealPileCardCount]);

  const penaltyFxSnapshot = useMemo((): PenaltyFxSnapshot | null => {
    if (currentGameState.phase !== GAME_PHASE.PENALTY || !penaltySnapshot) {
      return null;
    }

    const diffPenaltyDraw = (
      previousIds: readonly string[] | null,
      handOwner: typeof currentGameState.players[number] | undefined,
    ): readonly GameCard[] | undefined => {
      if (!handOwner || !previousIds) {
        return undefined;
      }

      const prefixMatches = previousIds.every((cardId, index) => handOwner.hand[index]?.id === cardId);
      if (!prefixMatches || handOwner.hand.length < previousIds.length + PENALTY_DRAW_COUNT) {
        return undefined;
      }

      return handOwner.hand.slice(previousIds.length, previousIds.length + PENALTY_DRAW_COUNT);
    };

    let penaltyDrawnCards: readonly GameCard[] | undefined;
    const challengeResult = penaltySnapshot.result;
    if (challengeResult.challengeCorrect && challengeResult.playerId === localPlayerId) {
      penaltyDrawnCards = diffPenaltyDraw(
        declarerHandBeforePenalty,
        currentGameState.players.find((player) => player.id === localPlayerId),
      );
    } else if (!challengeResult.challengeCorrect && challengeResult.challengerId === localPlayerId) {
      penaltyDrawnCards = diffPenaltyDraw(
        challengerHandBeforePenalty,
        currentGameState.players.find((player) => player.id === localPlayerId),
      );
    }

    return {
      result: penaltySnapshot.result,
      pileCardCount: penaltySnapshot.pileCardCount,
      penaltyDrawnCards,
    };
  }, [
    challengerHandBeforePenalty,
    currentGameState,
    declarerHandBeforePenalty,
    localPlayerId,
    penaltySnapshot,
  ]);

  const trophyDeclarerPlayer = useMemo(() => {
    if (currentGameState.phase !== GAME_PHASE.TROPHY_AWARDED) {
      return null;
    }

    const playerCount = currentGameState.players.length;
    if (playerCount === 0) {
      return null;
    }

    const declarerIndex = (currentGameState.currentPlayerIndex - 1 + playerCount) % playerCount;
    return currentGameState.players[declarerIndex] ?? null;
  }, [
    currentGameState.currentPlayerIndex,
    currentGameState.phase,
    currentGameState.players,
  ]);

  return {
    gameLog,
    lastActionByPlayerId,
    penaltyFxSnapshot,
    trophyDeclarerPlayer,
  };
}
