import { useCallback, useEffect } from "react";
import {
  claimChallenge,
  drawAndPassTurnLocal,
  maxDeclarationRankForState,
  minDeclarationRankForState,
  nextTurn,
  playCardLocal,
  recordChallengePass,
  resolveChallenge,
  tickChallengePhase,
  tickRevealPhase,
} from "@sweet-spicy/game-logic";
import type { Declaration, GameState, GameViewState, SpiceType, ChallengeType } from "@/shared/types/game";
import { GAME_PHASE } from "@/shared/types/game";
import {
  OFFLINE_BOT_ACTION_DELAY_MS,
  OFFLINE_BOT_DRAW_PASS_CHANCE,
  OFFLINE_BOT_TRUTH_PLAY_THRESHOLD,
  OFFLINE_CHALLENGE_TICK_MS,
  OFFLINE_PENALTY_PHASE_AUTO_ADVANCE_MS,
  OFFLINE_PHASE_AUTO_ADVANCE_MS,
} from "@/lib/game-room.constants";

interface UseOfflineGameplayLoopArgs {
  currentGameState: GameViewState;
  currentPlayer: GameViewState["players"][number] | undefined;
  isOnlineMode: boolean;
  localPlayerId: string;
  setLocalGameState: React.Dispatch<React.SetStateAction<GameState>>;
  clearSelectedCard: () => void;
}

