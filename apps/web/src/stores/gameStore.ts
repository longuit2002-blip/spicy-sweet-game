import { create } from "zustand";
import type { GameState, GamePhase, Declaration } from "@/shared/types/game";
import type { Player } from "@/shared/types/game";

interface GameStore {
  gameState: GameState | null;
  setGameState: (state: GameState) => void;
  updateGameState: (partial: Partial<GameState>) => void;
  resetGameState: () => void;

  selectedCardId: string | null;
  setSelectedCard: (cardId: string | null) => void;
  selectedDeclaration: Declaration | null;
  setSelectedDeclaration: (declaration: Declaration | null) => void;

  challengeTimeLeft: number;
  setChallengeTimeLeft: (time: number) => void;
  decrementChallengeTimer: () => void;

  currentPlayer: Player | null;
  isMyTurn: boolean;
  myHand: Player["hand"];
  canChallenge: boolean;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  selectedCardId: null,
  selectedDeclaration: null,
  challengeTimeLeft: 5,

  setGameState: (gameState) => set({ gameState, challengeTimeLeft: 5 }),

  updateGameState: (partial) =>
    set((state) => ({
      gameState: state.gameState ? { ...state.gameState, ...partial } : null,
      challengeTimeLeft: 5,
    })),

  resetGameState: () =>
    set({
      gameState: null,
      selectedCardId: null,
      selectedDeclaration: null,
      challengeTimeLeft: 5,
    }),

  setSelectedCard: (cardId) => set({ selectedCardId: cardId }),
  setSelectedDeclaration: (declaration) => set({ selectedDeclaration: declaration }),
  setChallengeTimeLeft: (time) => set({ challengeTimeLeft: time }),

  decrementChallengeTimer: () =>
    set((state) => ({
      challengeTimeLeft: Math.max(0, state.challengeTimeLeft - 1),
    })),

  get currentPlayer() {
    const { gameState } = get();
    if (!gameState) return null;
    return gameState.players[gameState.currentPlayerIndex] || null;
  },

  get isMyTurn() {
    return false;
  },

  get myHand() {
    return [];
  },

  get canChallenge() {
    const { gameState } = get();
    if (!gameState) return false;
    return gameState.phase === "CHALLENGE_PHASE";
  },
}));

export const getCurrentPlayer = (gameState: GameState | null): Player | null => {
  if (!gameState) return null;
  return gameState.players[gameState.currentPlayerIndex] || null;
};

export const getGamePhaseLabel = (phase: GamePhase): string => {
  const labels: Record<GamePhase, string> = {
    LOBBY: "Waiting for players...",
    GAME_START: "Game starting...",
    PLAYER_TURN: "Your turn!",
    DECLARE: "Declare your card",
    CHALLENGE_PHASE: "Challenge or accept?",
    REVEAL: "Revealing card...",
    PENALTY: "Drawing penalty cards...",
    NEXT_TURN: "Next turn...",
    END_GAME: "Game Over!",
  };
  return labels[phase];
};
