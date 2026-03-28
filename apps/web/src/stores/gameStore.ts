import { create } from "zustand";
import { CHALLENGE_PHASE_COUNTDOWN_SECONDS } from "@sweet-spicy/game-logic";
import type { Declaration, GameViewState } from "@/shared/types/game";
import type { Player } from "@/shared/types/game";

interface GameStore {
  gameState: GameViewState | null;
  setGameState: (state: GameViewState) => void;
  updateGameState: (partial: Partial<GameViewState>) => void;
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

function challengeTimeFromState(gs: GameViewState | null): number {
  if (!gs) return CHALLENGE_PHASE_COUNTDOWN_SECONDS;
  return typeof gs.challengeTimer === "number" ? gs.challengeTimer : CHALLENGE_PHASE_COUNTDOWN_SECONDS;
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  selectedCardId: null,
  selectedDeclaration: null,
  challengeTimeLeft: CHALLENGE_PHASE_COUNTDOWN_SECONDS,

  setGameState: (gameState) =>
    set({ gameState, challengeTimeLeft: challengeTimeFromState(gameState) }),

  updateGameState: (partial) =>
    set((state) => {
      const next: GameViewState =
        state.gameState !== null
          ? ({ ...state.gameState, ...partial } as GameViewState)
          : ({ ...partial } as GameViewState);
      return {
        gameState: next,
        challengeTimeLeft: challengeTimeFromState(next),
      };
    }),

  resetGameState: () =>
    set({
      gameState: null,
      selectedCardId: null,
      selectedDeclaration: null,
      challengeTimeLeft: CHALLENGE_PHASE_COUNTDOWN_SECONDS,
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

export const getCurrentPlayer = (gameState: GameViewState | null): Player | null => {
  if (!gameState) return null;
  return gameState.players[gameState.currentPlayerIndex] || null;
};
