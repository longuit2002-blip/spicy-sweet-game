export type SpiceType = "chili" | "pepper" | "lemon";

export interface GameCard {
  id: string;
  type: SpiceType;
  number: number;
}

export interface Declaration {
  type: SpiceType;
  number: number;
}

/** Full player model used in game state */
export interface GamePlayer {
  id: string;
  nickname: string;
  hand: GameCard[];
  score: number;
  successfulBluffs: number;
  successfulChallenges: number;
  isReady: boolean;
  isHost?: boolean;
}

export type GamePhase =
  | "LOBBY"
  | "GAME_START"
  | "PLAYER_TURN"
  | "DECLARE"
  | "CHALLENGE_PHASE"
  | "REVEAL"
  | "PENALTY"
  | "NEXT_TURN"
  | "END_GAME";

export interface PlayedCard {
  card: GameCard;
  declaration: Declaration;
  playerId: string;
}

export interface ChallengeResult {
  wasBluff: boolean;
  challengerId: string;
  playerId: string;
  realCard: GameCard;
  declaredCard: Declaration;
}

export interface GameState {
  phase: GamePhase;
  players: GamePlayer[];
  currentPlayerIndex: number;
  drawPile: GameCard[];
  playedCard: PlayedCard | null;
  challengeResult: ChallengeResult | null;
  challengeTimer: number;
  winner: GamePlayer | null;
  roomCode: string;
}

export const SPICE_EMOJI: Record<SpiceType, string> = {
  chili: "🌶️",
  pepper: "⚫",
  lemon: "🍋",
};

export const SPICE_LABEL: Record<SpiceType, string> = {
  chili: "Chili",
  pepper: "Pepper",
  lemon: "Lemon",
};