export function useOfflineGameplayLoop({
  currentGameState,
  currentPlayer,
  isOnlineMode,
  localPlayerId,
  setLocalGameState,
  clearSelectedCard,
}: UseOfflineGameplayLoopArgs) {
  const handleNextTurn = useCallback(() => {
    if (isOnlineMode) {
      return;
    }

    setLocalGameState((previousState) => nextTurn(previousState));
  }, [isOnlineMode, setLocalGameState]);

  useEffect(() => {
    if (isOnlineMode || currentGameState.phase !== GAME_PHASE.CHALLENGE_PHASE) {
      return;
    }

    const intervalId = setInterval(() => {
      setLocalGameState((previousState) => {
        if (previousState.phase !== GAME_PHASE.CHALLENGE_PHASE) {
          return previousState;
        }

        return tickChallengePhase(previousState);
      });
    }, OFFLINE_CHALLENGE_TICK_MS);

    return () => clearInterval(intervalId);
  }, [currentGameState.phase, isOnlineMode, setLocalGameState]);

  useEffect(() => {
    if (isOnlineMode || currentGameState.phase !== GAME_PHASE.REVEAL) {
      return;
    }

    const intervalId = setInterval(() => {
      setLocalGameState((previousState) => {
        if (previousState.phase !== GAME_PHASE.REVEAL) {
          return previousState;
        }

        return tickRevealPhase(previousState);
      });
    }, OFFLINE_CHALLENGE_TICK_MS);

    return () => clearInterval(intervalId);
  }, [currentGameState.phase, isOnlineMode, setLocalGameState]);

  useEffect(() => {
    if (
      currentGameState.phase !== GAME_PHASE.PENALTY &&
      currentGameState.phase !== GAME_PHASE.NEXT_TURN &&
      currentGameState.phase !== GAME_PHASE.TROPHY_AWARDED
    ) {
      return;
    }

    const delayMs =
      currentGameState.phase === GAME_PHASE.PENALTY
        ? OFFLINE_PENALTY_PHASE_AUTO_ADVANCE_MS
        : OFFLINE_PHASE_AUTO_ADVANCE_MS;
    const timeoutId = setTimeout(handleNextTurn, delayMs);
    return () => clearTimeout(timeoutId);
  }, [currentGameState.phase, handleNextTurn]);

  useEffect(() => {
    if (isOnlineMode || currentGameState.phase !== GAME_PHASE.PLAYER_TURN || !currentPlayer) {
      return;
    }

    const isBotTurn = currentGameState.currentPlayerIndex !== 0;
    if (!isBotTurn || !currentPlayer.hand || currentPlayer.hand.length === 0) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setLocalGameState((previousState) => {
        const actingPlayer = previousState.players[previousState.currentPlayerIndex];
        const hand = actingPlayer?.hand ?? [];
        if (!actingPlayer || hand.length === 0) {
          return previousState;
        }

        if (previousState.drawPile.length > 0 && Math.random() < OFFLINE_BOT_DRAW_PASS_CHANCE) {
          return drawAndPassTurnLocal(previousState, actingPlayer.id);
        }

        const minDeclarationRank = minDeclarationRankForState(previousState);
        const maxDeclarationRank = maxDeclarationRankForState(previousState);
        const lockedSuit = previousState.lockedSuit;
        const randomCard = hand[Math.floor(Math.random() * hand.length)];
        const allTypes: SpiceType[] = ["chili", "lemon", "avocado"];
        const pickRankInBand = () =>
          minDeclarationRank +
          Math.floor(Math.random() * (maxDeclarationRank - minDeclarationRank + 1));

        const declarationSuit =
          lockedSuit ?? allTypes[Math.floor(Math.random() * allTypes.length)];
        let declaration: Declaration;
        if (
          randomCard.number >= minDeclarationRank &&
          randomCard.number <= maxDeclarationRank &&
          Math.random() > OFFLINE_BOT_TRUTH_PLAY_THRESHOLD
        ) {
          declaration = { type: declarationSuit, number: randomCard.number };
        } else {
          const typePool = lockedSuit != null ? [lockedSuit] : allTypes;
          declaration = {
            type: typePool[Math.floor(Math.random() * typePool.length)] ?? declarationSuit,
            number: pickRankInBand(),
          };
        }

        if (lockedSuit != null) {
          declaration = { ...declaration, type: lockedSuit };
        }

        return playCardLocal(previousState, randomCard.id, declaration);
      });
      clearSelectedCard();
    }, OFFLINE_BOT_ACTION_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [
    clearSelectedCard,
    currentGameState.currentPlayerIndex,
    currentGameState.phase,
    currentPlayer,
    isOnlineMode,
    setLocalGameState,
  ]);

  useEffect(() => {
    if (
      isOnlineMode ||
      currentGameState.phase !== GAME_PHASE.CHALLENGE_PHASE ||
      currentGameState.challengeStep !== "CLAIM_RACE"
    ) {
      return;
    }

    const declarerId = currentGameState.playedCard?.playerId;
    if (!declarerId || localPlayerId !== declarerId) {
      return;
    }

    const bot = currentGameState.players.find((player) => player.id !== declarerId);
    if (!bot) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setLocalGameState((previousState) => claimChallenge(previousState, bot.id) ?? previousState);
    }, OFFLINE_BOT_ACTION_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [
    currentGameState.challengeStep,
    currentGameState.phase,
    currentGameState.playedCard?.playerId,
    currentGameState.players,
    isOnlineMode,
    localPlayerId,
    setLocalGameState,
  ]);

  useEffect(() => {
    if (
      isOnlineMode ||
      currentGameState.phase !== GAME_PHASE.CHALLENGE_PHASE ||
      currentGameState.challengeStep !== "PICK_TYPE"
    ) {
      return;
    }

    const challengeHolderId = currentGameState.challengeClaimHolderId;
    if (!challengeHolderId || challengeHolderId === localPlayerId) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setLocalGameState((previousState) => {
        const currentHolderId = previousState.challengeClaimHolderId;
        if (!currentHolderId) {
          return previousState;
        }

        const challengeType: ChallengeType = Math.random() > 0.5 ? "suit" : "number";
        return resolveChallenge(previousState, currentHolderId, challengeType);
      });
    }, OFFLINE_BOT_ACTION_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [
    currentGameState.challengeClaimHolderId,
    currentGameState.challengeStep,
    currentGameState.phase,
    isOnlineMode,
    localPlayerId,
    setLocalGameState,
  ]);

  const applyOfflineChallengePass = useCallback(() => {
    setLocalGameState((previousState) => recordChallengePass(previousState, localPlayerId) ?? previousState);
  }, [localPlayerId, setLocalGameState]);

  const applyOfflineClaimChallenge = useCallback(() => {
    setLocalGameState((previousState) => claimChallenge(previousState, localPlayerId) ?? previousState);
  }, [localPlayerId, setLocalGameState]);

  return {
    applyOfflineClaimChallenge,
    applyOfflineChallengePass,
  };
}
